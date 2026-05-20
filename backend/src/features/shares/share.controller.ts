import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { signUrl } from '../../lib/signer';
import { buckets, objects, shares } from '../../db/schema';
import type { HonoEnv } from '../../index';

export const shareRoutes = () => {
  const app = new Hono<HonoEnv>();

  // Create a new share link
  app.post('/', async (c) => {
    const db = c.get('db');
    const { bucketName, key, expiresAt } = await c.req.json();
    
    if (!bucketName || !key) {
      return c.json({ error: 'Bucket name and key are required' }, 400);
    }

    // Find bucket
    const [bucket] = await db.select().from(buckets).where(eq(buckets.name, bucketName)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    // Find object
    const [object] = await db.select().from(objects)
      .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key), eq(objects.isLatest, true)))
      .limit(1).execute();
    if (!object) return c.json({ error: 'Object not found' }, 404);

    const shareId = crypto.randomUUID();
    
    await db.insert(shares).values({
      id: shareId,
      objectId: object.id,
      bucketName,
      key,
      expiresAt: expiresAt || null
    }).execute();

    return c.json({
      id: shareId,
      bucketName,
      key,
      expiresAt,
      status: 'created'
    });
  });

  // List active shares
  app.get('/', async (c) => {
    const db = c.get('db');
    
    // Select shares joined with objects for size, content type
    const activeShares = await db
      .select({
        id: shares.id,
        bucketName: shares.bucketName,
        key: shares.key,
        createdAt: shares.createdAt,
        expiresAt: shares.expiresAt,
        size: objects.size,
        contentType: objects.contentType
      })
      .from(shares)
      .innerJoin(objects, eq(shares.objectId, objects.id))
      .orderBy(desc(shares.createdAt))
      .execute();

    // Check expiration and filter out expired shares dynamically if they have an expiration date
    const now = new Date();
    const validShares = [];

    for (const share of activeShares) {
      if (share.expiresAt && new Date(share.expiresAt) < now) {
        // Automatically clean up expired share
        await db.delete(shares).where(eq(shares.id, share.id)).execute();
      } else {
        validShares.push(share);
      }
    }

    return c.json(validShares);
  });

  // Revoke/Delete a share link
  app.delete('/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    
    await db.delete(shares).where(eq(shares.id, id)).execute();
    return c.json({ status: 'revoked' });
  });

  // Public Endpoint (No auth needed, used by public landing page)
  app.get('/public/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');

    // Find the share
    const [share] = await db.select().from(shares).where(eq(shares.id, id)).limit(1).execute();
    if (!share) {
      return c.json({ error: 'Share link not found or has been revoked' }, 404);
    }

    // Check expiration
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      await db.delete(shares).where(eq(shares.id, id)).execute();
      return c.json({ error: 'This share link has expired' }, 410);
    }

    // Get object details
    const [object] = await db.select().from(objects).where(eq(objects.id, share.objectId)).limit(1).execute();
    if (!object) {
      return c.json({ error: 'The original file was deleted' }, 404);
    }

    // Generate a temporary signed download URL (valid for 15 minutes)
    const expiresDuration = 15 * 60; // 15 minutes
    const expiresAt = Date.now() + (expiresDuration * 1000);
    const signature = await signUrl(share.bucketName, share.key, expiresAt);
    
    const origin = new URL(c.req.url).origin;
    const baseDomain = origin.includes('localhost') ? 'http://localhost:9000' : origin;
    const downloadUrl = `${baseDomain}/objects/${share.bucketName}/${share.key}?expires=${expiresAt}&signature=${signature}`;

    return c.json({
      id: share.id,
      bucketName: share.bucketName,
      key: share.key,
      size: object.size,
      contentType: object.contentType,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      downloadUrl
    });
  });

  return app;
};
