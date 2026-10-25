using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Data.Sqlite;

namespace InventorySystem.Helpers
{
    /// <summary>
    /// In-app updates. Reads a small JSON manifest (Updates.ManifestUrl in appsettings.json),
    /// downloads the new SevenTenSetup.exe, verifies it, backs up the database, then runs setup
    /// and closes the app. Setup upgrades the install in place and reopens the app.
    ///
    /// User data (database, license, cloud sync, backups) lives in %LocalAppData%\SevenTenInventory,
    /// outside the install folder, so setup never touches it. As a second safety net, the database is
    /// also snapshotted on the first start of any new version, before schema migrations run.
    /// </summary>
    public static class UpdateService
    {
        public sealed class UpdateInfo
        {
            public string Version { get; set; }
            public string Url { get; set; }
            public string Sha256 { get; set; }
            public long Size { get; set; }
            public string Notes { get; set; }
            public string PublishedAt { get; set; }
        }

        /// <summary>Created by setup (see installer\7-10.iss) once it is elevated and running.</summary>
        private const string SetupRunningMutex = @"Local\SoftioInventory_SevenTen_Updating";
        private const string LastRunVersionFile = "last_run_version.txt";
        private const string PreUpdatePrefix = "backup_pre-update";
        private const int KeepPreUpdateBackups = 5;
        private static readonly TimeSpan AutoCheckInterval = TimeSpan.FromHours(6);

        private static readonly HttpClient Http = CreateHttp();
        private static readonly object Gate = new();

        // idle | checking | up-to-date | available | downloading | ready | installing | error
        private static string _state = "idle";
        private static string _error;
        private static string _phase;
        private static UpdateInfo _latest;
        private static DateTime? _lastCheck;
        private static long _downloaded;
        private static long _total;
        private static string _installerPath;

        public static string CurrentVersion { get; } = ReadCurrentVersion();
        public static string ManifestUrl { get; }
        public static bool CheckOnStartup { get; } = true;

        public static string UpdatesDirectory => Path.Combine(DatabaseConfig.UserDataDirectory, "Updates");

        static UpdateService()
        {
            try
            {
                string path = AppHostConfig.FindAppSettings();
                if (path == null) return;
                using var doc = JsonDocument.Parse(File.ReadAllText(path));
                if (!doc.RootElement.TryGetProperty("Updates", out JsonElement u)) return;
                if (u.TryGetProperty("ManifestUrl", out JsonElement url) && url.ValueKind == JsonValueKind.String)
                    ManifestUrl = url.GetString()?.Trim();
                if (u.TryGetProperty("CheckOnStartup", out JsonElement c) &&
                    (c.ValueKind == JsonValueKind.True || c.ValueKind == JsonValueKind.False))
                    CheckOnStartup = c.GetBoolean();
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "UpdateService: reading Updates settings");
            }
        }

        // ---------------------------------------------------------------- startup safety net

        /// <summary>
        /// Call before the database is opened/migrated. If this is the first start of a different
        /// version, snapshot the database so a bad migration can always be rolled back.
        /// </summary>
        public static void BeforeDatabaseInit()
        {
            try
            {
                string previous = ReadLastRunVersion();
                if (previous == CurrentVersion) return;
                if (!File.Exists(DatabaseConfig.DatabasePath)) return; // brand-new install, nothing to protect

                string from = string.IsNullOrWhiteSpace(previous) ? "unknown" : previous;
                CreatePreUpdateBackup($"{from}_to_{CurrentVersion}");
            }
            catch (Exception ex)
            {
                // Never block startup on the safety snapshot; the error is logged for support.
                ErrorLogger.LogError(ex, "UpdateService: pre-upgrade snapshot");
            }
        }

        /// <summary>Call once the database initialised fine on this version.</summary>
        public static void AfterDatabaseInit()
        {
            try
            {
                File.WriteAllText(Path.Combine(DatabaseConfig.UserDataDirectory, LastRunVersionFile), CurrentVersion);
                CleanupInstallers();
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "UpdateService: AfterDatabaseInit");
            }
        }

        /// <summary>
        /// Consistent copy of the live database via SQLite's online backup API (safe with WAL and
        /// open connections), verified with quick_check. Throws if the copy is not usable.
        /// </summary>
        public static string CreatePreUpdateBackup(string label)
        {
            string dir;
            try { dir = BackupService.GetBackupDirectory(); }
            catch { dir = BackupService.GetDefaultBackupDirectory(); }
            Directory.CreateDirectory(dir);

            string safeLabel = label ?? "";
            foreach (char c in Path.GetInvalidFileNameChars())
                safeLabel = safeLabel.Replace(c, '_');
            string dest = Path.Combine(dir, $"{PreUpdatePrefix}_{safeLabel}_{DateTime.Now:yyyyMMdd_HHmmss}.db");

            try
            {
                using (var src = new SqliteConnection($"Data Source={DatabaseConfig.DatabasePath};Mode=ReadOnly;Pooling=False"))
                using (var dst = new SqliteConnection($"Data Source={dest};Pooling=False"))
                {
                    src.Open();
                    dst.Open();
                    src.BackupDatabase(dst);
                    using var cmd = dst.CreateCommand();
                    cmd.CommandText = "PRAGMA quick_check;";
                    string result = Convert.ToString(cmd.ExecuteScalar());
                    if (!string.Equals(result, "ok", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException("Backup check failed: " + result);
                }
            }
            catch
            {
                TryDelete(dest);
                throw;
            }

            try { File.WriteAllText(Path.Combine(dir, "last_backup.txt"), DateTime.Now.ToString("o")); } catch { }
            PrunePreUpdateBackups(dir);
            return dest;
        }

        // ---------------------------------------------------------------- status / check

        public static object GetStatus()
        {
            lock (Gate)
            {
                return new
                {
                    currentVersion = CurrentVersion,
                    configured = !string.IsNullOrWhiteSpace(ManifestUrl),
                    state = _state,
                    phase = _phase,
                    error = _error,
                    lastCheck = _lastCheck?.ToString("o"),
                    latest = _latest == null ? null : new
                    {
                        version = _latest.Version,
                        notes = _latest.Notes,
                        publishedAt = _latest.PublishedAt,
                        size = _latest.Size
                    },
                    updateAvailable = _latest != null && IsNewer(_latest.Version, CurrentVersion),
                    downloaded = _downloaded,
                    total = _total
                };
            }
        }

        /// <param name="force">false = reuse a recent result (used for the automatic check on launch).</param>
        public static async Task CheckAsync(bool force)
        {
            lock (Gate)
            {
                if (_state is "checking" or "downloading" or "installing") return;
                if (!force && _lastCheck.HasValue && DateTime.Now - _lastCheck.Value < AutoCheckInterval) return;
                if (string.IsNullOrWhiteSpace(ManifestUrl))
                {
                    SetError("Update address is not configured (Updates.ManifestUrl in appsettings.json).");
                    return;
                }
                _state = "checking";
                _error = null;
            }

            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, ManifestUrl);
                req.Headers.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue { NoCache = true };
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
                using var res = await Http.SendAsync(req, cts.Token);
                res.EnsureSuccessStatusCode();
                string json = await res.Content.ReadAsStringAsync(cts.Token);
                var info = JsonSerializer.Deserialize<UpdateInfo>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (info == null || ParseVersion(info.Version) == null)
                    throw new InvalidOperationException("Update manifest has no valid version.");
                if (!Uri.TryCreate(info.Url, UriKind.Absolute, out Uri dl) || dl.Scheme != Uri.UriSchemeHttps)
                    throw new InvalidOperationException("Update manifest must point to an https:// installer.");

                lock (Gate)
                {
                    _latest = info;
                    _lastCheck = DateTime.Now;
                    if (!IsNewer(info.Version, CurrentVersion))
                        _state = "up-to-date";
                    else if (_installerPath != null && File.Exists(_installerPath) && _installerPath.Contains(info.Version))
                        _state = "ready";
                    else
                        _state = "available";
                }
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "UpdateService.CheckAsync");
                lock (Gate)
                {
                    _lastCheck = DateTime.Now;
                    SetError("Could not check for updates. Check the internet connection and try again.");
                }
            }
        }

        // ---------------------------------------------------------------- download + install

        /// <summary>Downloads (or reuses) the installer, then backs up and runs it. Runs in the background.</summary>
        public static void StartUpdate()
        {
            UpdateInfo info;
            lock (Gate)
            {
                if (_state is "downloading" or "installing") return;
                info = _latest;
                if (info == null || !IsNewer(info.Version, CurrentVersion))
                {
                    SetError("No newer version is available.");
                    return;
                }
                _state = "downloading";
                _error = null;
                _phase = null;
                _downloaded = 0;
                _total = info.Size;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    string installer = await DownloadAsync(info);
                    lock (Gate) { _installerPath = installer; }
                    await InstallAsync(installer, info.Version);
                }
                catch (Exception ex)
                {
                    ErrorLogger.LogError(ex, "UpdateService.StartUpdate");
                    lock (Gate) { SetError(ex.Message); }
                }
            });
        }

        /// <summary>
        /// Install a SevenTenSetup.exe the user already has (USB, WhatsApp, email) - works offline.
        /// Returns false if the user cancelled the file picker.
        /// </summary>
        public static bool StartUpdateFromFile()
        {
            lock (Gate)
            {
                if (_state is "downloading" or "installing") return true;
            }

            string file = PickInstallerFile();
            if (string.IsNullOrWhiteSpace(file)) return false;

            var vi = FileVersionInfo.GetVersionInfo(file);
            if (!string.Equals(vi.ProductName?.Trim(), ThemeConfig.AppTitle, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(vi.ProductName?.Trim(), "7-10 Inventory", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("This file is not a 7-10 Inventory setup file.");

            string version = ParseVersion(vi.ProductVersion) != null ? NormalizeVersionString(vi.ProductVersion) : "file";
            lock (Gate)
            {
                _state = "installing";
                _error = null;
                _phase = null;
            }

            _ = Task.Run(async () =>
            {
                try { await InstallAsync(file, version); }
                catch (Exception ex)
                {
                    ErrorLogger.LogError(ex, "UpdateService.StartUpdateFromFile");
                    lock (Gate) { SetError(ex.Message); }
                }
            });
            return true;
        }

        private static async Task<string> DownloadAsync(UpdateInfo info)
        {
            Directory.CreateDirectory(UpdatesDirectory);
            string final = Path.Combine(UpdatesDirectory, $"SevenTenSetup-{NormalizeVersionString(info.Version)}.exe");
            string part = final + ".part";

            if (File.Exists(final) && MatchesExpected(final, info))
                return final;
            TryDelete(final);

            using (var res = await Http.GetAsync(info.Url, HttpCompletionOption.ResponseHeadersRead))
            {
                res.EnsureSuccessStatusCode();
                long total = res.Content.Headers.ContentLength ?? info.Size;
                lock (Gate) { _total = total; }

                using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
                await using (var input = await res.Content.ReadAsStreamAsync())
                await using (var output = new FileStream(part, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    var buffer = new byte[81920];
                    int read;
                    long done = 0;
                    while ((read = await input.ReadAsync(buffer)) > 0)
                    {
                        await output.WriteAsync(buffer.AsMemory(0, read));
                        hash.AppendData(buffer, 0, read);
                        done += read;
                        lock (Gate) { _downloaded = done; }
                    }
                }

                string actual = Convert.ToHexString(hash.GetHashAndReset());
                if (!string.IsNullOrWhiteSpace(info.Sha256) &&
                    !string.Equals(actual, info.Sha256.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    TryDelete(part);
                    throw new InvalidOperationException("The downloaded update is damaged (checksum mismatch). Please try again.");
                }
                if (info.Size > 0 && new FileInfo(part).Length != info.Size)
                {
                    TryDelete(part);
                    throw new InvalidOperationException("The downloaded update is incomplete. Please try again.");
                }
            }

            File.Move(part, final, overwrite: true);
            return final;
        }

        private static async Task InstallAsync(string installer, string targetVersion)
        {
            lock (Gate) { _state = "installing"; _phase = "backup"; }

            // 1. Safety backup. If this fails we stop here - nothing has been changed yet.
            CreatePreUpdateBackup($"{CurrentVersion}_to_{targetVersion}");

            // 2. Run setup. It asks for admin rights (UAC), waits for this app to exit,
            //    upgrades in place and reopens the app (see /FROMAPP in installer\7-10.iss).
            lock (Gate) { _phase = "setup"; }
            Process setup = Process.Start(new ProcessStartInfo
            {
                FileName = installer,
                Arguments = "/SILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS /FROMAPP=1",
                WorkingDirectory = Path.GetDirectoryName(installer),
                UseShellExecute = true
            });

            // 3. Wait until setup is really running (UAC accepted) before closing. If the user
            //    declines UAC, setup exits without ever creating its mutex and the app stays open.
            while (true)
            {
                if (SetupIsRunning())
                    break;
                if (setup == null || setup.HasExited)
                {
                    int code = setup?.HasExited == true ? setup.ExitCode : -1;
                    throw new InvalidOperationException(
                        $"The update was cancelled (setup exit code {code}). Your data was not changed.");
                }
                await Task.Delay(300);
            }

            lock (Gate) { _phase = "closing"; }
            CloseApp();
        }

        private static bool SetupIsRunning()
        {
            try
            {
                if (!Mutex.TryOpenExisting(SetupRunningMutex, out Mutex m)) return false;
                m.Dispose();
                return true;
            }
            catch (UnauthorizedAccessException)
            {
                // Created by the elevated setup process - it exists, we just may not open it.
                return true;
            }
        }

        private static void CloseApp()
        {
            try
            {
                Form main = Application.OpenForms.Cast<Form>().FirstOrDefault();
                if (main != null && main.IsHandleCreated)
                    main.BeginInvoke(new Action(() => main.Close()));
                else
                    Application.Exit();
            }
            catch { }

            // Setup only waits ~30s for the app to exit; make sure it does even if a dialog blocks the UI.
            _ = Task.Run(async () =>
            {
                await Task.Delay(TimeSpan.FromSeconds(8));
                Environment.Exit(0);
            });
        }

        // ---------------------------------------------------------------- helpers

        public static bool IsNewer(string candidate, string current)
        {
            Version a = ParseVersion(candidate);
            Version b = ParseVersion(current);
            return a != null && (b == null || a > b);
        }

        /// <summary>"v2.1" / "2.1.0" / "2.1.0+abc" -> 2.1.0.0 (missing parts become 0 so 2.1 == 2.1.0).</summary>
        public static Version ParseVersion(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            string t = s.Trim().TrimStart('v', 'V');
            int cut = t.IndexOfAny(new[] { '+', '-', ' ' });
            if (cut >= 0) t = t.Substring(0, cut);
            if (!t.Contains('.')) t += ".0";
            if (!Version.TryParse(t, out Version v)) return null;
            return new Version(v.Major, v.Minor, Math.Max(v.Build, 0), Math.Max(v.Revision, 0));
        }

        private static string NormalizeVersionString(string s)
        {
            Version v = ParseVersion(s);
            if (v == null) return "unknown";
            return v.Revision > 0 ? v.ToString(4) : v.ToString(3);
        }

        private static string ReadCurrentVersion()
        {
            Assembly asm = typeof(UpdateService).Assembly;
            string info = asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
            if (ParseVersion(info) != null) return NormalizeVersionString(info);
            return NormalizeVersionString(asm.GetName().Version?.ToString());
        }

        private static string ReadLastRunVersion()
        {
            try
            {
                string path = Path.Combine(DatabaseConfig.UserDataDirectory, LastRunVersionFile);
                return File.Exists(path) ? File.ReadAllText(path).Trim() : null;
            }
            catch { return null; }
        }

        private static bool MatchesExpected(string path, UpdateInfo info)
        {
            try
            {
                if (info.Size > 0 && new FileInfo(path).Length != info.Size) return false;
                if (string.IsNullOrWhiteSpace(info.Sha256)) return false;
                using var fs = File.OpenRead(path);
                string actual = Convert.ToHexString(SHA256.HashData(fs));
                return string.Equals(actual, info.Sha256.Trim(), StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        /// <summary>Removes downloaded installers that are not newer than the running version.</summary>
        private static void CleanupInstallers()
        {
            if (!Directory.Exists(UpdatesDirectory)) return;
            foreach (string f in Directory.GetFiles(UpdatesDirectory, "SevenTenSetup-*"))
            {
                string name = Path.GetFileNameWithoutExtension(f.EndsWith(".part") ? f[..^5] : f);
                string ver = name.Substring("SevenTenSetup-".Length);
                if (f.EndsWith(".part") || !IsNewer(ver, CurrentVersion))
                    TryDelete(f);
            }
        }

        private static void PrunePreUpdateBackups(string dir)
        {
            try
            {
                foreach (string old in Directory.GetFiles(dir, PreUpdatePrefix + "_*.db")
                             .OrderByDescending(File.GetLastWriteTimeUtc)
                             .Skip(KeepPreUpdateBackups))
                    TryDelete(old);
            }
            catch { }
        }

        private static string PickInstallerFile()
        {
            string selected = null;
            Exception error = null;
            var thread = new Thread(() =>
            {
                try
                {
                    using var owner = new Form
                    {
                        TopMost = true,
                        ShowInTaskbar = false,
                        Opacity = 0,
                        Width = 1,
                        Height = 1,
                        StartPosition = FormStartPosition.CenterScreen
                    };
                    owner.Show();
                    using var dlg = new OpenFileDialog
                    {
                        Title = LocalizationManager.GetString("Update_ChooseFile", "Choose the 7-10 Inventory setup file"),
                        Filter = "Setup (*.exe)|*.exe",
                        CheckFileExists = true,
                        Multiselect = false
                    };
                    if (dlg.ShowDialog(owner) == DialogResult.OK)
                        selected = dlg.FileName;
                    owner.Hide();
                }
                catch (Exception ex)
                {
                    error = ex;
                }
            });
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();
            if (error != null) throw error;
            return selected;
        }

        private static void SetError(string message)
        {
            _state = "error";
            _phase = null;
            _error = message;
        }

        private static void TryDelete(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); } catch { }
        }

        private static HttpClient CreateHttp()
        {
            var http = new HttpClient { Timeout = TimeSpan.FromMinutes(30) };
            http.DefaultRequestHeaders.UserAgent.ParseAdd("SevenTenInventory-Updater");
            return http;
        }
    }
}
