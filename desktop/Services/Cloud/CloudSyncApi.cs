using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using InventorySystem.Helpers;

namespace InventorySystem.Services.Cloud
{
    /// <summary>Endpoints behind the "Cloud sync" card in Settings.</summary>
    public static class CloudSyncApi
    {
        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        private sealed class LinkPayload
        {
            public string Url { get; set; }
            public string ShopKey { get; set; }
            public string Name { get; set; }
            public string Mode { get; set; }
        }

        public static void Map(WebApplication app)
        {
            app.MapGet("/api/cloud", () => Results.Ok(CloudSync.Status()));

            app.MapPost("/api/cloud/check", async (HttpRequest request) =>
            {
                var body = await JsonSerializer.DeserializeAsync<LinkPayload>(request.Body, JsonOpts);
                if (string.IsNullOrWhiteSpace(body?.Url) || string.IsNullOrWhiteSpace(body.ShopKey))
                    return Results.BadRequest(new { error = "Enter the website address and the shop sync key." });
                try
                {
                    var hub = await CloudSync.CheckAsync(body.Url, body.ShopKey);
                    return Results.Ok(new { state = hub.State, devices = hub.Devices });
                }
                catch (HubException ex)
                {
                    return Results.BadRequest(new { error = ex.Message, code = ex.Code });
                }
            });

            app.MapPost("/api/cloud/connect", async (HttpRequest request) =>
            {
                var body = await JsonSerializer.DeserializeAsync<LinkPayload>(request.Body, JsonOpts);
                if (string.IsNullOrWhiteSpace(body?.Url) || string.IsNullOrWhiteSpace(body.ShopKey))
                    return Results.BadRequest(new { error = "Enter the website address and the shop sync key." });
                if (body.Mode != "create" && body.Mode != "join")
                    return Results.BadRequest(new { error = "Choose whether this laptop creates the shop or joins it." });
                try
                {
                    await CloudSync.ConnectAsync(body.Url, body.ShopKey, body.Name, body.Mode == "create");
                    return Results.Ok(CloudSync.Status());
                }
                catch (HubException ex)
                {
                    return Results.BadRequest(new { error = ex.Message, code = ex.Code });
                }
                catch (InvalidOperationException ex)
                {
                    return Results.BadRequest(new { error = ex.Message });
                }
            });

            app.MapPost("/api/cloud/sync", async () =>
            {
                if (!CloudSync.IsLinked) return Results.BadRequest(new { error = "This laptop isn't linked to the shop yet." });
                await CloudSync.RunAsync(manual: true);
                return Results.Ok(CloudSync.Status());
            });

            app.MapPost("/api/cloud/disconnect", async () =>
            {
                await CloudSync.DisconnectAsync();
                return Results.Ok(CloudSync.Status());
            });
        }
    }

    /// <summary>Syncs in the background: within seconds of a local change, and on a slowing timer when the shop is quiet.</summary>
    public sealed class CloudSyncBackgroundService : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(6), stoppingToken); }
            catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var cfg = CloudConfig.Load();
                    if (cfg.IsLinked && !cfg.Revoked && !CloudSync.Busy)
                    {
                        var wait = CloudSync.NextDelay(CloudSync.HasLocalChanges());
                        if (DateTime.Now - CloudSync.LastAttempt >= wait)
                            await CloudSync.RunAsync(manual: false, stoppingToken);
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex) { ErrorLogger.LogError(ex, "CloudSyncBackgroundService"); }

                try { await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }
    }

    /// <summary>
    /// Headless use for support and testing: SevenTenInventorySystem.exe --cloud status|sync|connect &lt;url&gt; &lt;key&gt; &lt;name&gt; create|join|disconnect.
    /// Combine with SEVENTEN_DATA_DIR to run a second "laptop" on the same PC.
    /// </summary>
    internal static class CloudSyncCli
    {
        public static int Run(string[] args)
        {
            try
            {
                DatabaseInitializer.Initialize();
                DatabaseHelper.EnsureSchema();
                CloudSync.Startup(Program.ResolveAppRoot());

                var rest = args.SkipWhile(a => !a.Equals("--cloud", StringComparison.OrdinalIgnoreCase)).Skip(1).ToArray();
                string command = rest.FirstOrDefault()?.ToLowerInvariant() ?? "status";
                bool ok = true;
                switch (command)
                {
                    case "connect":
                        if (rest.Length < 5) throw new ArgumentException("connect <url> <shopKey> <name> create|join");
                        CloudSync.ConnectAsync(rest[1], rest[2], rest[3], rest[4] == "create", startSync: false).GetAwaiter().GetResult();
                        ok = CloudSync.RunAsync(manual: true).GetAwaiter().GetResult();
                        break;
                    case "sync":
                        ok = CloudSync.RunAsync(manual: true).GetAwaiter().GetResult();
                        break;
                    case "disconnect":
                        CloudSync.DisconnectAsync().GetAwaiter().GetResult();
                        break;
                }
                Console.WriteLine(JsonSerializer.Serialize(CloudSync.Status(), new JsonSerializerOptions { WriteIndented = true }));
                return ok ? 0 : 1;
            }
            catch (Exception ex)
            {
                Console.WriteLine("CLOUD ERROR: " + ex.Message);
                return 2;
            }
        }
    }
}
