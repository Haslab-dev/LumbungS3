import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role").default("user"), // 'admin' | 'user'
  status: text("status").default("active"), // 'active' | 'inactive'
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const buckets = sqliteTable("buckets", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  userId: text("user_id"), // null = owned by .env admin
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  visibility: text("visibility").default("private"),
  versioning: text("versioning").default("disabled"), // disabled | enabled | suspended
});

export const objects = sqliteTable("objects", {
  id: text("id").primaryKey(),
  bucketId: text("bucket_id").notNull().references(() => buckets.id),
  key: text("key").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type"),
  etag: text("etag"),
  hash: text("hash").notNull(),
  versionId: text("version_id"), // null = current version (non-versioned bucket)
  isLatest: integer("is_latest", { mode: "boolean" }).default(true),
  isDeleteMarker: integer("is_delete_marker", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
}, (t) => ({
  unq: unique().on(t.bucketId, t.key, t.versionId),
}));

export const objectMetadata = sqliteTable("object_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  objectId: text("object_id").notNull().references(() => objects.id, { onDelete: 'cascade' }),
  metaKey: text("meta_key").notNull(),
  metaValue: text("meta_value").notNull(),
}, (t) => ({
  unq: unique().on(t.objectId, t.metaKey),
}));

export const objectTags = sqliteTable("object_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  objectId: text("object_id").notNull().references(() => objects.id, { onDelete: 'cascade' }),
  tagKey: text("tag_key").notNull(),
  tagValue: text("tag_value").notNull(),
}, (t) => ({
  unq: unique().on(t.objectId, t.tagKey),
}));

export const lifecycleRules = sqliteTable("lifecycle_rules", {
  id: text("id").primaryKey(),
  bucketId: text("bucket_id").notNull().references(() => buckets.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  prefix: text("prefix").default(""),              // Apply to objects matching this prefix
  status: text("status").default("enabled"),        // enabled | disabled
  expirationDays: integer("expiration_days"),       // Delete objects after N days
  noncurrentExpirationDays: integer("noncurrent_expiration_days"), // Delete old versions after N days
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const accessKeys = sqliteTable("access_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // null = owned by .env admin
  accessKey: text("access_key").notNull().unique(),
  secretKey: text("secret_key").notNull(),
  status: text("status").default("active"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const multipartUploads = sqliteTable("multipart_uploads", {
  id: text("id").primaryKey(), // uploadId
  bucketId: text("bucket_id").notNull().references(() => buckets.id),
  key: text("key").notNull(),
  contentType: text("content_type"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const uploadParts = sqliteTable("upload_parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uploadId: text("upload_id").notNull().references(() => multipartUploads.id, { onDelete: 'cascade' }),
  partNumber: integer("part_number").notNull(),
  etag: text("etag").notNull(),
  size: integer("size").notNull(),
  hash: text("hash").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
}, (t) => ({
  unq: unique().on(t.uploadId, t.partNumber),
}));

export const shares = sqliteTable("shares", {
  id: text("id").primaryKey(), // Unique sharing token/UUID
  objectId: text("object_id").notNull().references(() => objects.id, { onDelete: 'cascade' }),
  bucketName: text("bucket_name").notNull(),
  key: text("key").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  expiresAt: text("expires_at"), // Optional ISO string or null (never expires)
});

export const corsRules = sqliteTable("cors_rules", {
  id: text("id").primaryKey(),
  bucketId: text("bucket_id").notNull().unique().references(() => buckets.id, { onDelete: 'cascade' }),
  allowedOrigins: text("allowed_origins").notNull(), // comma-separated or json array
  allowedMethods: text("allowed_methods").notNull(), // comma-separated or json array
  allowedHeaders: text("allowed_headers").default("*"),
  maxAge: integer("max_age").default(3600),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});


