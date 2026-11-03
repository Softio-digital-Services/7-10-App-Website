// Gives .env a real AUTH_SECRET when it is missing, too short, or still a placeholder
// (e.g. copied from .env.example). The production server refuses to start without one.
// Never prints the secret. Used by run.bat.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PLACEHOLDER_SECRETS = ["generate-a-random-secret-here", "dev-secret-key-710-store-random-value-change-in-prod"];
const envPath = path.join(__dirname, "..", ".env");

const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const match = text.match(/^\s*AUTH_SECRET\s*=\s*"?([^"\r\n]*)"?\s*$/m);
const current = match ? match[1].trim() : "";

if (current.length >= 32 && !PLACEHOLDER_SECRETS.includes(current)) process.exit(0);

const line = `AUTH_SECRET="${crypto.randomBytes(32).toString("base64")}"`;
const updated = match
  ? text.replace(match[0], line)
  : text + (text === "" || text.endsWith("\n") ? "" : "\n") + line + "\n";
fs.writeFileSync(envPath, updated);
console.log("[Setup] Generated a new AUTH_SECRET in .env");
