import { Hono } from 'hono';
import { Database } from 'bun:sqlite';

export const bucketRoutes = (db: Database) => {
  const app = new Hono();

  app.get('/', (c) => {
    const buckets = db.query('SELECT * FROM buckets ORDER BY created_at DESC').all();
    return c.json(buckets);
  });

  app.post('/', async (c) => {
    const { name } = await c.req.json();
    if (!name) return c.json({ error: 'Name is required' }, 400);

    const id = crypto.randomUUID();
    db.run('INSERT INTO buckets (id, name) VALUES (?, ?)', [id, name]);
    
    return c.json({ id, name, status: 'created' });
  });

  app.delete('/:id', (c) => {
    const id = c.req.param('id');
    db.run('DELETE FROM buckets WHERE id = ?', [id]);
    return c.json({ status: 'deleted' });
  });

  return app;
};
