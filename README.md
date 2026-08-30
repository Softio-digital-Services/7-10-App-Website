# 7-10 Clothing Store

Two parts of the same business (sync between them comes later):

| Folder | What it is |
|---|---|
| **`desktop/`** | **7-10 Inventory** — Windows POS + inventory app (Otargi-based) |
| **`web/`** | **7-10 Store** — Public online shop (Next.js) |

---

## Desktop app (inventory + POS) — start here

```powershell
cd desktop
dotnet restore
dotnet run -c Release --project OtargiInventorySystem.csproj
```

See [desktop/README.md](desktop/README.md) for full details.

- Local database: `%LocalAppData%\SevenTenInventory\`
- Branding: amber **#FFB400**, app name **7-10 Inventory**
- Default login: `Softio.Admin` / `Softio@2026!`

---

## Website (online shop)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

See [web/.env.example](web/.env.example) for Google OAuth, Gmail SMTP, and Otargi API key (for future sync).

### Demo web accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Admin123! |
| Manager | manager@example.com | Admin123! |

---

## Roadmap

1. **Now:** Use desktop app for daily shop operations (stock, POS, reports)
2. **Later:** Connect desktop ↔ website so online orders and in-store sales share one catalog

Website already has `/api/otargi/*` endpoints ready for when you enable sync.

---

## Project structure

```
7-10-App-Website/
├── desktop/     # 7-10 Inventory (Windows, C# / .NET 8)
└── web/         # 7-10 Store website (Next.js)
```
