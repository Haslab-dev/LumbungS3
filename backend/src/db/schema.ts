import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const buckets = sqliteTable("buckets", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  visibility: text("visibility").default("private"),
});

export const objects = sqliteTable("objects", {
  id: text("id").primaryKey(),
  bucketId: text("bucket_id").notNull().references(() => buckets.id),
  key: text("key").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type"),
  etag: text("etag"),
  hash: text("hash").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
}, (t) => ({
  unq: unique().on(t.bucketId, t.key),
}));

export const accessKeys = sqliteTable("access_keys", {
  id: text("id").primaryKey(),
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
