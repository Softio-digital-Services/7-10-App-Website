# 7-10 Inventory (Desktop App)

Windows inventory + POS app for **7-10 Store**, based on Otargi. Runs standalone with local SQLite — website sync comes later.

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
dotnet run -c Release --project OtargiInventorySystem.csproj
```

Or open `OtargiInventorySystem.slnx` in Visual Studio and press F5.

## Default login

Same as Otargi seed (change after first login):

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
- Primary color: **#FFB400** (amber, matches BTB/7-10 store)
- HTTP port: **5020** (so it can run alongside Otargi on 5010)

## Publish executable

```powershell
cd desktop
.\publish.bat
```

Output: `dist\app\SevenTenInventorySystem.exe`

## Clothing store tips

- Use **Categories** for Tops, Bottoms, Dresses, Outerwear, etc.
- Use **SKU** for product codes (e.g. `710-TEE-001`)
- Use **Location/Shelf** for warehouse rack labels
- **Min Stock** triggers low-stock awareness in dashboard

## Website sync (later)

When ready, this app will connect to the 7-10 website at `web/` via `/api/otargi/*` endpoints. Not enabled in this phase.

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
