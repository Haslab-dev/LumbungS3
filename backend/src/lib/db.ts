import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";

let dbInstance: any = null;

// Use eval("require") to completely bypass static analysis by bundlers like esbuild
const getLibsqlClient = () => {
  const req = typeof require !== "undefined" ? eval("require") : null;
  if (!req) throw new Error("libsql client require is not supported in this environment.");
  return req("@libsql/client");
};

const getFs = () => {
  const req = typeof require !== "undefined" ? eval("require") : null;
  if (!req) throw new Error("fs require is not supported in this environment.");
  return req("node:fs");
};

export const initDb = (env?: any) => {
  if (dbInstance) return dbInstance;

  const safeProcessEnv = typeof process !== "undefined" ? process.env : {} as Record<string, string | undefined>;
  // Support local sqlite file or remote Turso connection
  const url = env?.TURSO_DATABASE_URL || env?.TURSO_CONNECTION_URL || safeProcessEnv.TURSO_DATABASE_URL || safeProcessEnv.TURSO_CONNECTION_URL || "file:storage/metadata.db";
  const authToken = env?.TURSO_AUTH_TOKEN || safeProcessEnv.TURSO_AUTH_TOKEN;

  const isCloudflare = typeof (globalThis as any).WebSocketPair !== "undefined" || (typeof Bun === "undefined" && typeof process === "undefined");

  // If local filesystem SQLite and not in Cloudflare Workers, dynamically require standard @libsql/client to avoid CF compilation issues
  if (!isCloudflare && (url.startsWith("file:") || (!url.startsWith("libsql:") && !url.startsWith("http:") && !url.startsWith("https:")))) {
    const { createClient } = getLibsqlClient();
    const { mkdirSync } = getFs();
    
    mkdirSync("storage", { recursive: true });
    const client = createClient({ url });
    dbInstance = drizzle(client, { schema });
  } else {
    // Remote Turso connection (compatible with Cloudflare Pages / serverless)
    const client = createWebClient({ url, authToken });
    dbInstance = drizzle(client, { schema });
  }

  return dbInstance;
};

export type DatabaseType = LibSQLDatabase<typeof schema>;

