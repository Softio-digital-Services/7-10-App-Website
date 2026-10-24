/**
 * Copies the brand + contact details from desktop/appsettings.json (SystemBranding)
 * into src/lib/brand.generated.json, so the website and the desktop app share one source.
 *
 * Runs automatically before `dev` and `build` and after `npm install`.
 * Edit desktop/appsettings.json, never the generated file.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(webDir, "..", "desktop", "appsettings.json");
const target = join(webDir, "src", "lib", "brand.generated.json");

if (!existsSync(source)) {
  if (existsSync(target)) {
    console.warn(`[sync-brand] ${source} not found; keeping the existing brand.generated.json`);
    process.exit(0);
  }
  console.error(`[sync-brand] ${source} not found and no brand.generated.json to fall back on`);
  process.exit(1);
}

const settings = JSON.parse(readFileSync(source, "utf8").replace(/^﻿/, ""));
const b = settings.SystemBranding ?? {};
const text = (key) => (typeof b[key] === "string" ? b[key].trim() : "");

const brand = {
  appName: text("AppName"),
  companyName: text("CompanyName"),
  brandName: text("BrandName"),
  brandFullName: text("BrandFullName"),
  primaryColor: text("PrimaryColor"),
  address: text("Address"),
  addressAr: text("AddressAr"),
  phone: text("Phone"),
  whatsapp: text("WhatsApp").replace(/\D/g, ""),
  email: text("Email"),
  website: text("Website").replace(/\/+$/, ""),
  instagram: text("Instagram").replace(/^@/, ""),
};

const json = JSON.stringify(brand, null, 2) + "\n";
const current = existsSync(target) ? readFileSync(target, "utf8") : "";
if (current !== json) {
  writeFileSync(target, json);
  console.log("[sync-brand] updated src/lib/brand.generated.json");
}
