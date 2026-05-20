import { defineConfig } from "drizzle-kit";
import { readFileSync, existsSync } from "node:fs";

// Pre-load variables from wrangler.jsonc or .env
let wranglerUrl = "";
let wranglerToken = "";

if (existsSync("wrangler.jsonc")) {
  try {
    const raw = readFileSync("wrangler.jsonc", "utf8");
    // Strip comments (both single line and inline comments) safely
    const clean = raw.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    const config = JSON.parse(clean);
    wranglerUrl = config?.vars?.TURSO_DATABASE_URL || config?.vars?.TURSO_CONNECTION_URL || "";
    wranglerToken = config?.vars?.TURSO_AUTH_TOKEN || "";
  } catch (e) {
    // Ignore and fallback
  }
}

const url = wranglerUrl || process.env.TURSO_DATABASE_URL || process.env.TURSO_CONNECTION_URL || "storage/metadata.db";
const authToken = wranglerToken || process.env.TURSO_AUTH_TOKEN || "";

// Select dialect based on the protocol: "turso" for remote connection, "sqlite" for local file database
const isRemote = url.startsWith("libsql:") || url.startsWith("http:") || url.startsWith("https:");
const dialect = isRemote ? "turso" : "sqlite";

export default defineConfig({
  dialect: dialect as "turso" | "sqlite",
  schema: "./backend/src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
    authToken,
  },
});


