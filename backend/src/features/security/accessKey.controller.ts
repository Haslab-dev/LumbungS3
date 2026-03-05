import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { accessKeys } from '../../db/schema';
import type { DatabaseType } from '../../lib/db';

export const accessKeyRoutes = (db: DatabaseType) => {
  const app = new Hono();

  app.get('/', async (c) => {
    const keys = await db.select({
      id: accessKeys.id,
      accessKey: accessKeys.accessKey,
      status: accessKeys.status,
      createdAt: accessKeys.createdAt
    }).from(accessKeys).orderBy(desc(accessKeys.createdAt));
    return c.json(keys);
  });

  app.post('/', async (c) => {
    const id = crypto.randomUUID();
    const accessKey = `LBG${crypto.randomUUID().replace(/-/g, '').slice(0, 17).toUpperCase()}`;
    const secretKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    await db.insert(accessKeys).values({
      id,
      accessKey,
      secretKey,
      status: 'active'
    });

    return c.json({ id, accessKey, secretKey, status: 'active' });
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(accessKeys).where(eq(accessKeys.id, id));
    return c.json({ status: 'deleted' });
  });

  return app;
};
