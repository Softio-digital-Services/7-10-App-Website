# Host the 7.10 website for free

The store and the laptop hub run on the same Next.js site. This setup costs nothing and is allowed for a real shop (Vercel Hobby is not).

| Piece | Service | Free plan |
|---|---|---|
| Website | [Netlify](https://www.netlify.com) | 300 credits / month |
| Database | [Turso](https://turso.tech) | libSQL / SQLite, 9 GB |

Every linked laptop is equal. The website is only the meeting point: it stores the change log, product photos, and website orders.

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
3. Set **Base directory** to `web`. The `netlify.toml` in that folder already has the build command.
4. Site settings → **Environment variables** — add all of the following, then trigger a deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the `libsql://…` URL |
| `DATABASE_AUTH_TOKEN` | the Turso token |
| `SHOP_SYNC_KEY` | a long random string (32+ characters). Paste the same value into the desktop app. |
| `AUTH_SECRET` | another long random string (`openssl rand -base64 32`) |
| `AUTH_URL` | `https://YOUR-SITE.netlify.app` (or your domain) |
| `AUTH_TRUST_HOST` | `true` |
| `NEXT_PUBLIC_SITE_URL` | the same public URL as `AUTH_URL` |
| `STORE_MODE` | `live` when you want orders; `soon` for the countdown page |

Optional: `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, SMTP settings, `ADMIN_EMAIL`, `NEXT_PUBLIC_WHATSAPP`.

Whish Money (needed for “Pay by Whish”):

| Variable | Value |
|---|---|
| `WHISH_CHANNEL` | channel id from your Whish merchant account |
| `WHISH_SECRET` | secret from the same account |
| `WHISH_WEBSITE_URL` | the public site URL Whish registered (usually the same as `NEXT_PUBLIC_SITE_URL`) |
| `WHISH_ENV` | `sandbox` while testing, `production` when live |

Whish must be able to reach this site over HTTPS. Localhost cannot receive their payment callbacks.

5. After the first deploy, open `https://YOUR-SITE.netlify.app`. Create the store admin account, then open **Admin → Laptops**.

## 4. Link the desktop app

On the first laptop (the one that already has the shop's products):

1. Settings → **Cloud sync**.
2. Website address: `https://YOUR-SITE.netlify.app`
3. Shop sync key: the `SHOP_SYNC_KEY` value.
4. Name this laptop, **Check connection**, then **Create the shop**.
5. Wait until the card says **Linked**. The website catalogue fills in from this laptop's data.

On every other laptop:

1. Same address and key.
2. **Check connection** → **Join the shop**.
3. Confirm. That laptop's local products and staff logins are replaced with the shop's. A backup is written under `%LocalAppData%\SevenTenInventory\Backups` first. Sign in with an account that already exists in the shop.

Website orders appear on whichever laptop syncs next (usually within seconds). Stock sold on any laptop is subtracted on all of them.

## 5. Keep it inside the free limits

- Leave the desktop app open on at least one laptop during shop hours. It syncs on its own; **Sync now** is only for a forced pass.
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
