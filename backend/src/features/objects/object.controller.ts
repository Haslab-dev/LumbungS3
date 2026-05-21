import { Hono } from 'hono';
import { eq, and, desc, asc } from 'drizzle-orm';
import { signUrl, verifyUrl } from '../../lib/signer';
import { buckets, objects, multipartUploads, uploadParts, objectMetadata, objectTags } from '../../db/schema';
import type { HonoEnv } from '../../index';
import { sha256 } from '../../lib/hash';
import { adminAuth } from '../../lib/auth';

export const objectRoutes = () => {
  const app = new Hono<HonoEnv>();

  // List objects in a bucket (with prefix/folder support)
  app.get('/:bucketName', adminAuth(), async (c) => {
    const db = c.get('db');
    const bucketName = c.req.param('bucketName');
    const prefix = c.req.query('prefix') || '';
    const versions = c.req.query('versions') === 'true';
    
    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    let query;
    if (versions) {
      query = db.select().from(objects)
        .where(eq(objects.bucketId, bucket.id))
        .orderBy(desc(objects.createdAt));
    } else {
      query = db.select().from(objects)
        .where(and(eq(objects.bucketId, bucket.id), eq(objects.isLatest, true)))
        .orderBy(desc(objects.createdAt));
    }

    const allObjects = await query.execute();
    
    const filtered = allObjects
      .filter(obj => obj.key.startsWith(prefix))
      .filter(obj => versions || !obj.isDeleteMarker);
    
    return c.json(filtered);
  });

  // Generate Presigned URL
  app.post('/:bucketName/:key{.+}/presign', adminAuth(), async (c) => {
    const db = c.get('db');
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const { expires = 3600 } = await c.req.json().catch(() => ({}));

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    
    // Resolve dynamic domain depending on development or Cloudflare host
    const origin = new URL(c.req.url).origin;
    const baseDomain = origin.includes('localhost') ? 'http://localhost:9000' : origin;

    if (bucket?.visibility === 'public') {
      return c.json({ 
        url: `${baseDomain}/objects/${bucketName}/${key}`,
        expiresAt: null,
        isPublic: true
      });
    }

    const expiresAt = Date.now() + (expires * 1000);
    const signature = await signUrl(bucketName, key, expiresAt);
    const url = `${baseDomain}/objects/${bucketName}/${key}?expires=${expiresAt}&signature=${signature}`;
    
    return c.json({ url, expiresAt, isPublic: false });
  });

  // === Object Metadata ===
  app.get('/:bucketName/:key{.+}/metadata', adminAuth(), async (c) => {
    const db = c.get('db');
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

  app.put('/:bucketName/:key{.+}/metadata', adminAuth(), async (c) => {
    const db = c.get('db');
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const body = await c.req.json();

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

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
  app.get('/:bucketName/:key{.+}/tagging', adminAuth(), async (c) => {
    const db = c.get('db');
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

  app.put('/:bucketName/:key{.+}/tagging', adminAuth(), async (c) => {
    const db = c.get('db');
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const body = await c.req.json();

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

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

  app.delete('/:bucketName/:key{.+}/tagging', adminAuth(), async (c) => {
    const db = c.get('db');
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
  app.get('/:bucketName/:key{.+}/versions', adminAuth(), async (c) => {
    const db = c.get('db');
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
  app.post('/:bucketName/:key{.+|[^/]+}', adminAuth(), async (c) => {
    const db = c.get('db');
    const storage = c.get('storage');
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const isInitiate = c.req.query('uploads') !== undefined;
    const uploadId = c.req.query('uploadId');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    // 1. Initiate Multipart Upload
    if (isInitiate) {
      const contentType = c.req.header('content-type') || 'application/octet-stream';
      
      const storageUploadId = await storage.initiateMultipart(key, contentType);
      
      await db.insert(multipartUploads).values({
        id: storageUploadId,
        bucketId: bucket.id,
        key,
        contentType
      }).execute();

      return c.json({ uploadId: storageUploadId, bucket: bucketName, key });
    }

    // 2. Complete Multipart Upload
    if (uploadId) {
      const [upload] = await db.select().from(multipartUploads).where(eq(multipartUploads.id, uploadId)).limit(1).execute();
      if (!upload) return c.json({ error: 'Upload not found' }, 404);

      const parts = await db.select().from(uploadParts).where(eq(uploadParts.uploadId, uploadId)).orderBy(asc(uploadParts.partNumber)).execute();
      if (parts.length === 0) return c.json({ error: 'No parts uploaded' }, 400);

      const hashHex = await sha256(`${bucketName}/${key}`);
      const versionId = bucket.versioning === 'enabled' ? crypto.randomUUID() : null;
      const storageHash = versionId ? await sha256(`${bucketName}/${key}/${versionId}`) : hashHex;

      // Complete the multipart in the storage provider
      await storage.completeMultipart(key, uploadId, parts.map(p => ({ partNumber: p.partNumber, etag: p.etag })), storageHash);

      let totalSize = 0;
      parts.forEach(p => { totalSize += p.size; });

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

      await db.delete(multipartUploads).where(eq(multipartUploads.id, uploadId)).execute();

      return c.json({ status: 'completed', key, size: totalSize, versionId });
    }

    return c.json({ error: 'Invalid request' }, 400);
  });

  // Upload object (Single Part) & Upload Part (Shared PUT route)
  app.put('/:bucketName/:key{.+|[^/]+}', adminAuth(), async (c) => {
    const db = c.get('db');
    const storage = c.get('storage');
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

      const { etag } = await storage.uploadPart(key, uploadId, partNumber, body);
      
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
    const baseHash = await sha256(`${bucketName}/${key}`);
    const versionId = bucket.versioning === 'enabled' ? crypto.randomUUID() : null;
    const storageHash = versionId ? await sha256(`${bucketName}/${key}/${versionId}`) : baseHash;
    
    const contentType = c.req.header('content-type') || 'application/octet-stream';

    // Put standard object in storage
    await storage.putObject(storageHash, body, contentType);

    // If versioning is enabled, mark old versions as not latest
    if (bucket.versioning === 'enabled') {
      await db.update(objects)
        .set({ isLatest: false })
        .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
        .execute();
    }

    const id = crypto.randomUUID();

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
    const db = c.get('db');
    const storage = c.get('storage');
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

    // Get the object stream or array buffer from storage provider
    const arrayBuffer = await storage.getObject(object.hash);

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

    const acceptHeader = c.req.header('accept') || '';
    const isBrowserNavigate = acceptHeader.includes('text/html');
    
    if (isBrowserNavigate && c.req.query('viewer') === 'true') {
      const searchParams = new URLSearchParams();
      if (c.req.query('expires')) searchParams.set('expires', c.req.query('expires')!);
      if (c.req.query('signature')) searchParams.set('signature', c.req.query('signature')!);
      
      const qs = searchParams.toString();
      const redirectUrl = `/view/${bucketName}/${key}${qs ? '?' + qs : ''}`;
      return c.redirect(redirectUrl, 302);
    }

    const viewableTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
    const isMedia = viewableTypes.some(t => contentType.startsWith(t));
    const disposition = (c.req.query('view') === 'true' || isMedia) ? 'inline' : `attachment; filename="${key.split('/').pop()}"`;

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Content-Length': object.size.toString()
    };
    if (object.versionId) headers['x-amz-version-id'] = object.versionId;

    return c.body(arrayBuffer, 200, headers);
  });

  // Delete object & Abort Multipart (Shared DELETE route)
  app.delete('/:bucketName/:key{.+|[^/]+}', adminAuth(), async (c) => {
    const db = c.get('db');
    const storage = c.get('storage');
    const bucketName = c.req.param('bucketName');
    const key = c.req.param('key');
    const uploadId = c.req.query('uploadId');
    const requestedVersionId = c.req.query('versionId');

    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    // 1. Abort Multipart Upload
    if (uploadId) {
      await storage.abortMultipart(key, uploadId);
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
          if (object.hash !== 'delete-marker') {
            await storage.deleteObject(object.hash);
          }
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
      if (object.hash !== 'delete-marker') {
        await storage.deleteObject(object.hash);
      }
      await db.delete(objects).where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key))).execute();
    }

    return c.json({ status: 'deleted' });
  });

  return app;
};
