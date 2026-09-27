using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace InventorySystem.Services.Cloud
{
    /// <summary>This laptop's link to the shop hub. Lives next to the database, outside it, so a restored backup can be detected.</summary>
    internal sealed class CloudConfig
    {
        public string Url { get; set; }
        public string DeviceId { get; set; }
        public string DeviceName { get; set; }
        /// <summary>"founder" uploaded the shop's data first; "member" joined by downloading it.</summary>
        public string Role { get; set; }
        public bool Founded { get; set; }
        public bool NeedsSnapshot { get; set; }
        public bool Revoked { get; set; }
        public long LastPushedSeq { get; set; }
        public string ConnectedAt { get; set; }
        [JsonPropertyName("token")] public string ProtectedToken { get; set; }
        [JsonPropertyName("secret")] public string ProtectedSecret { get; set; }

        [JsonIgnore] public string Token { get => Unprotect(ProtectedToken); set => ProtectedToken = Protect(value); }
        [JsonIgnore] public string Secret { get => Unprotect(ProtectedSecret); set => ProtectedSecret = Protect(value); }
        [JsonIgnore] public bool IsLinked => !string.IsNullOrEmpty(Url) && !string.IsNullOrEmpty(DeviceId) && !string.IsNullOrEmpty(ProtectedToken);
        [JsonIgnore] public bool IsFounder => Role == "founder";
        /// <summary>Allowed to take in website orders: the shop's data is complete on the hub.</summary>
        [JsonIgnore] public bool CanClaim => !NeedsSnapshot && (!IsFounder || Founded);

        private static readonly object FileLock = new();
        private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        public static string FilePath => Path.Combine(DatabaseConfig.UserDataDirectory, "cloud-sync.json");

        public static CloudConfig Load()
        {
            lock (FileLock)
            {
                try
                {
                    if (!File.Exists(FilePath)) return new CloudConfig();
                    return JsonSerializer.Deserialize<CloudConfig>(File.ReadAllText(FilePath), JsonOpts) ?? new CloudConfig();
                }
                catch
                {
                    return new CloudConfig();
                }
            }
        }

        public void Save()
        {
            lock (FileLock)
            {
                string tmp = FilePath + ".tmp";
                File.WriteAllText(tmp, JsonSerializer.Serialize(this, JsonOpts));
                File.Move(tmp, FilePath, overwrite: true);
            }
        }

        public static void Delete()
        {
            lock (FileLock)
            {
                if (File.Exists(FilePath)) File.Delete(FilePath);
            }
        }

        private static string Protect(string plain)
        {
            if (string.IsNullOrEmpty(plain)) return null;
            byte[] data = ProtectedData.Protect(Encoding.UTF8.GetBytes(plain), null, DataProtectionScope.CurrentUser);
            return "dpapi:" + Convert.ToBase64String(data);
        }

        private static string Unprotect(string stored)
        {
            if (string.IsNullOrEmpty(stored)) return null;
            if (!stored.StartsWith("dpapi:", StringComparison.Ordinal)) return stored;
            try
            {
                byte[] data = ProtectedData.Unprotect(Convert.FromBase64String(stored.Substring(6)), null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(data);
            }
            catch
            {
                return null;
            }
        }
    }

    internal sealed class HubException : Exception
    {
        public int Status { get; }
        public string Code { get; }

        public HubException(int status, string code, string message) : base(message)
        {
            Status = status;
            Code = code;
        }
    }

    internal static class HubClient
    {
        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(75) };
        /// <summary>Null properties are dropped (the hub's optional fields reject null); dictionary entries keep their nulls.</summary>
        private static readonly JsonSerializerOptions BodyOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        public static string AppVersion =>
            typeof(HubClient).Assembly.GetName().Version?.ToString() ?? "1.0";

        public static string NormalizeUrl(string url)
        {
            string u = (url ?? "").Trim().TrimEnd('/');
            if (u.Length > 0 && !u.Contains("://")) u = "https://" + u;
            return u;
        }

        public static async Task<JsonDocument> SendAsync(HttpMethod method, string baseUrl, string path, object body,
            CloudConfig device = null, string shopKey = null, CancellationToken ct = default)
        {
            using var req = new HttpRequestMessage(method, baseUrl + path);
            if (device != null)
            {
                req.Headers.Add("x-device-id", device.DeviceId);
                req.Headers.Add("x-device-token", device.Token ?? "");
            }
            if (shopKey != null) req.Headers.Add("x-shop-key", shopKey);
            if (body != null) req.Content = JsonContent.Create(body, body.GetType(), options: BodyOpts);

            HttpResponseMessage res;
            try
            {
                res = await Http.SendAsync(req, HttpCompletionOption.ResponseContentRead, ct);
            }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested)
            {
                throw new HubException(0, "timeout", "The shop website took too long to answer.");
            }
            catch (HttpRequestException ex)
            {
                throw new HubException(0, "offline", "Couldn't reach the shop website (" + ex.Message + ").");
            }

            using (res)
            {
                string text = await res.Content.ReadAsStringAsync(ct);
                if (res.IsSuccessStatusCode)
                    return JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? "{}" : text);

                string code = "";
                try
                {
                    using var err = JsonDocument.Parse(text);
                    if (err.RootElement.TryGetProperty("error", out var e)) code = e.GetString() ?? "";
                }
                catch { /* not JSON, e.g. an HTML error page */ }
                throw new HubException((int)res.StatusCode, code, Describe((int)res.StatusCode, code, text));
            }
        }

        public static async Task<byte[]> DownloadAsync(string url, CancellationToken ct)
        {
            using var res = await Http.GetAsync(url, ct);
            if (!res.IsSuccessStatusCode) return null;
            return await res.Content.ReadAsByteArrayAsync(ct);
        }

        private static string Describe(int status, string code, string text) => code switch
        {
            "bad_shop_key" => "The shop sync key is wrong. Copy SHOP_SYNC_KEY from the website settings.",
            "not_configured" => "The website has no SHOP_SYNC_KEY set yet. Add it in the hosting settings and redeploy.",
            "bad_device" or "no_device" => "The website no longer recognises this laptop. Disconnect and link it again.",
            "device_revoked" => "This laptop was unlinked from the shop on the website. Disconnect and link it again if that was a mistake.",
            "shop_exists" => "This website already has a shop. Choose \"Join the shop\" instead.",
            "shop_empty" => "The website has no shop data yet. Link the main laptop first with \"Create the shop\".",
            "shop_founding" => "The first laptop is still uploading the shop's data. Try again once it finishes.",
            "shop_not_ready" => "The shop is still being set up by the first laptop.",
            "too_large" => "A photo is too large to upload (4 MB maximum).",
            _ => $"The shop website answered {status}{(code.Length > 0 ? " (" + code + ")" : "")}: {Trim(text)}"
        };

        private static string Trim(string s)
        {
            s = (s ?? "").Replace('\n', ' ').Trim();
            return s.Length > 160 ? s.Substring(0, 160) + "…" : s;
        }
    }

    /// <summary>AES-GCM with a key derived from the shop secret every linked laptop receives.</summary>
    internal static class CloudCrypto
    {
        private static byte[] Key(string secret) => SHA256.HashData(Encoding.UTF8.GetBytes("7.10 cloud columns|" + (secret ?? "")));

        public static string Encrypt(string plain, string secret)
        {
            byte[] key = Key(secret);
            byte[] nonce = RandomNumberGenerator.GetBytes(12);
            byte[] data = Encoding.UTF8.GetBytes(plain ?? "");
            byte[] cipher = new byte[data.Length];
            byte[] tag = new byte[16];
            using (var aes = new AesGcm(key, 16)) aes.Encrypt(nonce, data, cipher, tag);
            byte[] packed = new byte[12 + 16 + cipher.Length];
            Buffer.BlockCopy(nonce, 0, packed, 0, 12);
            Buffer.BlockCopy(tag, 0, packed, 12, 16);
            Buffer.BlockCopy(cipher, 0, packed, 28, cipher.Length);
            return Convert.ToBase64String(packed);
        }

        public static string Decrypt(string packedBase64, string secret)
        {
            byte[] packed = Convert.FromBase64String(packedBase64);
            if (packed.Length < 28) throw new CryptographicException("Encrypted value is too short.");
            byte[] cipher = new byte[packed.Length - 28];
            byte[] plain = new byte[cipher.Length];
            Buffer.BlockCopy(packed, 28, cipher, 0, cipher.Length);
            using (var aes = new AesGcm(Key(secret), 16))
                aes.Decrypt(packed.AsSpan(0, 12), cipher, packed.AsSpan(12, 16), plain);
            return Encoding.UTF8.GetString(plain);
        }
    }
}
