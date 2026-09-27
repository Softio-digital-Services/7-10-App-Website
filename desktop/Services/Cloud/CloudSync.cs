using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services.Cloud
{
    /// <summary>
    /// Keeps every linked laptop and the website on the same shop data, with no primary laptop:
    /// each one pushes its own changes to the hub (the website) and pulls everyone else's.
    /// </summary>
    public static partial class CloudSync
    {
        private const int PushBatchSize = 300;
        private const int PullLimit = 400;
        private const int PendingGiveUp = 30;
        private const int MaxUploadBytes = 4 * 1024 * 1024;
        private const int ShrinkAboveBytes = 1_500_000;
        private const string MediaFolder = "Assets/Products/";
        private static readonly Regex MediaName = new(@"^[a-f0-9]{16,64}\.(jpg|jpeg|png|webp|gif)$", RegexOptions.Compiled);
        private static readonly HashSet<string> ImageExts = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif" };

        private static readonly SemaphoreSlim Gate = new(1, 1);
        private static string _appRoot = AppContext.BaseDirectory;

        private static volatile string _phase = "";
        private static int _progressDone;
        private static int _progressTotal;
        private static volatile string _lastError;
        private static DateTime? _lastSuccess;
        private static DateTime _lastAttempt = DateTime.MinValue;
        private static DateTime _lastActivity = DateTime.MinValue;
        private static int _failures;
        private static volatile string _hubState;

        public static bool Busy => Gate.CurrentCount == 0;
        public static bool IsLinked => CloudConfig.Load().IsLinked;

        // ---------------------------------------------------------------- startup

        /// <summary>Called once at app start, after the schema is up to date.</summary>
        public static void Startup(string appRoot)
        {
            _appRoot = appRoot;
            try
            {
                var cfg = CloudConfig.Load();
                using var conn = CloudStore.Open();
                if (!cfg.IsLinked)
                {
                    // A database copied from a linked laptop must not keep recording changes nobody will send.
                    if (CloudStore.HasSyncTables(conn))
                    {
                        using var clean = conn.BeginTransaction();
                        CloudStore.RemoveTriggers(conn, clean);
                        clean.Commit();
                    }
                    return;
                }

                using (var tx = conn.BeginTransaction())
                {
                    CloudStore.EnsureTables(conn, tx);
                    CloudStore.SetApplying(conn, tx, false);
                    if (!cfg.NeedsSnapshot || CloudStore.GetMeta(conn, tx, "device") == cfg.DeviceId)
                        CloudStore.InstallTriggers(conn, tx);
                    tx.Commit();
                }
                DetectRestore(conn, cfg);
            }
            catch (Exception ex)
            {
                _lastError = ex.Message;
                ErrorLogger.LogError(ex, "CloudSync.Startup");
            }
        }

        /// <summary>
        /// A restored backup (or a database copied from another laptop) no longer matches what this laptop told the hub.
        /// Its own already-sent changes would be missing locally, so it re-downloads the shop instead.
        /// </summary>
        private static void DetectRestore(SqliteConnection conn, CloudConfig cfg)
        {
            string dbDevice = CloudStore.GetMeta(conn, null, "device");
            long seq = CloudStore.Long(conn, null, "SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = '_sync_outbox'), 0)");
            bool foreign = dbDevice != null && dbDevice != cfg.DeviceId;
            bool rolledBack = seq < cfg.LastPushedSeq;
            if (!foreign && !rolledBack) return;

            using (var tx = conn.BeginTransaction())
            {
                if (foreign) CloudStore.Exec(conn, tx, "DELETE FROM _sync_outbox");
                else CloudStore.Exec(conn, tx, "DELETE FROM _sync_outbox WHERE seq <= @p0", cfg.LastPushedSeq);
                BumpOutboxSequence(conn, tx, Math.Max(seq, cfg.LastPushedSeq));
                CloudStore.SetMeta(conn, tx, "device", cfg.DeviceId);
                CloudStore.Log(conn, tx, foreign
                    ? "This database came from another laptop; downloading the shop's data again."
                    : "A backup was restored; downloading the shop's latest data again.");
                tx.Commit();
            }
            if (!(cfg.IsFounder && !cfg.Founded))
            {
                cfg.NeedsSnapshot = true;
                cfg.Save();
            }
        }

        private static void BumpOutboxSequence(SqliteConnection conn, SqliteTransaction tx, long atLeast)
        {
            if (CloudStore.Long(conn, tx, "SELECT COUNT(*) FROM sqlite_sequence WHERE name = '_sync_outbox'") == 0)
                CloudStore.Exec(conn, tx, "INSERT INTO sqlite_sequence (name, seq) VALUES ('_sync_outbox', @p0)", atLeast);
            else
                CloudStore.Exec(conn, tx, "UPDATE sqlite_sequence SET seq = MAX(seq, @p0) WHERE name = '_sync_outbox'", atLeast);
        }

        // ---------------------------------------------------------------- linking

        public sealed class HubCheck
        {
            public string State { get; set; }
            public int Devices { get; set; }
        }

        public static async Task<HubCheck> CheckAsync(string url, string shopKey, CancellationToken ct = default)
        {
            using var doc = await HubClient.SendAsync(HttpMethod.Get, HubClient.NormalizeUrl(url), "/api/hub/status", null, shopKey: shopKey.Trim(), ct: ct);
            var root = doc.RootElement;
            return new HubCheck
            {
                State = root.GetProperty("state").GetString(),
                Devices = root.TryGetProperty("devices", out var d) ? d.GetInt32() : 0
            };
        }

        /// <summary>
        /// Registers this laptop with the hub. "create" makes this laptop's data the shop's data (first laptop only);
        /// "join" replaces this laptop's data with the shop's. The long upload/download continues in the background.
        /// </summary>
        public static async Task ConnectAsync(string url, string shopKey, string deviceName, bool create, bool startSync = true, CancellationToken ct = default)
        {
            if (CloudConfig.Load().IsLinked) throw new InvalidOperationException("This laptop is already linked. Disconnect it first.");
            url = HubClient.NormalizeUrl(url);
            if (!Uri.TryCreate(url, UriKind.Absolute, out _)) throw new InvalidOperationException("Enter the website address, e.g. https://seventen.netlify.app");
            string name = string.IsNullOrWhiteSpace(deviceName) ? Environment.MachineName : deviceName.Trim();
            if (name.Length > 60) name = name.Substring(0, 60);

            await Gate.WaitAsync(ct);
            try
            {
                using var doc = await HubClient.SendAsync(HttpMethod.Post, url, "/api/hub/devices",
                    new { name, mode = create ? "create" : "join", appVersion = HubClient.AppVersion }, shopKey: shopKey.Trim(), ct: ct);
                var root = doc.RootElement;
                var cfg = new CloudConfig
                {
                    Url = url,
                    DeviceId = root.GetProperty("deviceId").GetString(),
                    DeviceName = name,
                    Role = create ? "founder" : "member",
                    Founded = false,
                    NeedsSnapshot = !create,
                    ConnectedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                    Token = root.GetProperty("token").GetString(),
                    Secret = root.TryGetProperty("secret", out var s) ? s.GetString() : null
                };

                using (var conn = CloudStore.Open())
                using (var tx = conn.BeginTransaction())
                {
                    CloudStore.EnsureTables(conn, tx);
                    foreach (string t in new[] { "_sync_outbox", "_sync_map", "_sync_pending", "_sync_web", "_sync_uploads", "_sync_meta" })
                        CloudStore.Exec(conn, tx, "DELETE FROM " + t);
                    CloudStore.SetApplying(conn, tx, false);
                    CloudStore.SetMeta(conn, tx, "device", cfg.DeviceId);
                    CloudStore.SetMeta(conn, tx, "cursor", "0");
                    cfg.LastPushedSeq = CloudStore.Long(conn, tx, "SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = '_sync_outbox'), 0)");
                    if (create)
                    {
                        // Triggers go in with the full enqueue, in one transaction, so no edit slips between the two.
                        CloudStore.InstallTriggers(conn, tx);
                        EnqueueEverything(conn, tx);
                        CloudStore.Log(conn, tx, "Linked as the first laptop; uploading the shop's data.");
                    }
                    else
                    {
                        CloudStore.RemoveTriggers(conn, tx);
                        CloudStore.Log(conn, tx, "Linked; downloading the shop's data.");
                    }
                    tx.Commit();
                }
                cfg.Save();
                _lastError = null;
                _failures = 0;
                _lastActivity = DateTime.Now;
            }
            finally
            {
                Gate.Release();
            }

            if (startSync) _ = Task.Run(() => RunAsync(manual: true));
        }

        private static void EnqueueEverything(SqliteConnection conn, SqliteTransaction tx)
        {
            foreach (var table in SyncTables.All)
            {
                var cols = CloudStore.Columns(conn, tx, table.Name);
                if (cols.Count == 0) continue;
                string q = CloudStore.Quote(table.Name);
                string pk = CloudStore.Quote(table.Pk);
                CloudStore.Exec(conn, tx, $"INSERT INTO _sync_outbox (tbl, lid, op) SELECT @p0, {pk}, 'U' FROM {q} ORDER BY {pk}", table.Name);
                foreach (string c in cols.Where(c => table.Counters.Contains(c)))
                {
                    string qc = CloudStore.Quote(c);
                    CloudStore.Exec(conn, tx,
                        $"INSERT INTO _sync_outbox (tbl, lid, op, col, delta) SELECT @p0, {pk}, 'C', @p1, {qc} FROM {q} WHERE COALESCE({qc}, 0) <> 0 ORDER BY {pk}",
                        table.Name, c);
                }
            }
        }

        /// <summary>Stops syncing on this laptop. Its data stays exactly as it is.</summary>
        public static async Task DisconnectAsync()
        {
            await Gate.WaitAsync();
            try
            {
                using (var conn = CloudStore.Open())
                {
                    if (CloudStore.HasSyncTables(conn))
                    {
                        using var tx = conn.BeginTransaction();
                        CloudStore.RemoveTriggers(conn, tx);
                        foreach (string t in new[] { "_sync_outbox", "_sync_map", "_sync_pending", "_sync_web", "_sync_uploads", "_sync_meta" })
                            CloudStore.Exec(conn, tx, "DELETE FROM " + t);
                        CloudStore.Log(conn, tx, "Disconnected from the shop.");
                        tx.Commit();
                    }
                }
                CloudConfig.Delete();
                _lastError = null;
                _hubState = null;
                _lastSuccess = null;
            }
            finally
            {
                Gate.Release();
            }
        }

        // ---------------------------------------------------------------- run loop

        /// <summary>One full sync: download the shop if needed, then exchange until nothing is left either way.</summary>
        public static async Task<bool> RunAsync(bool manual, CancellationToken ct = default)
        {
            if (!await Gate.WaitAsync(manual ? 60_000 : 0, ct)) return false;
            _lastAttempt = DateTime.Now;
            try
            {
                var cfg = CloudConfig.Load();
                if (!cfg.IsLinked || cfg.Revoked) return false;

                if (cfg.NeedsSnapshot) await RunSnapshotAsync(cfg, ct);

                for (int i = 0; i < 400 && !ct.IsCancellationRequested; i++)
                {
                    var more = await CycleAsync(cfg, ct);
                    if (!more) break;
                }
                _lastSuccess = DateTime.Now;
                _lastError = null;
                _failures = 0;
                return true;
            }
            catch (HubException ex)
            {
                _failures++;
                _lastError = ex.Message;
                if (ex.Code is "bad_device" or "device_revoked")
                {
                    var cfg = CloudConfig.Load();
                    cfg.Revoked = true;
                    cfg.Save();
                }
                return false;
            }
            catch (Exception ex)
            {
                _failures++;
                _lastError = ex.Message;
                ErrorLogger.LogError(ex, "CloudSync.Run");
                return false;
            }
            finally
            {
                _phase = "";
                Gate.Release();
            }
        }

        /// <summary>How long the background loop waits between checks: quick while the shop is busy, slow when it's quiet.</summary>
        internal static TimeSpan NextDelay(bool localChanges)
        {
            if (_failures > 0) return TimeSpan.FromSeconds(Math.Min(300, 15 * Math.Pow(2, Math.Min(_failures - 1, 4))));
            if (localChanges) return TimeSpan.FromSeconds(4);
            var idle = DateTime.Now - _lastActivity;
            if (idle < TimeSpan.FromMinutes(5)) return TimeSpan.FromSeconds(20);
            if (idle < TimeSpan.FromMinutes(30)) return TimeSpan.FromSeconds(60);
            return TimeSpan.FromSeconds(180);
        }

        internal static DateTime LastAttempt => _lastAttempt;

        internal static bool HasLocalChanges()
        {
            try
            {
                using var conn = CloudStore.Open();
                return CloudStore.HasSyncTables(conn) && CloudStore.Long(conn, null, "SELECT EXISTS (SELECT 1 FROM _sync_outbox)") == 1;
            }
            catch
            {
                return false;
            }
        }

        // ---------------------------------------------------------------- one exchange

        private sealed class OutboxEntry
        {
            public long Seq;
            public SyncTable Table;
            public long Lid;
            public char Op;
            public string Col;
            public double Delta;
        }

        private sealed class RowRead
        {
            public OutboxEntry Entry;
            public List<KeyValuePair<string, object>> Values;
        }

        private static async Task<bool> CycleAsync(CloudConfig cfg, CancellationToken ct)
        {
            using var conn = CloudStore.Open();
            CloudStore.ResetColumnCache();

            // --- outgoing
            var entries = ReadOutbox(conn);
            long maxSeq = entries.Count > 0 ? entries.Max(e => e.Seq) : 0;
            long remainingAfter = entries.Count == 0 ? 0 : CloudStore.Long(conn, null, "SELECT COUNT(*) FROM _sync_outbox WHERE seq > @p0", maxSeq);
            bool drained = remainingAfter == 0;
            if (cfg.IsFounder && !cfg.Founded && entries.Count > 0)
            {
                _phase = "Uploading the shop's data";
                long left = remainingAfter + entries.Count;
                _progressTotal = Math.Max(_progressTotal, (int)left);
                _progressDone = _progressTotal - (int)left;
            }
            var changes = await BuildChangesAsync(conn, cfg, entries, ct);
            var acks = drained ? PendingAcks(conn, cfg) : PendingAcks(conn, cfg).Where(a => a.ContainsKey("error")).ToList();
            var statuses = PendingStatuses(conn);

            var body = new
            {
                cursor = CloudStore.GetMetaLong(conn, null, "cursor"),
                changes,
                acks,
                statuses = statuses.Select(s => new { orderNumber = s.Number, status = s.Status, paid = s.Paid }).ToList(),
                claim = cfg.CanClaim,
                limit = PullLimit,
                appVersion = HubClient.AppVersion
            };

            using var doc = await HubClient.SendAsync(HttpMethod.Post, cfg.Url, "/api/hub/exchange", body, device: cfg, ct: ct);
            var root = doc.RootElement;

            // --- the hub stored everything we sent
            using (var tx = conn.BeginTransaction())
            {
                if (entries.Count > 0) CloudStore.Exec(conn, tx, "DELETE FROM _sync_outbox WHERE seq <= @p0", maxSeq);
                foreach (var a in acks)
                    CloudStore.Exec(conn, tx, "UPDATE _sync_web SET ack_sent = 1 WHERE order_number = @p0", a["orderNumber"]);
                var settled = new HashSet<string>(
                    root.TryGetProperty("statuses", out var st) && st.ValueKind == JsonValueKind.Array
                        ? st.EnumerateArray().Select(x => x.GetString())
                        : Enumerable.Empty<string>());
                foreach (var s in statuses.Where(s => settled.Contains(s.Number)))
                {
                    CloudStore.Exec(conn, tx,
                        "INSERT INTO _sync_web (order_number, pushed_status, pushed_paid) VALUES (@p0, @p1, @p2) " +
                        "ON CONFLICT(order_number) DO UPDATE SET pushed_status = excluded.pushed_status, pushed_paid = excluded.pushed_paid",
                        s.Number, s.Status, s.Paid ? 1 : 0);
                }
                tx.Commit();
            }
            if (maxSeq > cfg.LastPushedSeq)
            {
                cfg.LastPushedSeq = maxSeq;
                cfg.Save();
            }
            if (changes.Count > 0) _lastActivity = DateTime.Now;

            _hubState = root.TryGetProperty("state", out var state) ? state.GetString() : _hubState;
            if (root.TryGetProperty("storefrontError", out var sfe) && sfe.ValueKind == JsonValueKind.String)
                CloudStore.Log(conn, null, "Website catalogue update failed: " + sfe.GetString());

            if (root.TryGetProperty("resync", out var resync) && resync.GetBoolean())
            {
                cfg.NeedsSnapshot = true;
                cfg.Save();
                await RunSnapshotAsync(cfg, ct);
                return true;
            }

            // --- everyone else's changes
            var incoming = new List<Incoming>();
            if (root.TryGetProperty("changes", out var list))
            {
                foreach (var c in list.EnumerateArray())
                {
                    incoming.Add(new Incoming
                    {
                        S = c.GetProperty("s").GetInt64(),
                        T = c.GetProperty("t").GetString(),
                        G = c.GetProperty("g").GetString(),
                        O = c.GetProperty("o").GetString()[0],
                        D = c.GetProperty("d")
                    });
                }
            }
            long cursor = root.GetProperty("cursor").GetInt64();
            await DownloadFilesAsync(conn, cfg, incoming.Where(i => i.O == 'U').Select(i => (i.T, i.D)), ct);
            int applied = ApplyIncoming(conn, cfg, incoming, cursor);
            if (applied > 0)
            {
                _lastActivity = DateTime.Now;
                RaiseChanged("Changes from another laptop");
            }

            // --- website orders handed to this laptop
            int created = 0;
            if (root.TryGetProperty("webOrders", out var orders) && orders.ValueKind == JsonValueKind.Array && orders.GetArrayLength() > 0)
            {
                created = TakeWebOrders(conn, orders);
                _lastActivity = DateTime.Now;
            }

            if (cfg.IsFounder && !cfg.Founded && drained && _hubState == "founding")
            {
                using var founded = await HubClient.SendAsync(HttpMethod.Post, cfg.Url, "/api/hub/founded", new { }, device: cfg, ct: ct);
                cfg.Founded = true;
                cfg.Save();
                _hubState = "ready";
                _progressDone = _progressTotal = 0;
                CloudStore.Log(conn, null, "Upload finished. Other laptops can join now, and the website shows the catalogue.");
                return true;
            }
            if (cfg.IsFounder && !cfg.Founded && _hubState == "ready")
            {
                cfg.Founded = true;
                cfg.Save();
            }

            bool morePull = root.TryGetProperty("more", out var more) && more.GetBoolean();
            bool acksWaiting = acks.Count == 0 &&
                CloudStore.Long(conn, null, "SELECT COUNT(*) FROM _sync_web WHERE ack_sent = 0 AND (order_lid IS NOT NULL OR error IS NOT NULL)") > 0;
            // New website orders are pushed and confirmed straight away rather than on the next timer tick.
            return morePull || !drained || created > 0 || acksWaiting;
        }

        private static List<OutboxEntry> ReadOutbox(SqliteConnection conn)
        {
            var list = new List<OutboxEntry>();
            using var cmd = CloudStore.Command(conn, null, "SELECT seq, tbl, lid, op, col, delta FROM _sync_outbox ORDER BY seq LIMIT @p0", PushBatchSize);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                var table = SyncTables.Get(r.GetString(1));
                list.Add(new OutboxEntry
                {
                    Seq = r.GetInt64(0),
                    Table = table,
                    Lid = r.GetInt64(2),
                    Op = r.GetString(3)[0],
                    Col = r.IsDBNull(4) ? null : r.GetString(4),
                    Delta = r.IsDBNull(5) ? 0 : r.GetDouble(5)
                });
            }
            return list;
        }

        /// <summary>
        /// Turns outbox entries into hub changes. Several edits of one row collapse into its latest state;
        /// stock/balance movements are sent one by one (each carries its own outbox number, so a retry never counts twice).
        /// </summary>
        private static async Task<List<Dictionary<string, object>>> BuildChangesAsync(SqliteConnection conn, CloudConfig cfg, List<OutboxEntry> entries, CancellationToken ct)
        {
            var result = new List<Dictionary<string, object>>();
            if (entries.Count == 0) return result;

            var lastRowOp = new Dictionary<(string, long), OutboxEntry>();
            var counters = new List<OutboxEntry>();
            foreach (var e in entries)
            {
                if (e.Table == null) continue;
                if (e.Op == 'C') counters.Add(e);
                else lastRowOp[(e.Table.Name, e.Lid)] = e;
            }

            var reads = new List<RowRead>();
            foreach (var e in lastRowOp.Values)
            {
                List<KeyValuePair<string, object>> values = null;
                if (e.Op != 'D' && CloudStore.TableExists(conn, null, e.Table.Name))
                {
                    using var cmd = CloudStore.Command(conn, null,
                        $"SELECT * FROM {CloudStore.Quote(e.Table.Name)} WHERE {CloudStore.Quote(e.Table.Pk)} = @p0", e.Lid);
                    using var r = cmd.ExecuteReader();
                    if (r.Read())
                    {
                        values = new List<KeyValuePair<string, object>>(r.FieldCount);
                        for (int i = 0; i < r.FieldCount; i++)
                            values.Add(new(r.GetName(i), r.IsDBNull(i) ? null : r.GetValue(i)));
                    }
                }
                reads.Add(new RowRead { Entry = e, Values = values });
            }

            var fileValues = reads.Where(x => x.Values != null)
                .SelectMany(x => x.Values.Where(v => x.Entry.Table.Files.Contains(v.Key) && v.Value is string s && s.Length > 0).Select(v => (string)v.Value))
                .Distinct(StringComparer.Ordinal)
                .ToList();
            var portable = await UploadFilesAsync(conn, cfg, fileValues, ct);

            using var tx = conn.BeginTransaction();
            foreach (var read in reads)
            {
                var e = read.Entry;
                if (read.Values == null)
                {
                    string gone = CloudStore.GidFor(conn, tx, e.Table.Name, e.Lid, cfg.DeviceId, create: false);
                    if (gone != null) result.Add(Change(e.Seq, e.Table.Name, gone, "D", new Dictionary<string, object>()));
                    continue;
                }
                string gid = CloudStore.GidFor(conn, tx, e.Table.Name, e.Lid, cfg.DeviceId, create: true);
                result.Add(Change(e.Seq, e.Table.Name, gid, "U", Serialize(conn, tx, cfg, e.Table, read.Values, portable)));
            }
            foreach (var c in counters)
            {
                string gid = CloudStore.GidFor(conn, tx, c.Table.Name, c.Lid, cfg.DeviceId, create: false);
                if (gid == null)
                {
                    if (!CloudStore.RowExists(conn, tx, c.Table, c.Lid)) continue;
                    gid = CloudStore.GidFor(conn, tx, c.Table.Name, c.Lid, cfg.DeviceId, create: true);
                }
                object delta = c.Delta == Math.Floor(c.Delta) && Math.Abs(c.Delta) < 1e15 ? (object)(long)c.Delta : c.Delta;
                result.Add(Change(c.Seq, c.Table.Name, gid, "C", new Dictionary<string, object> { [c.Col] = delta }));
            }
            tx.Commit();

            result.Sort((a, b) => ((long)a["n"]).CompareTo((long)b["n"]));
            return result;
        }

        private static Dictionary<string, object> Change(long n, string t, string g, string o, Dictionary<string, object> d) =>
            new() { ["n"] = n, ["t"] = t, ["g"] = g, ["o"] = o, ["d"] = d };

        private static Dictionary<string, object> Serialize(SqliteConnection conn, SqliteTransaction tx, CloudConfig cfg, SyncTable table,
            List<KeyValuePair<string, object>> values, Dictionary<string, string> portable)
        {
            string TypeOf(string col) => values.FirstOrDefault(v => v.Key.Equals(col, StringComparison.OrdinalIgnoreCase)).Value?.ToString();
            var d = new Dictionary<string, object>();
            foreach (var (col, raw) in values)
            {
                if (col.Equals(table.Pk, StringComparison.OrdinalIgnoreCase) || table.Counters.Contains(col)) continue;
                object v = raw;
                string target = table.TargetOf(col, TypeOf);
                if (target != null && v != null && TryLong(v, out long fk))
                {
                    var targetTable = SyncTables.Get(target);
                    if (fk <= 0 || targetTable == null) v = fk;
                    else if (CloudStore.TableExists(conn, tx, target) && CloudStore.RowExists(conn, tx, targetTable, fk))
                        v = CloudStore.GidFor(conn, tx, target, fk, cfg.DeviceId, create: true);
                    else v = null; // points at a row that no longer exists here; a raw local id would mean something else elsewhere
                }
                else if (v is string enc && table.Encrypted.Contains(col))
                    v = new Dictionary<string, string> { ["$enc"] = CloudCrypto.Encrypt(enc, cfg.Secret) };
                else if (v is string file && table.Files.Contains(col) && portable.TryGetValue(file, out string shared))
                    v = shared;
                else if (v is byte[] bytes)
                    v = new Dictionary<string, string> { ["$b64"] = Convert.ToBase64String(bytes) };
                d[col] = v;
            }
            return d;
        }

        private static bool TryLong(object v, out long result)
        {
            switch (v)
            {
                case long l: result = l; return true;
                case int i: result = i; return true;
                case double dbl when dbl == Math.Floor(dbl): result = (long)dbl; return true;
                case string s when long.TryParse(s.Trim(), out long parsed): result = parsed; return true;
                default: result = 0; return false;
            }
        }

        // ---------------------------------------------------------------- applying incoming changes

        private sealed class Incoming
        {
            public long S;
            public string T;
            public string G;
            public char O;
            public JsonElement D;
            public long? PendingId;
            public int Attempts;
        }

        private enum Outcome { Applied, Skipped, Unresolved }

        /// <summary>
        /// Applies a page of changes, plus earlier ones that were waiting for a parent row, in one transaction
        /// together with the new cursor, so a crash can never apply a stock movement twice or skip one.
        /// </summary>
        private static int ApplyIncoming(SqliteConnection conn, CloudConfig cfg, List<Incoming> fresh, long cursor)
        {
            var docs = new List<JsonDocument>();
            try
            {
                using var tx = conn.BeginTransaction();
                CloudStore.SetApplying(conn, tx, true);

                var all = new List<Incoming>();
                using (var cmd = CloudStore.Command(conn, tx, "SELECT id, seq, tbl, gid, op, data, attempts FROM _sync_pending ORDER BY id"))
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read())
                    {
                        var doc = JsonDocument.Parse(r.GetString(5));
                        docs.Add(doc);
                        all.Add(new Incoming
                        {
                            PendingId = r.GetInt64(0),
                            S = r.GetInt64(1),
                            T = r.GetString(2),
                            G = r.GetString(3),
                            O = r.GetString(4)[0],
                            D = doc.RootElement,
                            Attempts = r.GetInt32(6)
                        });
                    }
                }
                all.AddRange(fresh);
                if (all.Count == 0)
                {
                    CloudStore.SetMeta(conn, tx, "cursor", cursor.ToString());
                    CloudStore.SetApplying(conn, tx, false);
                    tx.Commit();
                    return 0;
                }

                // Hub ids are never reused, so only the latest insert/edit/delete of each row matters.
                var latest = new Dictionary<(string, string), Incoming>();
                foreach (var c in all.Where(c => c.O != 'C'))
                {
                    var key = (c.T, c.G);
                    if (!latest.TryGetValue(key, out var cur) || c.S >= cur.S)
                    {
                        if (cur?.PendingId != null) DropPending(conn, tx, cur);
                        latest[key] = c;
                    }
                    else if (c.PendingId != null) DropPending(conn, tx, c);
                }

                int applied = 0;
                var deleted = new HashSet<(string, string)>();
                int Rank(Incoming c) => SyncTables.Get(c.T)?.Rank ?? int.MaxValue;

                // Deletes first (children before parents): a row deleted and re-created with the same unique name must not merge into the dying one.
                foreach (var c in latest.Values.Where(c => c.O == 'D').OrderByDescending(Rank).ThenBy(c => c.S))
                {
                    if (ApplyDelete(conn, tx, c) == Outcome.Applied) applied++;
                    deleted.Add((c.T, c.G));
                    if (c.PendingId != null) DropPending(conn, tx, c);
                }

                foreach (var c in latest.Values.Where(c => c.O == 'U').OrderBy(Rank).ThenBy(c => c.S))
                {
                    var outcome = Guarded(conn, tx, c, () => ApplyUpsert(conn, tx, cfg, c, force: c.Attempts >= PendingGiveUp));
                    Settle(conn, tx, c, outcome, ref applied);
                }

                foreach (var c in all.Where(c => c.O == 'C').OrderBy(c => c.S))
                {
                    if (deleted.Contains((c.T, c.G)))
                    {
                        if (c.PendingId != null) DropPending(conn, tx, c);
                        continue;
                    }
                    var outcome = Guarded(conn, tx, c, () => ApplyCounter(conn, tx, c));
                    if (outcome == Outcome.Unresolved && c.Attempts >= PendingGiveUp) outcome = Outcome.Skipped;
                    Settle(conn, tx, c, outcome, ref applied);
                }

                CloudStore.SetMeta(conn, tx, "cursor", cursor.ToString());
                CloudStore.SetApplying(conn, tx, false);
                tx.Commit();
                return applied;
            }
            finally
            {
                foreach (var d in docs) d.Dispose();
            }
        }

        private static Outcome Guarded(SqliteConnection conn, SqliteTransaction tx, Incoming c, Func<Outcome> apply)
        {
            try
            {
                return apply();
            }
            catch (SqliteException ex) when (ex.SqliteErrorCode is 1 or 19 or 20)
            {
                // A row that can't be stored here (constraint or schema difference) must not block everything behind it.
                CloudStore.Log(conn, tx, $"Skipped a change to {c.T}: {ex.Message}");
                return Outcome.Skipped;
            }
            catch (CryptographicException)
            {
                CloudStore.Log(conn, tx, $"Skipped a change to {c.T}: it couldn't be decrypted with this shop's secret.");
                return Outcome.Skipped;
            }
        }

        private static void Settle(SqliteConnection conn, SqliteTransaction tx, Incoming c, Outcome outcome, ref int applied)
        {
            if (outcome == Outcome.Applied) applied++;
            if (outcome != Outcome.Unresolved)
            {
                if (c.PendingId != null) DropPending(conn, tx, c);
                return;
            }
            if (c.PendingId != null)
                CloudStore.Exec(conn, tx, "UPDATE _sync_pending SET attempts = attempts + 1 WHERE id = @p0", c.PendingId);
            else
                CloudStore.Exec(conn, tx, "INSERT INTO _sync_pending (seq, tbl, gid, op, data, attempts) VALUES (@p0, @p1, @p2, @p3, @p4, 1)",
                    c.S, c.T, c.G, c.O.ToString(), c.D.GetRawText());
        }

        private static void DropPending(SqliteConnection conn, SqliteTransaction tx, Incoming c) =>
            CloudStore.Exec(conn, tx, "DELETE FROM _sync_pending WHERE id = @p0", c.PendingId);

        private static Outcome ApplyDelete(SqliteConnection conn, SqliteTransaction tx, Incoming c)
        {
            var table = SyncTables.Get(c.T);
            if (table == null || !CloudStore.TableExists(conn, tx, table.Name)) return Outcome.Skipped;
            long? lid = CloudStore.LidFor(conn, tx, table.Name, c.G);
            CloudStore.Exec(conn, tx, "DELETE FROM _sync_pending WHERE tbl = @p0 AND gid = @p1", c.T, c.G);
            if (lid == null) return Outcome.Skipped;
            CloudStore.Exec(conn, tx, $"DELETE FROM {CloudStore.Quote(table.Name)} WHERE {CloudStore.Quote(table.Pk)} = @p0", lid.Value);
            CloudStore.MapDropLid(conn, tx, table.Name, lid.Value);
            return Outcome.Applied;
        }

        private static Outcome ApplyCounter(SqliteConnection conn, SqliteTransaction tx, Incoming c)
        {
            var table = SyncTables.Get(c.T);
            if (table == null || !CloudStore.TableExists(conn, tx, table.Name)) return Outcome.Skipped;
            long? lid = CloudStore.LidFor(conn, tx, table.Name, c.G);
            if (lid == null) return Outcome.Unresolved;
            var cols = CloudStore.Columns(conn, tx, table.Name);
            bool any = false;
            foreach (var prop in c.D.EnumerateObject())
            {
                if (!table.Counters.Contains(prop.Name) || !cols.Contains(prop.Name, StringComparer.OrdinalIgnoreCase)) continue;
                if (prop.Value.ValueKind != JsonValueKind.Number) continue;
                object delta = prop.Value.TryGetInt64(out long whole) ? whole : prop.Value.GetDouble();
                string qc = CloudStore.Quote(prop.Name);
                any |= CloudStore.Exec(conn, tx,
                    $"UPDATE {CloudStore.Quote(table.Name)} SET {qc} = COALESCE({qc}, 0) + @p0 WHERE {CloudStore.Quote(table.Pk)} = @p1",
                    delta, lid.Value) > 0;
            }
            return any ? Outcome.Applied : Outcome.Skipped;
        }

        /// <summary>Inserts or updates one row from the hub, translating hub ids back to this laptop's ids.</summary>
        private static Outcome ApplyUpsert(SqliteConnection conn, SqliteTransaction tx, CloudConfig cfg, Incoming c, bool force)
        {
            var table = SyncTables.Get(c.T);
            if (table == null) return Outcome.Skipped;
            var cols = CloudStore.Columns(conn, tx, table.Name);
            if (cols.Count == 0) return Outcome.Skipped;
            var colSet = new HashSet<string>(cols, StringComparer.OrdinalIgnoreCase);

            string TypeOf(string col) => c.D.TryGetProperty(col, out var e) && e.ValueKind == JsonValueKind.String ? e.GetString() : null;
            var values = new List<KeyValuePair<string, object>>();
            foreach (var prop in c.D.EnumerateObject())
            {
                string col = prop.Name;
                if (col.Equals(table.Pk, StringComparison.OrdinalIgnoreCase) || table.Counters.Contains(col) || !colSet.Contains(col)) continue;
                string target = table.TargetOf(col, TypeOf);
                object v;
                if (target != null && prop.Value.ValueKind == JsonValueKind.String)
                {
                    long? ref_ = CloudStore.LidFor(conn, tx, target, prop.Value.GetString());
                    if (ref_ == null && !force) return Outcome.Unresolved;
                    v = ref_;
                }
                else v = FromJson(prop.Value, table, col, cfg);
                values.Add(new(col, v));
            }

            long? lid = CloudStore.LidFor(conn, tx, table.Name, c.G);
            if (lid != null)
            {
                int n = values.Count > 0 ? Update(conn, tx, table, lid.Value, values) : (CloudStore.RowExists(conn, tx, table, lid.Value) ? 1 : 0);
                if (n == 0) Insert(conn, tx, table, cols, values, lid.Value);
                return Outcome.Applied;
            }

            long newLid;
            try
            {
                newLid = Insert(conn, tx, table, cols, values, null);
            }
            catch (SqliteException ex) when (ex.SqliteErrorCode == 19 && ex.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase))
            {
                // Same unique value created on two laptops (e.g. a category name): both hub ids now mean this one row.
                long? existing = FindByUnique(conn, tx, table, values);
                if (existing == null) throw;
                CloudStore.MapSet(conn, tx, table.Name, c.G, existing.Value);
                Update(conn, tx, table, existing.Value, values);
                return Outcome.Applied;
            }
            CloudStore.MapSet(conn, tx, table.Name, c.G, newLid);
            return Outcome.Applied;
        }

        private static object FromJson(JsonElement e, SyncTable table, string col, CloudConfig cfg)
        {
            switch (e.ValueKind)
            {
                case JsonValueKind.Null:
                case JsonValueKind.Undefined:
                    return null;
                case JsonValueKind.String:
                    return e.GetString();
                case JsonValueKind.Number:
                    return e.TryGetInt64(out long l) ? l : e.GetDouble();
                case JsonValueKind.True:
                    return 1L;
                case JsonValueKind.False:
                    return 0L;
                case JsonValueKind.Object:
                    if (e.TryGetProperty("$enc", out var enc)) return CloudCrypto.Decrypt(enc.GetString(), cfg.Secret);
                    if (e.TryGetProperty("$b64", out var b64)) return Convert.FromBase64String(b64.GetString());
                    return e.GetRawText();
                default:
                    return e.GetRawText();
            }
        }

        private static int Update(SqliteConnection conn, SqliteTransaction tx, SyncTable table, long lid, List<KeyValuePair<string, object>> values)
        {
            var sets = values.Select((v, i) => $"{CloudStore.Quote(v.Key)} = @p{i}");
            var args = values.Select(v => v.Value).Append(lid).ToArray();
            return CloudStore.Exec(conn, tx,
                $"UPDATE {CloudStore.Quote(table.Name)} SET {string.Join(", ", sets)} WHERE {CloudStore.Quote(table.Pk)} = @p{values.Count}", args);
        }

        private static long Insert(SqliteConnection conn, SqliteTransaction tx, SyncTable table, List<string> cols,
            List<KeyValuePair<string, object>> values, long? lid)
        {
            var all = new List<KeyValuePair<string, object>>(values);
            foreach (string counter in cols.Where(c => table.Counters.Contains(c)))
                if (!all.Any(v => v.Key.Equals(counter, StringComparison.OrdinalIgnoreCase))) all.Add(new(counter, 0L));
            if (lid != null) all.Add(new(table.Pk, lid.Value));

            string sql = all.Count == 0
                ? $"INSERT INTO {CloudStore.Quote(table.Name)} DEFAULT VALUES"
                : $"INSERT INTO {CloudStore.Quote(table.Name)} ({string.Join(", ", all.Select(v => CloudStore.Quote(v.Key)))}) " +
                  $"VALUES ({string.Join(", ", all.Select((_, i) => "@p" + i))})";
            CloudStore.Exec(conn, tx, sql, all.Select(v => v.Value).ToArray());
            return lid ?? CloudStore.Long(conn, tx, "SELECT last_insert_rowid()");
        }

        private static long? FindByUnique(SqliteConnection conn, SqliteTransaction tx, SyncTable table, List<KeyValuePair<string, object>> values)
        {
            var map = values.GroupBy(v => v.Key, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.Last().Value, StringComparer.OrdinalIgnoreCase);
            foreach (var key in CloudStore.UniqueKeys(conn, tx, table.Name))
            {
                if (!key.All(k => map.TryGetValue(k, out var v) && v != null)) continue;
                string where = string.Join(" AND ", key.Select((k, i) => $"{CloudStore.Quote(k)} = @p{i}"));
                object hit = CloudStore.Scalar(conn, tx,
                    $"SELECT {CloudStore.Quote(table.Pk)} FROM {CloudStore.Quote(table.Name)} WHERE {where} LIMIT 1",
                    key.Select(k => map[k]).ToArray());
                if (hit != null) return Convert.ToInt64(hit);
            }
            return null;
        }

        // ---------------------------------------------------------------- joining: full download

        private static async Task RunSnapshotAsync(CloudConfig cfg, CancellationToken ct)
        {
            _phase = "Downloading the shop's data";
            _progressDone = 0;
            _progressTotal = 0;

            // Anything this laptop changed and hasn't sent yet goes up first (the re-download would erase it).
            using (var conn = CloudStore.Open())
            {
                if (CloudStore.HasSyncTables(conn) && CloudStore.GetMeta(conn, null, "device") == cfg.DeviceId
                    && CloudStore.Long(conn, null, "SELECT COUNT(*) FROM _sync_outbox") > 0)
                {
                    await PushOnlyAsync(conn, cfg, ct);
                }
            }

            var rows = new List<(string t, string g, string d)>();
            var counters = new List<(string t, string g, string c, JsonElement v)>();
            JsonDocument counterDoc = null;
            long head = 0;
            string afterT = null, afterG = null;
            try
            {
                while (true)
                {
                    string path = afterT == null
                        ? "/api/hub/snapshot"
                        : $"/api/hub/snapshot?t={Uri.EscapeDataString(afterT)}&g={Uri.EscapeDataString(afterG)}";
                    var doc = await HubClient.SendAsync(HttpMethod.Get, cfg.Url, path, null, device: cfg, ct: ct);
                    var root = doc.RootElement;
                    if (afterT == null)
                    {
                        head = root.GetProperty("head").GetInt64();
                        counterDoc = doc;
                        foreach (var c in root.GetProperty("counters").EnumerateArray())
                            counters.Add((c.GetProperty("t").GetString(), c.GetProperty("g").GetString(), c.GetProperty("c").GetString(), c.GetProperty("v")));
                    }
                    foreach (var r in root.GetProperty("rows").EnumerateArray())
                        rows.Add((r.GetProperty("t").GetString(), r.GetProperty("g").GetString(), r.GetProperty("d").GetRawText()));
                    _progressDone = rows.Count;

                    var next = root.GetProperty("next");
                    if (next.ValueKind != JsonValueKind.Object)
                    {
                        if (doc != counterDoc) doc.Dispose();
                        break;
                    }
                    afterT = next.GetProperty("t").GetString();
                    afterG = next.GetProperty("g").GetString();
                    if (doc != counterDoc) doc.Dispose();
                }

                _phase = "Downloading product photos";
                var parsed = rows.Select(r => (r.t, r.g, doc: JsonDocument.Parse(r.d))).ToList();
                try
                {
                    using (var conn = CloudStore.Open())
                        await DownloadFilesAsync(conn, cfg, parsed.Select(p => (p.t, p.doc.RootElement)), ct);

                    _phase = "Saving the shop's data";
                    BackupDatabase("before-cloud-download");
                    using var db = CloudStore.Open();
                    CloudStore.ResetColumnCache();
                    using var tx = db.BeginTransaction();
                    CloudStore.EnsureTables(db, tx);
                    CloudStore.SetApplying(db, tx, true);
                    foreach (var table in SyncTables.All.Reverse())
                        if (CloudStore.TableExists(db, tx, table.Name))
                            CloudStore.Exec(db, tx, "DELETE FROM " + CloudStore.Quote(table.Name));
                    foreach (string t in new[] { "_sync_outbox", "_sync_map", "_sync_pending", "_sync_web" })
                        CloudStore.Exec(db, tx, "DELETE FROM " + t);

                    int Rank(string t) => SyncTables.Get(t)?.Rank ?? int.MaxValue;
                    foreach (var p in parsed.OrderBy(p => Rank(p.t)).ThenBy(p => p.g, StringComparer.Ordinal))
                    {
                        var item = new Incoming { T = p.t, G = p.g, O = 'U', D = p.doc.RootElement };
                        Guarded(db, tx, item, () => ApplyUpsert(db, tx, cfg, item, force: true));
                    }
                    foreach (var (t, g, c, v) in counters)
                    {
                        var table = SyncTables.Get(t);
                        if (table == null || !table.Counters.Contains(c) || !CloudStore.Columns(db, tx, t).Contains(c, StringComparer.OrdinalIgnoreCase)) continue;
                        long? lid = CloudStore.LidFor(db, tx, t, g);
                        if (lid == null) continue;
                        object value = v.TryGetInt64(out long whole) ? whole : v.GetDouble();
                        // Added, not assigned: two hub rows merged into one local row (same unique key) carry a total each.
                        string qc = CloudStore.Quote(c);
                        CloudStore.Exec(db, tx,
                            $"UPDATE {CloudStore.Quote(t)} SET {qc} = COALESCE({qc}, 0) + @p0 WHERE {CloudStore.Quote(table.Pk)} = @p1", value, lid.Value);
                    }
                    CloudStore.SetMeta(db, tx, "cursor", head.ToString());
                    CloudStore.SetMeta(db, tx, "device", cfg.DeviceId);
                    CloudStore.InstallTriggers(db, tx);
                    CloudStore.SetApplying(db, tx, false);
                    CloudStore.Log(db, tx, $"Downloaded the shop's data ({rows.Count} records).");
                    tx.Commit();
                }
                finally
                {
                    foreach (var p in parsed) p.doc.Dispose();
                }
            }
            finally
            {
                counterDoc?.Dispose();
            }

            cfg.NeedsSnapshot = false;
            cfg.Save();
            _progressDone = _progressTotal = 0;
            _lastActivity = DateTime.Now;
            RaiseChanged("Shop data downloaded");
        }

        /// <summary>Sends the outbox without applying anything that comes back (used right before a full re-download).</summary>
        private static async Task PushOnlyAsync(SqliteConnection conn, CloudConfig cfg, CancellationToken ct)
        {
            for (int i = 0; i < 200; i++)
            {
                var entries = ReadOutbox(conn);
                if (entries.Count == 0) return;
                long maxSeq = entries.Max(e => e.Seq);
                var changes = await BuildChangesAsync(conn, cfg, entries, ct);
                using var doc = await HubClient.SendAsync(HttpMethod.Post, cfg.Url, "/api/hub/exchange",
                    new { cursor = CloudStore.GetMetaLong(conn, null, "cursor"), changes, limit = 1, appVersion = HubClient.AppVersion }, device: cfg, ct: ct);
                CloudStore.Exec(conn, null, "DELETE FROM _sync_outbox WHERE seq <= @p0", maxSeq);
                if (maxSeq > cfg.LastPushedSeq)
                {
                    cfg.LastPushedSeq = maxSeq;
                    cfg.Save();
                }
            }
        }

        private static void BackupDatabase(string label)
        {
            try
            {
                string dir = Path.Combine(DatabaseConfig.UserDataDirectory, "Backups");
                Directory.CreateDirectory(dir);
                string dest = Path.Combine(dir, $"{label}-{DateTime.Now:yyyyMMdd-HHmmss}.db");
                using var src = CloudStore.Open();
                using var dst = new SqliteConnection($"Data Source={dest};Pooling=False");
                dst.Open();
                src.BackupDatabase(dst);
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "CloudSync backup before download");
            }
        }

        // ---------------------------------------------------------------- photos

        private static string MediaDirectory => Path.Combine(_appRoot, "Assets", "Products");

        private static bool IsSharedPath(string value, out string name)
        {
            name = null;
            string v = (value ?? "").Replace('\\', '/').TrimStart('/');
            if (!v.StartsWith(MediaFolder, StringComparison.OrdinalIgnoreCase)) return false;
            string file = v.Substring(MediaFolder.Length).ToLowerInvariant();
            if (!MediaName.IsMatch(file)) return false;
            name = file;
            return true;
        }

        private static string LocalFile(string source)
        {
            if (string.IsNullOrWhiteSpace(source)) return null;
            if (source.StartsWith("http", StringComparison.OrdinalIgnoreCase) || source.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return null;
            string clean = source.Split('?')[0].Replace('/', Path.DirectorySeparatorChar);
            if (Path.GetFileName(clean).StartsWith("nuricon", StringComparison.OrdinalIgnoreCase)) return null;
            if (!ImageExts.Contains(Path.GetExtension(clean))) return null;

            var candidates = new List<string>();
            if (Path.IsPathRooted(clean) && !clean.StartsWith(Path.DirectorySeparatorChar)) candidates.Add(clean);
            string rel = clean.TrimStart(Path.DirectorySeparatorChar);
            candidates.Add(Path.Combine(_appRoot, rel));
            candidates.Add(Path.Combine(_appRoot, "Assets", rel));
            candidates.Add(Path.Combine(_appRoot, "wwwroot", rel));
            candidates.Add(Path.Combine(DatabaseConfig.PartsImagesDirectory, Path.GetFileName(clean)));
            return candidates.FirstOrDefault(File.Exists);
        }

        /// <summary>File bytes as they will be stored on the hub (large photos shrunk), named by content hash.</summary>
        private static (string name, byte[] bytes) PreparePhoto(string path)
        {
            byte[] bytes = File.ReadAllBytes(path);
            if (bytes.Length == 0) return (null, null);
            string ext = Path.GetExtension(path).TrimStart('.').ToLowerInvariant();
            if (bytes.Length > ShrinkAboveBytes && ext is "jpg" or "jpeg" or "png")
            {
                byte[] smaller = Shrink(bytes);
                if (smaller != null && smaller.Length < bytes.Length)
                {
                    bytes = smaller;
                    ext = "jpg";
                }
            }
            if (bytes.Length > MaxUploadBytes) return (null, null);
            string name = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant().Substring(0, 32) + "." + ext;
            return (name, bytes);
        }

        private static byte[] Shrink(byte[] bytes)
        {
            try
            {
                using var input = new MemoryStream(bytes);
                using var img = Image.FromStream(input);
                double scale = Math.Min(1.0, 1600.0 / Math.Max(img.Width, img.Height));
                int w = Math.Max(1, (int)(img.Width * scale));
                int h = Math.Max(1, (int)(img.Height * scale));
                using var bmp = new Bitmap(w, h);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.Clear(Color.White);
                    g.DrawImage(img, 0, 0, w, h);
                }
                var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
                using var prms = new EncoderParameters(1);
                prms.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 85L);
                using var output = new MemoryStream();
                bmp.Save(output, codec, prms);
                return output.ToArray();
            }
            catch
            {
                return null;
            }
        }

        /// <summary>Uploads the photos behind these paths (only those the hub lacks) and returns path → shared path.</summary>
        private static async Task<Dictionary<string, string>> UploadFilesAsync(SqliteConnection conn, CloudConfig cfg, List<string> values, CancellationToken ct)
        {
            var result = new Dictionary<string, string>(StringComparer.Ordinal);
            var fresh = new List<(string value, string path, long size, long mtime, string name)>();
            foreach (string value in values)
            {
                string path = LocalFile(value);
                if (path == null) continue;
                var fi = new FileInfo(path);
                long mtime = fi.LastWriteTimeUtc.Ticks;
                string cached = CloudStore.Scalar(conn, null, "SELECT name FROM _sync_uploads WHERE path = @p0 AND size = @p1 AND mtime = @p2",
                    path, fi.Length, mtime)?.ToString();
                if (cached != null)
                {
                    result[value] = MediaFolder + cached;
                    continue;
                }
                var (name, _) = PreparePhoto(path);
                if (name == null)
                {
                    CloudStore.Log(conn, null, $"Photo {Path.GetFileName(path)} wasn't shared: it's empty or larger than 4 MB.");
                    continue;
                }
                fresh.Add((value, path, fi.Length, mtime, name));
            }
            if (fresh.Count == 0) return result;

            var missing = new HashSet<string>();
            foreach (var chunk in fresh.Select(f => f.name).Distinct().Chunk(100))
            {
                using var doc = await HubClient.SendAsync(HttpMethod.Get, cfg.Url, "/api/hub/files?names=" + string.Join(",", chunk), null, device: cfg, ct: ct);
                foreach (var m in doc.RootElement.GetProperty("missing").EnumerateArray()) missing.Add(m.GetString());
            }

            foreach (var f in fresh)
            {
                if (missing.Contains(f.name))
                {
                    var (name, bytes) = PreparePhoto(f.path);
                    if (name != f.name) continue; // file changed while we worked; the next pass picks it up
                    try
                    {
                        using var put = await HubClient.SendAsync(HttpMethod.Put, cfg.Url, "/api/hub/files",
                            new { name, data = Convert.ToBase64String(bytes) }, device: cfg, ct: ct);
                    }
                    catch (HubException ex) when (ex.Status == 413 || ex.Status == 400)
                    {
                        CloudStore.Log(conn, null, $"Photo {Path.GetFileName(f.path)} wasn't shared: {ex.Message}");
                        continue;
                    }
                    missing.Remove(f.name);
                }
                CloudStore.Exec(conn, null, "INSERT OR REPLACE INTO _sync_uploads (path, size, mtime, name) VALUES (@p0, @p1, @p2, @p3)",
                    f.path, f.size, f.mtime, f.name);
                result[f.value] = MediaFolder + f.name;
            }
            return result;
        }

        /// <summary>Fetches photos referenced by incoming rows that aren't on this laptop yet.</summary>
        private static async Task DownloadFilesAsync(SqliteConnection conn, CloudConfig cfg, IEnumerable<(string t, JsonElement d)> rows, CancellationToken ct)
        {
            var names = new HashSet<string>();
            foreach (var (t, d) in rows)
            {
                var table = SyncTables.Get(t);
                if (table == null || table.Files.Count == 0 || d.ValueKind != JsonValueKind.Object) continue;
                foreach (string col in table.Files)
                    if (d.TryGetProperty(col, out var v) && v.ValueKind == JsonValueKind.String && IsSharedPath(v.GetString(), out string name))
                        names.Add(name);
            }
            string retry = CloudStore.GetMeta(conn, null, "files_missing");
            if (!string.IsNullOrEmpty(retry)) foreach (string n in retry.Split(',').Take(20)) if (MediaName.IsMatch(n)) names.Add(n);
            if (names.Count == 0) return;

            Directory.CreateDirectory(MediaDirectory);
            var failed = new List<string>();
            int done = 0;
            foreach (string name in names)
            {
                string dest = Path.Combine(MediaDirectory, name);
                if (File.Exists(dest)) continue;
                byte[] bytes = null;
                try
                {
                    bytes = await HubClient.DownloadAsync(cfg.Url + "/media/" + name, ct);
                }
                catch (Exception) when (!ct.IsCancellationRequested) { /* retried next cycle */ }
                if (bytes == null || bytes.Length == 0)
                {
                    failed.Add(name);
                    continue;
                }
                string tmp = dest + ".part";
                await File.WriteAllBytesAsync(tmp, bytes, ct);
                File.Move(tmp, dest, overwrite: true);
                if (++done % 20 == 0) _phase = $"Downloading product photos ({done})";
            }
            CloudStore.SetMeta(conn, null, "files_missing", string.Join(",", failed.Take(500)));
        }

        // ---------------------------------------------------------------- website orders

        internal static string WebStatus(string stage) => stage switch
        {
            "Ready" => "PACKED",
            "OutForDelivery" or "ReadyForPickup" => "SHIPPED",
            "AwaitingFeedback" or "Completed" => "DELIVERED",
            "Cancelled" => "CANCELLED",
            _ => "CONFIRMED"
        };

        private static List<Dictionary<string, object>> PendingAcks(SqliteConnection conn, CloudConfig cfg)
        {
            var acks = new List<Dictionary<string, object>>();
            var rows = new List<(string number, long? lid, string error)>();
            using (var cmd = CloudStore.Command(conn, null,
                       "SELECT order_number, order_lid, error FROM _sync_web WHERE ack_sent = 0 AND (order_lid IS NOT NULL OR error IS NOT NULL) LIMIT 100"))
            using (var r = cmd.ExecuteReader())
                while (r.Read()) rows.Add((r.GetString(0), r.IsDBNull(1) ? null : r.GetInt64(1), r.IsDBNull(2) ? null : r.GetString(2)));

            foreach (var (number, lid, error) in rows)
            {
                if (lid != null)
                {
                    string gid = CloudStore.GidFor(conn, null, "orders", lid.Value, cfg.DeviceId, create: true);
                    acks.Add(new Dictionary<string, object> { ["orderNumber"] = number, ["ref"] = gid });
                }
                else acks.Add(new Dictionary<string, object> { ["orderNumber"] = number, ["error"] = error.Length > 480 ? error.Substring(0, 480) : error });
            }
            return acks;
        }

        private sealed class StatusUpdate
        {
            public string Number;
            public string Status;
            public bool Paid;
        }

        /// <summary>Website orders whose desktop progress changed since it was last reported (any laptop may report it).</summary>
        private static List<StatusUpdate> PendingStatuses(SqliteConnection conn)
        {
            var list = new List<StatusUpdate>();
            using var cmd = CloudStore.Command(conn, null, $@"
                SELECT l.order_number, o.order_id, o.fulfillment_stage, o.status, o.payment_status, w.pushed_status, w.pushed_paid
                FROM {CloudStore.WebLinksTable} l
                LEFT JOIN orders o ON o.order_id = l.order_id
                LEFT JOIN _sync_web w ON w.order_number = l.order_number
                WHERE l.order_id IS NOT NULL
                LIMIT 2000");
            using var r = cmd.ExecuteReader();
            while (r.Read() && list.Count < 200)
            {
                bool gone = r.IsDBNull(1);
                string stage = r.IsDBNull(2) ? "" : r.GetString(2);
                string orderStatus = r.IsDBNull(3) ? "" : r.GetString(3);
                if (orderStatus.Equals("Cancelled", StringComparison.OrdinalIgnoreCase)) stage = "Cancelled";
                string status = gone ? "CANCELLED" : WebStatus(stage);
                bool paid = !gone && !r.IsDBNull(4) && r.GetString(4).Equals("Paid", StringComparison.OrdinalIgnoreCase);
                string pushed = r.IsDBNull(5) ? null : r.GetString(5);
                bool pushedPaid = !r.IsDBNull(6) && r.GetInt64(6) == 1;
                if (status == pushed && paid == pushedPaid) continue;
                list.Add(new StatusUpdate { Number = r.GetString(0), Status = status, Paid = paid });
            }
            return list;
        }

        /// <summary>Creates desktop shop orders for website orders the hub handed to this laptop.</summary>
        private static int TakeWebOrders(SqliteConnection conn, JsonElement orders)
        {
            int created = 0;
            foreach (var o in orders.EnumerateArray())
            {
                string number = o.GetProperty("orderNumber").GetString();
                object linked = CloudStore.Scalar(conn, null, $"SELECT order_id FROM {CloudStore.WebLinksTable} WHERE order_number = @p0", number);
                long? existing = linked == null ? null : Convert.ToInt64(linked);
                if (existing != null)
                {
                    SaveWebResult(conn, number, existing, null, null, false);
                    continue;
                }

                var lines = new List<ShopOrderApi.ShopOrderLine>();
                string missing = null;
                foreach (var item in o.GetProperty("items").EnumerateArray())
                {
                    string partGid = item.GetProperty("partGid").GetString();
                    long? partId = CloudStore.LidFor(conn, null, "parts", partGid);
                    if (partId == null || !CloudStore.RowExists(conn, null, SyncTables.Get("parts"), partId.Value))
                    {
                        missing = $"{Str(item, "productName")} ({Str(item, "size")})";
                        break;
                    }
                    lines.Add(new ShopOrderApi.ShopOrderLine
                    {
                        PartId = (int)partId.Value,
                        Quantity = item.GetProperty("quantity").GetInt32(),
                        Price = item.GetProperty("price").GetDecimal()
                    });
                }
                if (missing != null)
                {
                    // Usually this laptop is still catching up; report it only if it persists.
                    long firstTry = CloudStore.Long(conn, null, "SELECT COALESCE(last_try, 0) FROM _sync_web WHERE order_number = @p0", number);
                    long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    if (firstTry == 0)
                        CloudStore.Exec(conn, null, "INSERT INTO _sync_web (order_number, last_try) VALUES (@p0, @p1) ON CONFLICT(order_number) DO UPDATE SET last_try = COALESCE(_sync_web.last_try, excluded.last_try)", number, now);
                    else if (now - firstTry > 30 * 60)
                        SaveWebResult(conn, number, null, $"Product not found on the desktop app: {missing}", null, false);
                    continue;
                }

                string address = string.Join(", ", new[] { Str(o, "address"), Str(o, "city"), Str(o, "region") }.Where(s => s.Length > 0));
                decimal deliveryFee = o.TryGetProperty("deliveryFee", out var fee) && fee.ValueKind == JsonValueKind.Number ? fee.GetDecimal() : 0;
                var notes = new StringBuilder("Website order " + number);
                if (deliveryFee > 0) notes.Append($" · delivery fee {deliveryFee:0.###} included in total");
                if (Str(o, "notes").Length > 0) notes.Append(" · ").Append(Str(o, "notes"));
                string payMethod = Str(o, "paymentMethod");
                bool paidOnline = (payMethod == "CARD" || payMethod == "WHISH") && Str(o, "paymentStatus") == "PAID";

                var (orderId, error) = ShopOrderApi.Create(new ShopOrderApi.ShopOrderPayload
                {
                    CustomerId = FindOrCreateCustomer(Str(o, "customerName"), Str(o, "customerPhone"), Str(o, "customerEmail"), address),
                    FulfillmentType = "Delivery",
                    Address = address.Length > 0 ? address : "—",
                    PaymentMethod = paidOnline ? "Card" : "OnDelivery",
                    IsPaid = paidOnline,
                    ExtraCharge = deliveryFee,
                    Notes = notes.ToString(),
                    Actor = "Website",
                    Items = lines
                });
                if (error != null)
                {
                    SaveWebResult(conn, number, null, error, null, false);
                    continue;
                }

                DatabaseHelper.ExecuteNonQuery(
                    $"INSERT INTO {CloudStore.WebLinksTable} (order_number, order_id) VALUES (@n, @id)",
                    new SqliteParameter("@n", number),
                    new SqliteParameter("@id", orderId));
                SaveWebResult(conn, number, orderId, null, "CONFIRMED", paidOnline);
                created++;
            }

            if (created > 0)
            {
                CloudStore.Log(conn, null, created == 1 ? "Took in 1 website order." : $"Took in {created} website orders.");
                RaiseChanged("New website order");
            }
            return created;
        }

        private static void SaveWebResult(SqliteConnection conn, string number, long? orderLid, string error, string pushedStatus, bool paid)
        {
            CloudStore.Exec(conn, null, @"
                INSERT INTO _sync_web (order_number, order_lid, ack_sent, error, pushed_status, pushed_paid)
                VALUES (@p0, @p1, 0, @p2, @p3, @p4)
                ON CONFLICT(order_number) DO UPDATE SET
                    order_lid = excluded.order_lid, ack_sent = 0, error = excluded.error,
                    pushed_status = COALESCE(excluded.pushed_status, _sync_web.pushed_status),
                    pushed_paid = COALESCE(excluded.pushed_paid, _sync_web.pushed_paid)",
                number, orderLid, error, pushedStatus, pushedStatus == null ? null : (paid ? 1 : 0));
        }

        private static string Str(JsonElement e, string prop) =>
            e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "").Trim() : "";

        private static int FindOrCreateCustomer(string name, string phone, string email, string address)
        {
            string digits = new string(phone.Where(char.IsDigit).ToArray());
            string tail = digits.Length > 8 ? digits.Substring(digits.Length - 8) : digits;
            if (tail.Length >= 6)
            {
                var rows = DatabaseHelper.ExecuteDataTable("SELECT customer_id, phone FROM customers WHERE COALESCE(phone,'') != '' AND date_deleted IS NULL");
                foreach (System.Data.DataRow row in rows.Rows)
                {
                    string p = new string((row["phone"]?.ToString() ?? "").Where(char.IsDigit).ToArray());
                    if (p.EndsWith(tail, StringComparison.Ordinal)) return Convert.ToInt32(row["customer_id"]);
                }
            }
            if (email.Length > 0)
            {
                int byEmail = DatabaseHelper.ExecuteScalar<int>(
                    "SELECT COALESCE(MAX(customer_id),0) FROM customers WHERE LOWER(COALESCE(email,'')) = LOWER(@e) AND date_deleted IS NULL",
                    new SqliteParameter("@e", email));
                if (byEmail > 0) return byEmail;
            }
            DatabaseHelper.ExecuteNonQuery(
                "INSERT INTO customers (full_name, phone, email, address, type) VALUES (@n, @p, @e, @a, 'Online')",
                new SqliteParameter("@n", name.Length > 0 ? name : "Website customer"),
                new SqliteParameter("@p", phone.Length > 0 ? phone : DBNull.Value),
                new SqliteParameter("@e", email.Length > 0 ? email : DBNull.Value),
                new SqliteParameter("@a", address));
            GlobalEvents.RaiseCustomersUpdated();
            return DatabaseHelper.ExecuteScalar<int>("SELECT MAX(customer_id) FROM customers");
        }

        // ---------------------------------------------------------------- status

        private static void RaiseChanged(string reason)
        {
            try
            {
                GlobalEvents.RaiseInventoryUpdated();
                GlobalEvents.RaiseOrdersUpdated();
                GlobalEvents.RaiseCustomersUpdated();
                GlobalEvents.RaiseSuppliersUpdated();
            }
            catch { /* UI listeners must never break sync */ }
            _ = InventoryBroadcaster.Broadcast("InventoryChanged", reason);
        }

        public static object Status()
        {
            var cfg = CloudConfig.Load();
            long outbox = 0, waiting = 0, links = 0;
            var log = new List<object>();
            try
            {
                using var conn = CloudStore.Open();
                if (CloudStore.HasSyncTables(conn))
                {
                    outbox = CloudStore.Long(conn, null, "SELECT COUNT(*) FROM _sync_outbox");
                    waiting = CloudStore.Long(conn, null, "SELECT COUNT(*) FROM _sync_pending");
                    links = CloudStore.Long(conn, null, $"SELECT COUNT(*) FROM {CloudStore.WebLinksTable}");
                    using var cmd = CloudStore.Command(conn, null, "SELECT at, message FROM _sync_log ORDER BY id DESC LIMIT 8");
                    using var r = cmd.ExecuteReader();
                    while (r.Read()) log.Add(new { at = r.GetString(0), message = r.GetString(1) });
                }
            }
            catch { /* status must always render */ }

            return new
            {
                linked = cfg.IsLinked,
                url = cfg.Url,
                machineName = Environment.MachineName,
                deviceName = cfg.DeviceName,
                deviceId = cfg.DeviceId,
                role = cfg.Role,
                founded = cfg.Founded,
                needsSnapshot = cfg.NeedsSnapshot,
                revoked = cfg.Revoked,
                connectedAt = cfg.ConnectedAt,
                hubState = _hubState,
                busy = Busy,
                phase = _phase,
                progressDone = _progressDone,
                progressTotal = _progressTotal,
                pending = outbox,
                waiting,
                webOrders = links,
                lastSync = _lastSuccess?.ToString("yyyy-MM-dd HH:mm:ss"),
                lastError = _lastError,
                log
            };
        }
    }
}
