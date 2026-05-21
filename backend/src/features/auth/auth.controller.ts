import { Hono } from 'hono';
import { signToken, adminAuth, superAdminAuth } from '../../lib/auth';
import { sha256 } from '../../lib/hash';
import type { HonoEnv } from '../../index';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const authRoutes = () => {
  const app = new Hono<HonoEnv>();

  // Register endpoint
  app.post('/register', async (c) => {
    try {
      const { username, email, password } = await c.req.json();
      const db = c.get('db');

      if (!username || !email || !password) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Check if user exists
      const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1).execute();
      const existingEmail = await db.select().from(users).where(eq(users.email, email)).limit(1).execute();

      if (existingUser.length > 0) return c.json({ error: 'Username already taken' }, 400);
      if (existingEmail.length > 0) return c.json({ error: 'Email already registered' }, 400);

      // Generate salt and hash password
      const salt = crypto.randomUUID();
      const passwordHash = await sha256(password + salt);

      await db.insert(users).values({
        id: crypto.randomUUID(),
        username,
        email,
        passwordHash,
        salt,
        role: 'user',
        status: 'active'
      }).execute();

      return c.json({ status: 'success', message: 'User registered successfully' });
    } catch (err) {
      console.error('Registration error:', err);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  });

  // Login endpoint
  app.post('/login', async (c) => {
    try {
      const { email, password } = await c.req.json();
      const db = c.get('db');

      const safeProcessEnv = typeof process !== 'undefined' ? process.env : {} as Record<string, string | undefined>;
      const expectedUsername = c.env?.ADMIN_USERNAME || safeProcessEnv.ADMIN_USERNAME || 'admin@mail.com';
      const expectedPassword = c.env?.ADMIN_PASSWORD || safeProcessEnv.ADMIN_PASSWORD || 'lumbungs3admin';
      let username = email;

      let role = 'user';
      let userId: string | null = null;

      // 1. Check for Master Admin (.env credentials — ADMIN_USERNAME can be an email)
      if (email === expectedUsername && password === expectedPassword) {
        role = 'admin';
        username = expectedUsername;
        userId = null; // admin sees all
      } else {
        // 2. Check Database Users by email
        const [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1).execute();

        if (!dbUser) {
          return c.json({ error: 'Invalid email or password' }, 401);
        }

        if (dbUser.status === 'inactive') {
          return c.json({ error: 'Account has been deactivated by an administrator' }, 403);
        }

        const hash = await sha256(password + dbUser.salt);
        if (hash !== dbUser.passwordHash) {
          return c.json({ error: 'Invalid email or password' }, 401);
        }

        username = dbUser.username;
        userId = dbUser.id;
        role = dbUser.role || 'user';
      }

      // Generate a signed session token valid for 7 days
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const token = await signToken({ username, expiresAt, role, userId }, expectedPassword);

      return c.json({
        token,
        username,
        role,
        expiresAt,
        status: 'success'
      });
    } catch (err) {
      console.error('Login error:', err);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  });

  // Session verification endpoint
  app.get('/verify', adminAuth(), async (c) => {
    const user = c.get('user' as any);
    return c.json({
      status: 'authenticated',
      username: user.username,
      role: user.role
    });
  });

  // --- User Management (Super Admin Only) ---

  // List all users
  app.get('/users', superAdminAuth(), async (c) => {
    const db = c.get('db');
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt
    }).from(users).execute();
    return c.json(allUsers);
  });

  // Change user status (activate/deactivate)
  app.patch('/users/:id/status', superAdminAuth(), async (c) => {
    const id = c.req.param('id');
    const { status } = await c.req.json();
    const db = c.get('db');

    if (status !== 'active' && status !== 'inactive') {
      return c.json({ error: 'Invalid status' }, 400);
    }

    await db.update(users).set({ status }).where(eq(users.id, id)).execute();
    return c.json({ status: 'success' });
  });

  // Delete a user
  app.delete('/users/:id', superAdminAuth(), async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');

    await db.delete(users).where(eq(users.id, id)).execute();
    return c.json({ status: 'success' });
  });

  return app;
};
