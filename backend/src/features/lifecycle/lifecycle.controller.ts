import { Hono } from 'hono';
import { eq, and, desc, lt } from 'drizzle-orm';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { buckets, objects, lifecycleRules } from '../../db/schema';
import type { DatabaseType } from '../../lib/db';

export const lifecycleRoutes = (db: DatabaseType) => {
  const app = new Hono();

  // List lifecycle rules for a bucket
  app.get('/:bucketId', async (c) => {
    const bucketId = c.req.param('bucketId');
    const rules = await db.select().from(lifecycleRules)
      .where(eq(lifecycleRules.bucketId, bucketId))
      .orderBy(desc(lifecycleRules.createdAt))
      .execute();
    return c.json(rules);
  });

  // Create a lifecycle rule
  app.post('/:bucketId', async (c) => {
    const bucketId = c.req.param('bucketId');
    const body = await c.req.json();

    const [bucket] = await db.select().from(buckets).where(eq(buckets.id, bucketId)).limit(1).execute();
    if (!bucket) return c.json({ error: 'Bucket not found' }, 404);

    const id = crypto.randomUUID();
    await db.insert(lifecycleRules).values({
      id,
      bucketId,
      name: body.name || 'Untitled Rule',
      prefix: body.prefix || '',
      status: body.status || 'enabled',
      expirationDays: body.expirationDays || null,
      noncurrentExpirationDays: body.noncurrentExpirationDays || null,
    }).execute();

    return c.json({ id, status: 'created' });
  });

  // Update a lifecycle rule
  app.patch('/:bucketId/:ruleId', async (c) => {
    const ruleId = c.req.param('ruleId');
    const body = await c.req.json();

    const updateSet: Record<string, any> = {};
    if (body.name !== undefined) updateSet.name = body.name;
    if (body.prefix !== undefined) updateSet.prefix = body.prefix;
    if (body.status !== undefined) updateSet.status = body.status;
    if (body.expirationDays !== undefined) updateSet.expirationDays = body.expirationDays;
    if (body.noncurrentExpirationDays !== undefined) updateSet.noncurrentExpirationDays = body.noncurrentExpirationDays;

    await db.update(lifecycleRules).set(updateSet).where(eq(lifecycleRules.id, ruleId)).execute();
    return c.json({ status: 'updated' });
  });

  // Delete a lifecycle rule
  app.delete('/:bucketId/:ruleId', async (c) => {
    const ruleId = c.req.param('ruleId');
    await db.delete(lifecycleRules).where(eq(lifecycleRules.id, ruleId)).execute();
    return c.json({ status: 'deleted' });
  });

  return app;
};

// Lifecycle evaluation engine (called periodically or on-demand)
export const evaluateLifecycleRules = async (db: DatabaseType) => {
  const rules = await db.select().from(lifecycleRules)
    .where(eq(lifecycleRules.status, 'enabled'))
    .execute();

  let actionsCount = 0;
  const now = new Date();

  for (const rule of rules) {
    // 1. Expire current objects
    if (rule.expirationDays) {
      const cutoff = new Date(now.getTime() - rule.expirationDays * 24 * 60 * 60 * 1000);
      const cutoffStr = cutoff.toISOString().replace('T', ' ').split('.')[0];
      
      const expiredObjects = await db.select().from(objects)
        .where(and(
          eq(objects.bucketId, rule.bucketId),
          lt(objects.createdAt, cutoffStr)
        ))
        .execute();
      
      const filtered = expiredObjects.filter(obj => {
        if (rule.prefix && !obj.key.startsWith(rule.prefix)) return false;
        return true;
      });

      for (const obj of filtered) {
        const prefix = obj.hash.slice(0, 2);
        const filePath = join('storage/objects', prefix, `${obj.hash}.object`);
        if (obj.hash !== 'delete-marker' && existsSync(filePath)) {
          unlinkSync(filePath);
        }
        await db.delete(objects).where(eq(objects.id, obj.id)).execute();
        actionsCount++;
      }
    }

    // 2. Expire noncurrent versions
    if (rule.noncurrentExpirationDays) {
      const cutoff = new Date(now.getTime() - rule.noncurrentExpirationDays * 24 * 60 * 60 * 1000);
      const cutoffStr = cutoff.toISOString().replace('T', ' ').split('.')[0];
      
      const noncurrentObjects = await db.select().from(objects)
        .where(and(
          eq(objects.bucketId, rule.bucketId),
          eq(objects.isLatest, false),
          lt(objects.createdAt, cutoffStr)
        ))
        .execute();
      
      const filtered = noncurrentObjects.filter(obj => {
        if (rule.prefix && !obj.key.startsWith(rule.prefix)) return false;
        return true;
      });

      for (const obj of filtered) {
        const prefix = obj.hash.slice(0, 2);
        const filePath = join('storage/objects', prefix, `${obj.hash}.object`);
        if (obj.hash !== 'delete-marker' && existsSync(filePath)) {
          unlinkSync(filePath);
        }
        await db.delete(objects).where(eq(objects.id, obj.id)).execute();
        actionsCount++;
      }
    }
  }

  return { evaluated: rules.length, actions: actionsCount };
};
