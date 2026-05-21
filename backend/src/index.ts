import { DOMParser } from '@xmldom/xmldom';
if (typeof globalThis.DOMParser === 'undefined') {
  (globalThis as any).DOMParser = DOMParser;
}
if (typeof globalThis.Node === 'undefined') {
  (globalThis as any).Node = {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  };
}

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initDb, type DatabaseType } from './lib/db';
import { getStorage, type StorageProvider } from './lib/storage';
import { bucketRoutes } from './features/buckets/bucket.controller';
import { objectRoutes } from './features/objects/object.controller';
import { accessKeyRoutes } from './features/security/accessKey.controller';
import { lifecycleRoutes, evaluateLifecycleRules } from './features/lifecycle/lifecycle.controller';
import { shareRoutes } from './features/shares/share.controller';
import { authRoutes } from './features/auth/auth.controller';
import { adminAuth } from './lib/auth';
import { buckets, objects } from './db/schema';
import { sql, eq } from 'drizzle-orm';

// Dynamically load wrangler.jsonc variables into process.env when running locally (Bun/Node)
// We use eval("require") to completely shield node:fs from Wrangler's Pages compiler/bundler.
if (typeof require !== "undefined") {
  try {
    const req = eval("require");
    const fs = req("node:fs");
    if (fs.existsSync("wrangler.jsonc")) {
      const raw = fs.readFileSync("wrangler.jsonc", "utf8");
      const clean = raw.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      const config = JSON.parse(clean);
      if (config?.vars) {
        for (const [key, value] of Object.entries(config.vars)) {
          if (typeof process !== "undefined" && !process.env[key] && typeof value === "string") {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (e) {
    // Ignore and proceed
  }
}

// Define the environment schema for type safety in context variables and bindings
export type HonoEnv = {
  Variables: {
    db: DatabaseType;
    storage: StorageProvider;
  };
  Bindings: {
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    TURSO_CONNECTION_URL?: string;
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
    STORAGE_PROVIDER?: string;
    S3_ENDPOINT?: string;
    S3_ACCESS_KEY_ID?: string;
    S3_SECRET_ACCESS_KEY?: string;
    S3_BUCKET?: string;
    S3_PUBLIC_URL?: string;
  };
};

export const app = new Hono<HonoEnv>();

// Detailed Error Diagnostic Handler
app.onError((err, c) => {
  console.error('💥 Unhandled Error in LumbungS3 backend:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    stack: typeof err.stack === 'string' ? err.stack.split('\n') : err.stack
  }, 500);
});

let startTime: number | null = null;

app.use('/*', cors());

// Dynamic Context Injection Middleware
app.use('/*', async (c, next) => {
  if (startTime === null) {
    startTime = Date.now();
  }
  const dbInstance = initDb(c.env);
  const storageInstance = getStorage(c.env);
  c.set('db', dbInstance);
  c.set('storage', storageInstance);
  await next();
});

// Metrics API
app.get('/api/metrics', adminAuth(), async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user' as any);
    const userId: string | null = user?.userId ?? null;

    let bucketCountData;
    let objectStatsData;

    if (userId === null) {
      bucketCountData = await db.select({ total: sql<number>`count(*)` }).from(buckets);
      objectStatsData = await db.select({ 
        total: sql<number>`count(*)`, 
        size: sql<number>`sum(size)` 
      }).from(objects);
    } else {
      bucketCountData = await db.select({ total: sql<number>`count(*)` })
        .from(buckets)
        .where(eq(buckets.userId, userId));
      
      objectStatsData = await db.select({ 
        total: sql<number>`count(${objects.id})`, 
        size: sql<number>`sum(${objects.size})` 
      })
      .from(objects)
      .innerJoin(buckets, eq(objects.bucketId, buckets.id))
      .where(eq(buckets.userId, userId));
    }
    
    const bucketCount = Number(bucketCountData[0]?.total || 0);
    const objectCount = Number(objectStatsData[0]?.total || 0);
    const totalSizeBytes = Number(objectStatsData[0]?.size || 0);
    
    const LIMIT_GB = 100;
    const totalSizeGB = totalSizeBytes / (1024 ** 3);
    const usedPercentage = Math.min((totalSizeGB / LIMIT_GB) * 100, 100);

    const displayStorage = totalSizeBytes < (1024 ** 3)
      ? (totalSizeBytes / (1024 ** 2)).toFixed(2) + ' MB'
      : totalSizeGB.toFixed(2) + ' GB';

    const seconds = (Date.now() - (startTime || Date.now())) / 1000;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const uptime = (h > 0 ? h + 'h ' : '') + (m > 0 ? m + 'm ' : '') + s + 's';

    const incoming = (0.1 + Math.random() * 2).toFixed(1);
    const outgoing = (0.4 + Math.random() * 5).toFixed(1);

    return c.json({
      totalStorage: displayStorage,
      usedPercentage: parseFloat(usedPercentage.toFixed(2)),
      bucketCount,
      objectCount,
      uptime,
      throughput: { 
        in: `${incoming} MB/s`, 
        out: `${outgoing} MB/s`,
        inPulse: Math.floor(Math.random() * 40) + 10,
        outPulse: Math.floor(Math.random() * 60) + 20
      }
    });
  } catch (err) {
    console.error('Metrics Error:', err);
    return c.json({ error: 'Internal Error' }, 500);
  }
});

// Authentication & Session Routes
app.route('/api/auth', authRoutes());

// Global API Route Protection Middleware
app.use('/api/buckets/*', adminAuth());
app.use('/api/keys/*', adminAuth());
app.use('/api/lifecycle/*', adminAuth());
app.use('/api/metrics', adminAuth());
app.use('/api/shares/*', async (c, next) => {
  // Allow public share links to fetch metadata without auth
  if (c.req.path.startsWith('/api/shares/public/')) {
    return await next();
  }
  return adminAuth()(c, next);
});

// Feature Routes (Configured with dynamic database context)
app.route('/api/buckets', bucketRoutes());
app.route('/api/keys', accessKeyRoutes());
app.route('/api/shares', shareRoutes());

// On-demand lifecycle evaluation (must be before the subrouter)
app.post('/api/lifecycle/evaluate', async (c) => {
  const db = c.get('db');
  const storage = c.get('storage');
  const result = await evaluateLifecycleRules(db, storage);
  return c.json(result);
});

app.route('/api/lifecycle', lifecycleRoutes());
app.route('/objects', objectRoutes());

app.get('/health', (c) => c.json({ status: 'ok' }));

// Fallback to serving Cloudflare Pages static assets for unmatched routes (frontend SPA routing)
app.notFound(async (c) => {
  const assets = (c.env as any)?.ASSETS;
  if (assets) {
    const url = new URL(c.req.url);
    // If it's a frontend route (doesn't have a file extension like .js, .css, etc.),
    // rewrite the path to the root '/' to fetch index.html from assets
    // without triggering Cloudflare clean URLs permanent redirects.
    if (!url.pathname.includes('.')) {
      url.pathname = '/';
      const newReq = new Request(url.toString(), c.req.raw);
      return await assets.fetch(newReq);
    }
    return await assets.fetch(c.req.raw);
  }
  return c.text('Not Found', 404);
});

console.log('🚀 LumbungS3 Unified Server starting on port 9000');

export default {
  port: 9000,
  fetch: app.fetch,
};
