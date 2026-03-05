import { Hono } from 'hono';
import { eq, and, desc, asc } from 'drizzle-orm';
import { join } from 'node:path';
import { mkdirSync, unlinkSync, existsSync, readdirSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { signUrl, verifyUrl } from '../../lib/signer';
import { buckets, objects, multipartUploads, uploadParts, objectMetadata, objectTags } from '../../db/schema';
import type { DatabaseType } from '../../lib/db';

export const objectRoutes = (db: DatabaseType) => {
  const app = new Hono();

  // List objects in a bucket (with prefix/folder support)
  app.get('/:bucketName', async (c) => {
    const bucketName = c.req.param('bucketName');
    const prefix = c.req.query('prefix') || '';
    const versions = c.req.query('versions') === 'true';
    
    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    let query;
    if (versions) {
      // Return all versions
      query = db.select().from(objects)
        .where(eq(objects.bucketId, bucket.id))
        .orderBy(desc(objects.createdAt));
    } else {
      // Return only latest versions
      query = db.select().from(objects)
        .where(and(eq(objects.bucketId, bucket.id), eq(objects.isLatest, true)))
        .orderBy(desc(objects.createdAt));
    }

    const allObjects = await query.execute();
    
    // Filter by prefix and exclude delete markers from normal listing
    const filtered = allObjects
      .filter(obj => obj.key.startsWith(prefix))
      .filter(obj => versions || !obj.isDeleteMarker);
    
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

  // === Object Metadata (x-amz-meta-*) ===
  app.get('/:bucketName/:key{.+}/metadata', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

    const meta = await db.select().from(objectMetadata).where(eq(objectMetadata.objectId, object.id)).execute();
    const result: Record<string, string> = {};
    meta.forEach(m => { result[m.metaKey] = m.metaValue; });

    return c.json(result);
  });

  app.put('/:bucketName/:key{.+}/metadata', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const body = await c.req.json();

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

    // Replace all metadata
    await db.delete(objectMetadata).where(eq(objectMetadata.objectId, object.id)).execute();
    
    const entries = Object.entries(body);
    for (const [metaKey, metaValue] of entries) {
      await db.insert(objectMetadata).values({
        objectId: object.id,
        metaKey,
        metaValue: String(metaValue)
      }).execute();
    }

    return c.json({ status: 'updated', metadata: body });
  });

  // === Object Tags ===
  app.get('/:bucketName/:key{.+}/tagging', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

    const tags = await db.select().from(objectTags).where(eq(objectTags.objectId, object.id)).execute();
    const result: Record<string, string> = {};
    tags.forEach(t => { result[t.tagKey] = t.tagValue; });

    return c.json(result);
  });

  app.put('/:bucketName/:key{.+}/tagging', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const body = await c.req.json();

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

    // Replace all tags
    await db.delete(objectTags).where(eq(objectTags.objectId, object.id)).execute();
    
    const entries = Object.entries(body);
    if (entries.length > 10) return c.json({ error: 'Maximum 10 tags allowed' }, 400);
    
    for (const [tagKey, tagValue] of entries) {
      await db.insert(objectTags).values({
        objectId: object.id,
        tagKey,
        tagValue: String(tagValue)
      }).execute();
    }

    return c.json({ status: 'updated', tags: body });
  });

  app.delete('/:bucketName/:key{.+}/tagging', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

    await db.delete(objectTags).where(eq(objectTags.objectId, object.id)).execute();
    return c.json({ status: 'deleted' });
  });

  // === Object Versions ===
  app.get('/:bucketName/:key{.+}/versions', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const versions = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
      .orderBy(desc(objects.createdAt))
      .execute();

    return c.json({
      key,
      versioning: bucket.versioning,
      versions: versions.map(v => ({
        versionId: v.versionId,
        size: v.size,
        contentType: v.contentType,
        isLatest: v.isLatest,
        isDeleteMarker: v.isDeleteMarker,
        createdAt: v.createdAt
      }))
    });
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

      const parts = await db.select().from(uploadParts).where(eq(uploadParts.uploadId, uploadId)).orderBy(asc(uploadParts.partNumber)).execute();
      if (parts.length === 0) return c.json({ error: 'No parts uploaded' }, 400);

      const hashHex = new Bun.CryptoHasher("sha256").update(`${bucketName}/${key}`).digest("hex");
      const prefix = hashHex.slice(0, 2);
      const storageDir = join('storage/objects', prefix);
      mkdirSync(storageDir, { recursive: true });

      // For versioned buckets, use a unique hash per version
      const versionId = bucket.versioning === 'enabled' ? crypto.randomUUID() : null;
      const storageHash = versionId ? new Bun.CryptoHasher("sha256").update(`${bucketName}/${key}/${versionId}`).digest("hex") : hashHex;
      const finalPath = join(storageDir, `${storageHash}.object`);

      const tempDir = join('storage/temp', uploadId);
      let totalSize = 0;
      
      if (existsSync(finalPath)) unlinkSync(finalPath);
      
      for (const part of parts) {
        const partPath = join(tempDir, `${part.partNumber}.part`);
        if (!existsSync(partPath)) {
            rmSync(tempDir, { recursive: true, force: true });
            return c.json({ error: `Part ${part.partNumber} missing from storage` }, 500);
        }
        const data = readFileSync(partPath);
        appendFileSync(finalPath, data);
        totalSize += part.size;
      }

      // If versioning is enabled, mark old versions as not latest
      if (bucket.versioning === 'enabled') {
        await db.update(objects)
          .set({ isLatest: false })
          .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
          .execute();
      }

      const objectId = crypto.randomUUID();
      await db.insert(objects).values({
        id: objectId,
        bucketId: bucket.id,
        key,
        size: totalSize,
        contentType: upload.contentType,
        hash: storageHash,
        versionId,
        isLatest: true,
        isDeleteMarker: false
      }).onConflictDoUpdate({
        target: [objects.bucketId, objects.key, objects.versionId],
        set: { size: totalSize, contentType: upload.contentType, hash: storageHash, isLatest: true }
      }).execute();

      rmSync(tempDir, { recursive: true, force: true });
      await db.delete(multipartUploads).where(eq(multipartUploads.id, uploadId)).execute();

      return c.json({ status: 'completed', key, size: totalSize, versionId });
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
        hash: etag
      }).onConflictDoUpdate({
        target: [uploadParts.uploadId, uploadParts.partNumber],
        set: { etag, size, hash: etag }
      }).execute();

      return c.json({ status: 'part_uploaded', partNumber, etag });
    }

    // 2. Single Part Upload (Default)
    const baseHash = new Bun.CryptoHasher("sha256").update(`${bucketName}/${key}`).digest("hex");
    const versionId = bucket.versioning === 'enabled' ? crypto.randomUUID() : null;
    const storageHash = versionId ? new Bun.CryptoHasher("sha256").update(`${bucketName}/${key}/${versionId}`).digest("hex") : baseHash;
    
    const prefix = storageHash.slice(0, 2);
    const storageDir = join('storage/objects', prefix);
    mkdirSync(storageDir, { recursive: true });
    
    const filePath = join(storageDir, `${storageHash}.object`);
    await Bun.write(filePath, body);

    // If versioning is enabled, mark old versions as not latest
    if (bucket.versioning === 'enabled') {
      await db.update(objects)
        .set({ isLatest: false })
        .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
        .execute();
    }

    const id = crypto.randomUUID();
    const contentType = c.req.header('content-type') || 'application/octet-stream';

    await db.insert(objects).values({
      id,
      bucketId: bucket.id,
      key,
      size,
      contentType,
      hash: storageHash,
      versionId,
      isLatest: true,
      isDeleteMarker: false
    }).onConflictDoUpdate({
      target: [objects.bucketId, objects.key, objects.versionId],
      set: { size, contentType, hash: storageHash, isLatest: true }
    }).execute();

    return c.json({ id, key, size, versionId, status: 'uploaded' });
  });

  // Download & Public Access
  app.get('/:bucketName/:key{.+|[^/]+}', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const requestedVersionId = c.req.query('versionId');

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

    // Find the specific version or the latest
    let object;
    if (requestedVersionId) {
      [object] = await db.select().from(objects)
        .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.versionId, requestedVersionId)))
        .limit(1).execute();
    } else {
      [object] = await db.select().from(objects)
        .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
        .limit(1).execute();
    }
    if (!object) return c.json({ error: 'Object not found' }, 404);
    if (object.isDeleteMarker) return c.json({ error: 'Object has been deleted (delete marker)' }, 404);

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

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': disposition
    };
    if (object.versionId) headers['x-amz-version-id'] = object.versionId;

    return c.body(await file.arrayBuffer(), 200, headers);
  });

  // Delete object & Abort Multipart (Shared DELETE route)
  app.delete('/:bucketName/:key{.+|[^/]+}', async (c) => {
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const uploadId = c.req.query('uploadId');
    const requestedVersionId = c.req.query('versionId');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    // 1. Abort Multipart Upload
    if (uploadId) {
        const tempDir = join('storage/temp', uploadId);
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
        await db.delete(multipartUploads).where(eq(multipartUploads.id, uploadId)).execute();
        return c.json({ status: 'aborted', uploadId });
    }

    // 2. Versioned Delete
    if (bucket.versioning === 'enabled') {
      if (requestedVersionId) {
        // Permanently delete a specific version
        const [object] = await db.select().from(objects)
          .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.versionId, requestedVersionId)))
          .limit(1).execute();
        
        if (object) {
          const prefix = object.hash.slice(0, 2);
          const filePath = join('storage/objects', prefix, `${object.hash}.object`);
          if (existsSync(filePath)) unlinkSync(filePath);
          await db.delete(objects).where(eq(objects.id, object.id)).execute();
          
          // If we deleted the latest, promote the next one
          if (object.isLatest) {
            const [next] = await db.select().from(objects)
              .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
              .orderBy(desc(objects.createdAt))
              .limit(1).execute();
            if (next) {
              await db.update(objects).set({ isLatest: true }).where(eq(objects.id, next.id)).execute();
            }
          }
        }
        return c.json({ status: 'version_deleted', versionId: requestedVersionId });
      } else {
        // Soft delete: insert a delete marker
        await db.update(objects)
          .set({ isLatest: false })
          .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
          .execute();

        const deleteMarkerId = crypto.randomUUID();
        await db.insert(objects).values({
          id: deleteMarkerId,
          bucketId: bucket.id,
          key,
          size: 0,
          hash: 'delete-marker',
          versionId: crypto.randomUUID(),
          isLatest: true,
          isDeleteMarker: true
        }).execute();

        return c.json({ status: 'delete_marker_created', key });
      }
    }

    // 3. Non-versioned Delete (permanent)
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
