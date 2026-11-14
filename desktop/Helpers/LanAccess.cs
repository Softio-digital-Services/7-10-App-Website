using System;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;

namespace InventorySystem.Helpers
{
    /// <summary>
    /// Who may use this PC's server. The desktop window itself (this computer) is trusted. Phones / tablets /
    /// laptops on the shop Wi-Fi must sign in first and then carry a session cookie. Anything from outside the
    /// private network is refused, even if a router were to forward the port to the internet.
    /// </summary>
    public static class LanAccess
    {
        private const string CookieName = "st_lan";
        private static readonly TimeSpan SessionLife = TimeSpan.FromHours(12);
        private static readonly ConcurrentDictionary<string, DateTime> Sessions = new();

        // What the sign-in screen needs before anyone has signed in
        private static readonly string[] OpenPaths = { "/api/login", "/api/config", "/api/brand", "/api/license" };

        public static bool IsThisComputer(HttpContext ctx) =>
            ctx.Connection.RemoteIpAddress is IPAddress ip && IPAddress.IsLoopback(ip);

        /// <summary>Private / local network addresses only (home and shop Wi-Fi, phone hotspots).</summary>
        public static bool IsPrivateNetwork(IPAddress ip)
        {
            if (ip == null) return false;
            if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
            if (IPAddress.IsLoopback(ip)) return true;
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                byte[] b = ip.GetAddressBytes();
                return b[0] == 10
                    || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
                    || (b[0] == 192 && b[1] == 168)
                    || (b[0] == 169 && b[1] == 254);
            }
            return ip.IsIPv6LinkLocal || ip.IsIPv6UniqueLocal;
        }

        private static bool NeedsSession(string path) =>
            (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/hubs/", StringComparison.OrdinalIgnoreCase))
            && Array.FindIndex(OpenPaths, p => path.Equals(p, StringComparison.OrdinalIgnoreCase)) < 0;

        private static bool HasSession(HttpContext ctx)
        {
            if (!ctx.Request.Cookies.TryGetValue(CookieName, out string token) || string.IsNullOrEmpty(token)) return false;
            if (!Sessions.TryGetValue(token, out DateTime expires)) return false;
            if (expires < DateTime.UtcNow) { Sessions.TryRemove(token, out _); return false; }
            Sessions[token] = DateTime.UtcNow + SessionLife; // sliding: stays signed in while in use
            return true;
        }

        private static void IssueSession(HttpContext ctx)
        {
            string token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            Sessions[token] = DateTime.UtcNow + SessionLife;
            ctx.Response.Cookies.Append(CookieName, token, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Strict,
                Path = "/",
                MaxAge = SessionLife
            });
            // Drop expired sessions now and then
            if (Sessions.Count > 200)
                foreach (var kv in Sessions)
                    if (kv.Value < DateTime.UtcNow) Sessions.TryRemove(kv.Key, out _);
        }

        public static void EndSession(HttpContext ctx)
        {
            if (ctx.Request.Cookies.TryGetValue(CookieName, out string token) && token != null) Sessions.TryRemove(token, out _);
            ctx.Response.Cookies.Delete(CookieName, new CookieOptions { Path = "/" });
        }

        /// <summary>Middleware: returns false when the request was refused (the response is already written).</summary>
        public static bool Admit(HttpContext ctx)
        {
            if (IsThisComputer(ctx)) return true;
            if (!IsPrivateNetwork(ctx.Connection.RemoteIpAddress))
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return false;
            }
            string path = ctx.Request.Path.Value ?? "";
            if (NeedsSession(path) && !HasSession(ctx))
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                ctx.Response.ContentType = "application/json";
                return false;
            }
            if (path.Equals("/api/login", StringComparison.OrdinalIgnoreCase) && HttpMethods.IsPost(ctx.Request.Method))
            {
                ctx.Response.OnStarting(() =>
                {
                    if (ctx.Response.StatusCode == StatusCodes.Status200OK) IssueSession(ctx);
                    return System.Threading.Tasks.Task.CompletedTask;
                });
            }
            return true;
        }
    }
}
