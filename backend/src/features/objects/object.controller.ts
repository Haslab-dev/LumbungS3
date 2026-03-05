import { Hono } from 'hono';
import { eq, and, desc, asc } from 'drizzle-orm';
import { join } from 'node:path';
import { mkdirSync, unlinkSync, existsSync, readdirSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { signUrl, verifyUrl } from '../../lib/signer';
import { buckets, objects, multipartUploads, uploadParts } from '../../db/schema';
import type { DatabaseType } from '../../lib/db';

export const objectRoutes = (db: DatabaseType) => {
  const app = new Hono();

  // List objects in a bucket (with prefix/folder support)
  app.get('/:bucketName', async (c) => {
    const bucketName = c.req.param('bucketName');
    const prefix = c.req.query('prefix') || '';
    
    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    let query = db.select().from(objects)
        .where(eq(objects.bucketId, bucket.id))
        .orderBy(desc(objects.createdAt));

    const allObjects = await query.execute();
    
    // Filter and group by "folders" if needed, but for now let's just return filtered list
    // A real S3 implementation would use delimiters, but we can return filtered results
    const filtered = allObjects.filter(obj => obj.key.startsWith(prefix));
    
    return c.json(filtered);
  });

  // Generate Presigned URL
  app.post('/:bucketName/:key{.+}/presign', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const { expires = 3600 } = await c.req.json().catch(() => ({}));

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    
    if (bucket?.visibility === 'public') {
      return c.json({ 
        url: `http://localhost:9000/objects/${bucketName}/${key}`,
        expiresAt: null,
        isPublic: true
      });
    }

    const expiresAt = Date.now() + (expires * 1000);
    const signature = await signUrl(bucketName, key, expiresAt);
    const url = `http://localhost:9000/objects/${bucketName}/${key}?expires=${expiresAt}&signature=${signature}`;
    
    return c.json({ url, expiresAt, isPublic: false });
  });

  // Multipart - Initiate & Complete (Shared POST route)
  app.post('/:bucketName/:key{.+|[^/]+}', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const isInitiate = c.req.query('uploads') !== undefined;
    const uploadId = c.req.query('uploadId');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    // 1. Initiate Multipart Upload
    if (isInitiate) {
      const newUploadId = crypto.randomUUID();
      const contentType = c.req.header('content-type') || 'application/octet-stream';
      
      await db.insert(multipartUploads).values({
        id: newUploadId,
        bucketId: bucket.id,
        key,
        contentType
      }).execute();

      // Create temp directory for parts
      mkdirSync(join('storage/temp', newUploadId), { recursive: true });

      return c.json({ uploadId: newUploadId, bucket: bucketName, key });
    }

    // 2. Complete Multipart Upload
    if (uploadId) {
      const [upload] = await db.select().from(multipartUploads).where(eq(multipartUploads.id, uploadId)).limit(1).execute();
      if (!upload) return c.json({ error: 'Upload not found' }, 404);

      // Fetch all parts ordered by part number
      const parts = await db.select().from(uploadParts).where(eq(uploadParts.uploadId, uploadId)).orderBy(asc(uploadParts.partNumber)).execute();
      if (parts.length === 0) return c.json({ error: 'No parts uploaded' }, 400);

      // Final storage path
      const hashHex = new Bun.CryptoHasher("sha256").update(`${bucketName}/${key}`).digest("hex");
      const prefix = hashHex.slice(0, 2);
      const storageDir = join('storage/objects', prefix);
      mkdirSync(storageDir, { recursive: true });
      const finalPath = join(storageDir, `${hashHex}.object`);

      // Combine parts
      const tempDir = join('storage/temp', uploadId);
      let totalSize = 0;
      
      // Clear final file if exists
      if (existsSync(finalPath)) unlinkSync(finalPath);
      
      for (const part of parts) {
        const partPath = join(tempDir, `${part.partNumber}.part`);
        if (!existsSync(partPath)) {
            // Cleanup and fail
            rmSync(tempDir, { recursive: true, force: true });
            return c.json({ error: `Part ${part.partNumber} missing from storage` }, 500);
        }
        const data = readFileSync(partPath);
        appendFileSync(finalPath, data);
        totalSize += part.size;
      }

      // Finalize metadata
      const objectId = crypto.randomUUID();
      await db.insert(objects).values({
        id: objectId,
        bucketId: bucket.id,
        key,
        size: totalSize,
        contentType: upload.contentType,
        hash: hashHex
      }).onConflictDoUpdate({
        target: [objects.bucketId, objects.key],
        set: { size: totalSize, contentType: upload.contentType, hash: hashHex }
      }).execute();

      // Cleanup
      rmSync(tempDir, { recursive: true, force: true });
      await db.delete(multipartUploads).where(eq(multipartUploads.id, uploadId)).execute();

      return c.json({ status: 'completed', key, size: totalSize });
    }

    return c.json({ error: 'Invalid request' }, 400);
  });

  // Upload object (Single Part) & Upload Part (Shared PUT route)
  app.put('/:bucketName/:key{.+|[^/]+}', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const uploadId = c.req.query('uploadId');
    const partNumber = parseInt(c.req.query('partNumber') || '0');
    
    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const body = await c.req.arrayBuffer();
    const size = body.byteLength;

    // 1. Upload Part
    if (uploadId && partNumber > 0) {
      const [upload] = await db.select().from(multipartUploads).where(eq(multipartUploads.id, uploadId)).limit(1).execute();
      if (!upload) return c.json({ error: 'UploadId not found' }, 404);

      const partPath = join('storage/temp', uploadId, `${partNumber}.part`);
      await Bun.write(partPath, body);

      const etag = new Bun.CryptoHasher("md5").update(body).digest("hex");
      
      await db.insert(uploadParts).values({
        uploadId,
        partNumber,
        etag,
        size,
        hash: etag // Using MD5 as simple ETag/Hash for parts
      }).onConflictDoUpdate({
        target: [uploadParts.uploadId, uploadParts.partNumber],
        set: { etag, size, hash: etag }
      }).execute();

      return c.json({ status: 'part_uploaded', partNumber, etag });
    }

    // 2. Single Part Upload (Default)
    const hashHex = new Bun.CryptoHasher("sha256").update(`${bucketName}/${key}`).digest("hex");
    const prefix = hashHex.slice(0, 2);
    const fileName = `${hashHex}.object`;
    
    const storageDir = join('storage/objects', prefix);
    mkdirSync(storageDir, { recursive: true });
    
    const filePath = join(storageDir, fileName);
    await Bun.write(filePath, body);

    const id = crypto.randomUUID();
    const contentType = c.req.header('content-type') || 'application/octet-stream';

    await db.insert(objects).values({
      id,
      bucketId: bucket.id,
      key,
      size,
      contentType,
      hash: hashHex
    }).onConflictDoUpdate({
      target: [objects.bucketId, objects.key],
      set: { size, contentType, hash: hashHex }
    }).execute();

    return c.json({ id, key, size, status: 'uploaded' });
  });

  // Download & Public Access
  app.get('/:bucketName/:key{.+|[^/]+}', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    if (bucket.visibility !== 'public') {
      const expires = c.req.query('expires');
      const signature = c.req.query('signature');

      if (!expires || !signature) {
        return c.text('Unauthorized: This bucket is private. Presigned URL required.', 401);
      }

      const isValid = await verifyUrl(bucketName, key, expires, signature);
      if (!isValid) {
        return c.text('Unauthorized: Invalid or expired signature', 403);
      }
    }

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

    const prefix = object.hash.slice(0, 2);
    const filePath = join('storage/objects', prefix, `${object.hash}.object`);

    if (!existsSync(filePath)) return c.json({ error: 'Storage file missing' }, 500);

    const file = Bun.file(filePath);
    const isView = c.req.query('view') === 'true';
    
    let contentType = object.contentType || 'application/octet-stream';
    if (contentType === 'application/octet-stream') {
      const ext = key.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
        'pdf': 'application/pdf', 'txt': 'text/plain'
      };
      if (ext && mimeMap[ext]) contentType = mimeMap[ext];
    }

    const viewableTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
    const isMedia = viewableTypes.some(t => contentType.startsWith(t));
    const disposition = (isView || isMedia) ? 'inline' : `attachment; filename="${key.split('/').pop()}"`;

    return c.body(await file.arrayBuffer(), 200, {
      'Content-Type': contentType,
      'Content-Disposition': disposition
    });
  });

  // Delete object & Abort Multipart (Shared DELETE route)
  app.delete('/:bucketName/:key{.+|[^/]+}', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const uploadId = c.req.query('uploadId');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    // 1. Abort Multipart Upload
    if (uploadId) {
        const tempDir = join('storage/temp', uploadId);
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
        await db.delete(multipartUploads).where(eq(multipartUploads.id, uploadId)).execute();
        return c.json({ status: 'aborted', uploadId });
    }

    // 2. Delete Object
    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
      .limit(1).execute();
      
    if (object) {
      const prefix = object.hash.slice(0, 2);
      const filePath = join('storage/objects', prefix, `${object.hash}.object`);
      if (existsSync(filePath)) unlinkSync(filePath);
      
      await db.delete(objects).where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key))).execute();
    }

    return c.json({ status: 'deleted' });
  });

  return app;
};
