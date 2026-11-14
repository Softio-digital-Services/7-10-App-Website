# Host the 7.10 website for free

The store runs on a Next.js site; the shop's admin PC (the desktop app) is the only home of the business data. This setup costs nothing and is allowed for a real shop (Vercel Hobby is not).

| Piece | Service | Free plan |
|---|---|---|
| Website | [Netlify](https://www.netlify.com) | 300 credits / month |
| Database | [Turso](https://turso.tech) | libSQL / SQLite, 9 GB |

**What the website holds:** the public catalogue (products, prices, photos, promotions, site content), availability shown as *in stock / only a few left / sold out*, and its own website orders and customer accounts. **What never leaves the admin PC:** sales, costs, profit, expenses, suppliers, purchase orders, payments, staff logins, the shop's customer list and exact stock. The website refuses such data even if it were sent.

The admin PC publishes the catalogue and fetches website orders; the website cannot reach into the PC. While the PC is offline the website keeps selling from the last catalogue (holding back 1 unit per item for the shop, and never more than 10 of an item), and new orders wait until the PC is back online.

## 1. Create the Turso database

1. Install the CLI and sign in: `npm i -g @turso/cli` then `turso auth login`.
2. `turso db create seventen`
3. `turso db tokens create seventen` — copy the token.
4. `turso db show seventen --url` — copy the `libsql://…` URL.

## 2. Push the schema

From the `web` folder, with the two values from step 1:

```bash
set DATABASE_URL=libsql://YOUR-DB.turso.io
set DATABASE_AUTH_TOKEN=YOUR-TOKEN
npm run db:deploy
```

On macOS / Linux use `export` instead of `set`.

## 3. Deploy on Netlify

1. Push this repository to GitHub (or connect the local folder).
2. In Netlify: **Add new site → Import** and choose the repo.
3. Leave **Base directory** empty. The `netlify.toml` at the repository root sets it to `web` and has the build command and Node version. (If you type `web` in the UI, Netlify looks for `web/netlify.toml` instead and ignores the root file.)
4. Site settings → **Environment variables** — add all of the following, then trigger a deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the `libsql://…` URL |
| `DATABASE_AUTH_TOKEN` | the Turso token |
| `SHOP_SYNC_KEY` | a long random string (32+ characters; shorter keys are refused). Paste the same value into the desktop app. |
| `AUTH_SECRET` | another long random string (`openssl rand -base64 32`) |
| `AUTH_URL` | `https://YOUR-SITE.netlify.app` (or your domain) |
| `AUTH_TRUST_HOST` | `true` |
| `NEXT_PUBLIC_SITE_URL` | the same public URL as `AUTH_URL` |
| `STORE_MODE` | `live` when you want orders; `soon` for the countdown page |

Optional: `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, SMTP settings, `ADMIN_EMAIL`, `SHOP_TIMEZONE` (promotions start/end at midnight in this timezone; default `Asia/Beirut`).

WhatsApp alert to the brand for every website order (choose one; with neither set, no message is sent and orders still work):

| Variable | Value |
|---|---|
| `CALLMEBOT_APIKEY` | Free, for alerts to your own number. From the brand's WhatsApp, send `I allow callmebot to send me messages` to the CallMeBot number listed on [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/); it replies with your API key. |
| `WHATSAPP_CLOUD_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` | Meta's official WhatsApp Cloud API (WhatsApp Business). Alerts to a number that hasn't written to your business number in the last 24 h need an approved template: set `WHATSAPP_CLOUD_TEMPLATE` (one body variable) and optionally `WHATSAPP_CLOUD_TEMPLATE_LANG`. |
| `WHATSAPP_NOTIFY_TO` | Optional. The number that receives the alerts; defaults to the brand WhatsApp number from `SystemBranding`. |

Brand name and contact details (WhatsApp, Instagram, email, phone, address) are not environment variables: edit `SystemBranding` in `desktop/appsettings.json`. The build copies them into the site automatically.

Whish Money (needed for “Pay by Whish”):

| Variable | Value |
|---|---|
| `WHISH_CHANNEL` | channel id from your Whish merchant account |
| `WHISH_SECRET` | secret from the same account |
| `WHISH_WEBSITE_URL` | the public site URL Whish registered (usually the same as `NEXT_PUBLIC_SITE_URL`) |
| `WHISH_ENV` | `sandbox` while testing, `production` when live. Empty means sandbox. Scope the `WHISH_*` variables to the **Production** deploy context only, so preview deploys never take real payments. |

Whish must be able to reach this site over HTTPS. Localhost cannot receive their payment callbacks.

5. Create the store admin account from the `web` folder, with the same `DATABASE_URL` and `DATABASE_AUTH_TOKEN` as step 2:

   ```bash
   npm run admin:create -- you@example.com
   ```

   It asks for a password (12+ characters). If that email already has a customer account, add `--reset` to set a new password and make it the admin. Do not run `npm run db:seed` against the live database: it is for local demo data only and refuses hosted databases.

6. Open `https://YOUR-SITE.netlify.app/login`, sign in with that account, then open **Admin → Laptops**.

## 4. Link the admin PC

Only the shop's admin PC links to the website:

1. Settings → **Website link**.
2. Website address: `https://YOUR-SITE.netlify.app`
3. Shop sync key: the `SHOP_SYNC_KEY` value.
4. **Check connection**, then **Publish to website**.
5. Wait until the card says **Linked**. The website catalogue fills in from the PC's products.

Other devices in the shop (phones, tablets, other laptops) use the admin PC over the shop Wi-Fi through the app's built-in web access (QR code in the app). They must sign in; devices outside the shop's network are refused.

Website orders appear on the admin PC within seconds of it being online, and its stock is updated then.

**Upgrading from an older version** (which also stored business data on the website): after deploying, run `npm run hub:purge` once against the production database (with `DATABASE_URL` / `DATABASE_AUTH_TOKEN` set). On the admin PC, click **Disconnect**, then **Publish to website** again so the catalogue is republished with availability.

## 5. Keep it inside the free limits

- Leave the desktop app open on the admin PC during shop hours. It syncs on its own; **Sync now** is only for a forced pass.
- Photos larger than about 1.5 MB are shrunk before upload (4 MB hard cap).
- Netlify pauses the site if the monthly 300 credits run out. One laptop syncing every few seconds while you work is fine; dozens of idle browsers hitting admin pages is what burns credits.
- Do not point `DATABASE_URL` at Vercel Postgres or a paid host unless you choose to.

## Local development

```bash
cd web
copy .env.example .env
# set SHOP_SYNC_KEY and AUTH_SECRET in .env
npx prisma migrate dev
npm run dev -- -p 3100
```

A second copy of the desktop app on the same PC uses its own data folder:

```
set SEVENTEN_DATA_DIR=%TEMP%\710-laptop-b
SevenTenInventorySystem.exe --cloud connect http://localhost:3100 YOUR-KEY "Laptop B" join
```
