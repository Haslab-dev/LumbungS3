import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const initDb = () => {
  // Ensure storage directories exist
  mkdirSync("storage/objects", { recursive: true });
  
  const db = new Database("storage/metadata.db", { create: true });
  
  // Enable WAL mode for performance
  db.exec("PRAGMA journal_mode = WAL;");

  // Create Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS buckets (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      visibility TEXT DEFAULT 'private'
    );

    CREATE TABLE IF NOT EXISTS objects (
      id TEXT PRIMARY KEY,
      bucket_id TEXT NOT NULL,
      key TEXT NOT NULL,
      size INTEGER NOT NULL,
      content_type TEXT,
      etag TEXT,
      hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bucket_id) REFERENCES buckets(id)
    );

    CREATE TABLE IF NOT EXISTS access_keys (
      id TEXT PRIMARY KEY,
      access_key TEXT UNIQUE NOT NULL,
      secret_key TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
};
