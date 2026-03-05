import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { buckets } from '../../db/schema';
import type { DatabaseType } from '../../lib/db';

export const bucketRoutes = (db: DatabaseType) => {
  const app = new Hono();

  app.get('/', async (c) => {
    const allBuckets = await db.select().from(buckets).orderBy(desc(buckets.createdAt));
    return c.json(allBuckets);
  });

  app.post('/', async (c) => {
    const { name } = await c.req.json();
    if (!name) return c.json({ error: 'Name is required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(buckets).values({ id, name });
    
    return c.json({ id, name, status: 'created' });
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(buckets).where(eq(buckets.id, id));
    return c.json({ status: 'deleted' });
  });

  app.patch('/:id/visibility', async (c) => {
    const id = c.req.param('id');
    const { visibility } = await c.req.json();
    if (!['public', 'private'].includes(visibility)) return c.json({ error: 'Invalid visibility' }, 400);

    await db.update(buckets)
      .set({ visibility })
      .where(eq(buckets.id, id));
      
    return c.json({ status: 'updated', visibility });
  });

  return app;
};
