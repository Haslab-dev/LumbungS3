import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { accessKeys, corsRules } from '../../db/schema';
import type { HonoEnv } from '../../index';

export const accessKeyRoutes = () => {
  const app = new Hono<HonoEnv>();

  app.get('/', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;

    const query = db.select({
      id: accessKeys.id,
      accessKey: accessKeys.accessKey,
      status: accessKeys.status,
      createdAt: accessKeys.createdAt
    }).from(accessKeys).orderBy(desc(accessKeys.createdAt));

    const keys = userId === null
      ? await query
      : await db.select({
          id: accessKeys.id,
          accessKey: accessKeys.accessKey,
          status: accessKeys.status,
          createdAt: accessKeys.createdAt
        }).from(accessKeys).where(eq(accessKeys.userId, userId)).orderBy(desc(accessKeys.createdAt));

    return c.json(keys);
  });

  app.post('/', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;

    const id = crypto.randomUUID();
    const accessKey = `LBG${crypto.randomUUID().replace(/-/g, '').slice(0, 17).toUpperCase()}`;
    const secretKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    await db.insert(accessKeys).values({ id, userId, accessKey, secretKey, status: 'active' });
    return c.json({ id, accessKey, secretKey, status: 'active' });
  });

  app.delete('/:id', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;
    const id = c.req.param('id');

    if (userId !== null) {
      const [key] = await db.select().from(accessKeys).where(eq(accessKeys.id, id)).limit(1).execute();
      if (!key || key.userId !== userId) {
        return c.json({ error: 'Forbidden: You do not own this access key' }, 403);
      }
    }

    await db.delete(accessKeys).where(eq(accessKeys.id, id));
    return c.json({ status: 'deleted' });
  });

  // === CORS Rules ===
  app.get('/cors', async (c) => {
    const db = c.get('db');
    const rules = await db.select().from(corsRules).execute();
    return c.json(rules);
  });

  app.get('/cors/bucket/:bucketId', async (c) => {
    const db = c.get('db');
    const bucketId = c.req.param('bucketId');
    const [rule] = await db.select().from(corsRules).where(eq(corsRules.bucketId, bucketId)).limit(1).execute();
    return c.json(rule || null);
  });

  app.post('/cors', async (c) => {
    const db = c.get('db');
    const { bucketId, allowedOrigins, allowedMethods, allowedHeaders = '*', maxAge = 3600 } = await c.req.json();

    if (!bucketId || !allowedOrigins || !allowedMethods) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const [existing] = await db.select().from(corsRules).where(eq(corsRules.bucketId, bucketId)).limit(1).execute();

    if (existing) {
      await db.update(corsRules)
        .set({
          allowedOrigins,
          allowedMethods,
          allowedHeaders,
          maxAge: Number(maxAge)
        })
        .where(eq(corsRules.id, existing.id))
        .execute();
      
      return c.json({ id: existing.id, bucketId, allowedOrigins, allowedMethods, allowedHeaders, maxAge, status: 'updated' });
    } else {
      const id = crypto.randomUUID();
      await db.insert(corsRules).values({
        id,
        bucketId,
        allowedOrigins,
        allowedMethods,
        allowedHeaders,
        maxAge: Number(maxAge)
      }).execute();

      return c.json({ id, bucketId, allowedOrigins, allowedMethods, allowedHeaders, maxAge, status: 'created' });
    }
  });

  app.delete('/cors/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    await db.delete(corsRules).where(eq(corsRules.id, id)).execute();
    return c.json({ status: 'deleted' });
  });

  return app;
};
