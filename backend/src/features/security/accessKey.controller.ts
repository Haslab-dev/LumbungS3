import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { accessKeys } from '../../db/schema';
import type { HonoEnv } from '../../index';

export const accessKeyRoutes = () => {
  const app = new Hono<HonoEnv>();

  app.get('/', async (c) => {
    const db = c.get('db');
    const keys = await db.select({
      id: accessKeys.id,
      accessKey: accessKeys.accessKey,
      status: accessKeys.status,
      createdAt: accessKeys.createdAt
    }).from(accessKeys).orderBy(desc(accessKeys.createdAt));
    return c.json(keys);
  });

  app.post('/', async (c) => {
    const db = c.get('db');
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
    const db = c.get('db');
    const id = c.req.param('id');
    await db.delete(accessKeys).where(eq(accessKeys.id, id));
    return c.json({ status: 'deleted' });
  });

  return app;
};
