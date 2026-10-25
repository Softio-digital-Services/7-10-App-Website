# 7-10 Inventory (Desktop App)

Windows inventory + POS app for **7-10 Store**. Runs standalone with local SQLite — website sync comes later.

## Features

- Dashboard with sales KPIs
- Product inventory (clothing: SKU, category, stock, price, images)
- Point of Sale (POS)
- Customers & suppliers
- Orders, returns, quotations
- Reports & expenses
- User roles (admin/staff)
- Backup & restore
- Web UI inside the app (same Wi‑Fi connect via QR)

## Requirements

- Windows 10+ (64-bit)
- [.NET 8 SDK](https://dotnet.microsoft.com/download) to build from source
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (usually preinstalled)

## Run from source

```powershell
cd desktop
dotnet restore
dotnet run -c Release --project SevenTenProductsManagementSystem.csproj
```

Or open `SevenTenProductsManagementSystem.slnx` in Visual Studio and press F5.

## Default login

Seeded admin account (change after first login):

- **User:** `Softio.Admin`
- **Password:** `Softio@2026!`

## Data location

SQLite database and images are stored at:

```
%LocalAppData%\SevenTenInventory\Data\inventory.db
```

Backups: `%LocalAppData%\SevenTenInventory\Backups\`

## Branding

Configured in `appsettings.json`:

- App name: **7-10 Inventory**
- Primary color: **#7A754F** (olive, from the 7.10 logo)
- HTTP port: **5020** (so it can run alongside other local builds)

## Publish executable

```powershell
cd desktop
.\publish.bat
```

Output: `dist\app\SevenTenInventorySystem.exe`

## Releasing an update

Installed apps check for updates on launch and show an update icon in the title bar. An admin clicks **Update now** and the app takes it from there:

1. It downloads the new setup file and verifies its checksum.
2. It backs up the database.
3. It runs setup, which upgrades in place, then closes and reopens itself.

To ship a new version:

1. Bump the version in `Properties\AssemblyInfo.cs` (all three lines, e.g. `2.1.0`).
2. Write what changed in `installer\release-notes.txt`.
3. Run `.\publish.bat`. It creates `dist\SevenTenSetup.exe` and `dist\latest.json`.
4. On GitHub go to **Releases → Draft a new release**, use tag `v2.1.0`, attach **both** files, and publish it (not as a pre-release).

The app reads `Updates.ManifestUrl` in `appsettings.json`, which points to the latest GitHub release's `latest.json`. To host updates somewhere else, change that URL and upload both files to the same folder.

**Offline PCs:** copy `SevenTenSetup.exe` to the PC and either run it, or use **About → Check for updates → Install from file…**.

**Data safety:**
- Everything the shop owns stays in `%LocalAppData%\SevenTenInventory`, so setup never touches it. This covers the database, license, cloud-sync settings and backups.
- Product images in the install folder are also kept, because setup only replaces files it ships.
- On the first start of every new version, the database is snapshotted before migrations run, as `Backups\backup_pre-update_<old>_to_<new>_*.db`. The last 5 are kept, and each can be restored from the Backup window.
- Schema changes must stay additive and idempotent: add them to `DatabaseHelper.EnsureSchema` with `if (!ColumnExists(...)) ALTER TABLE ... ADD COLUMN`. Never drop or rename a column that older data uses.
- Never change `AppId` in `installer\7-10.iss`. Setup uses it to find and upgrade the existing install.

## Clothing store tips

- Use **Categories** for Tops, Bottoms, Dresses, Outerwear, etc.
- Use **SKU** for product codes (e.g. `710-TEE-001`)
- Use **Location/Shelf** for warehouse rack labels
- **Min Stock** triggers low-stock awareness in dashboard

## Website sync (later)

When ready, this app will connect to the 7-10 website at `web/` via `/api/desktop/*` endpoints. Not enabled in this phase.

## Project structure

```
desktop/
├── Forms/           WinForms host + dialogs
├── wwwroot/         In-app web UI (inventory, POS, reports)
├── Services/        Business logic
├── Helpers/         DB, theme, license, print
├── Program.cs       Entry + embedded ASP.NET API
└── appsettings.json   7-10 branding
```
