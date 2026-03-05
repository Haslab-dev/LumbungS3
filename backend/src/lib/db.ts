import { Database } from "bun:sqlite";
import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import * as schema from "../db/schema";

export const initDb = () => {
  // Ensure storage directories exist
  mkdirSync("storage/objects", { recursive: true });
  
  const sqlite = new Database("storage/metadata.db", { create: true });
  
  // Enable WAL mode for performance
  sqlite.exec("PRAGMA journal_mode = WAL;");

  return drizzle(sqlite, { schema });
};

export type DatabaseType = BunSQLiteDatabase<typeof schema>;
