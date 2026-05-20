import { Hono } from 'hono';
import { eq, desc, isNull, or } from 'drizzle-orm';
import { buckets } from '../../db/schema';
import type { HonoEnv } from '../../index';

export const bucketRoutes = () => {
  const app = new Hono<HonoEnv>();

  app.get('/', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;

    // Admin (userId = null) sees all buckets; regular users see only their own
    const allBuckets = userId === null
      ? await db.select().from(buckets).orderBy(desc(buckets.createdAt))
      : await db.select().from(buckets).where(eq(buckets.userId, userId)).orderBy(desc(buckets.createdAt));

    return c.json(allBuckets);
  });

  app.post('/', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;

    const body = await c.req.json().catch(() => ({}));
    const { name, visibility, versioning } = body as { name?: string; visibility?: string; versioning?: string };
    if (!name) return c.json({ error: 'Name is required' }, 400);

    const bucketVisibility = visibility === 'public' ? 'public' : 'private';
    const bucketVersioning = ['enabled', 'disabled', 'suspended'].includes(versioning || '') ? versioning! : 'disabled';

    const [existingBucket] = await db
      .select({ id: buckets.id, name: buckets.name })
      .from(buckets)
      .where(eq(buckets.name, name))
      .limit(1)
      .execute();

    if (existingBucket) {
      return c.json({ error: 'Bucket name already exists' }, 409);
    }

    const id = crypto.randomUUID();
    try {
      await db.insert(buckets).values({
        id,
        name,
        userId,
        visibility: bucketVisibility,
        versioning: bucketVersioning,
      });
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'Failed to create bucket';
      console.error('Bucket creation error:', err);
      if (message.includes('UNIQUE') || message.includes('constraint failed')) {
        return c.json({ error: 'Bucket name already exists' }, 409);
      }
      return c.json({ error: 'Failed to create bucket', message }, 500);
    }
    
    return c.json({
      id,
      name,
      visibility: bucketVisibility,
      versioning: bucketVersioning,
      status: 'created'
    });
  });

  app.delete('/:id', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;
    const id = c.req.param('id');

    // Verify ownership unless admin
    if (userId !== null) {
      const [bucket] = await db.select().from(buckets).where(eq(buckets.id, id)).limit(1).execute();
      if (!bucket || bucket.userId !== userId) {
        return c.json({ error: 'Forbidden: You do not own this bucket' }, 403);
      }
    }

    await db.delete(buckets).where(eq(buckets.id, id));
    return c.json({ status: 'deleted' });
  });

  app.patch('/:id/visibility', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;
    const id = c.req.param('id');
    const { visibility } = await c.req.json();
    if (!['public', 'private'].includes(visibility)) return c.json({ error: 'Invalid visibility' }, 400);

    if (userId !== null) {
      const [bucket] = await db.select().from(buckets).where(eq(buckets.id, id)).limit(1).execute();
      if (!bucket || bucket.userId !== userId) {
        return c.json({ error: 'Forbidden: You do not own this bucket' }, 403);
      }
    }

    await db.update(buckets).set({ visibility }).where(eq(buckets.id, id));
    return c.json({ status: 'updated', visibility });
  });

  // Toggle versioning
  app.patch('/:id/versioning', async (c) => {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;
    const id = c.req.param('id');
    const { versioning } = await c.req.json();
    if (!['enabled', 'disabled', 'suspended'].includes(versioning)) {
      return c.json({ error: 'Invalid versioning state. Must be: enabled, disabled, or suspended' }, 400);
    }

    if (userId !== null) {
      const [bucket] = await db.select().from(buckets).where(eq(buckets.id, id)).limit(1).execute();
      if (!bucket || bucket.userId !== userId) {
        return c.json({ error: 'Forbidden: You do not own this bucket' }, 403);
      }
    }

    await db.update(buckets).set({ versioning }).where(eq(buckets.id, id));
    return c.json({ status: 'updated', versioning });
  });

  return app;
};
