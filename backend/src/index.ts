import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initDb } from './lib/db';
import { bucketRoutes } from './features/buckets/bucket.controller';
import { objectRoutes } from './features/objects/object.controller';
import { accessKeyRoutes } from './features/security/accessKey.controller';
import { buckets, objects } from './db/schema';
import { sql } from 'drizzle-orm';

const db = initDb();
const app = new Hono();

app.use('/*', cors());

// Metrics API
app.get('/api/metrics', async (c) => {
  try {
    // Standardizing SELECT queries
    const bucketCountData = await db.select({ total: sql<number>`count(*)` }).from(buckets);
    const objectStatsData = await db.select({ 
      total: sql<number>`count(*)`, 
      size: sql<number>`sum(size)` 
    }).from(objects);
    
    const bucketCount = Number(bucketCountData[0]?.total || 0);
    const objectCount = Number(objectStatsData[0]?.total || 0);
    const totalSizeBytes = Number(objectStatsData[0]?.size || 0);
    
    const LIMIT_GB = 100;
    const totalSizeGB = totalSizeBytes / (1024 ** 3);
    const usedPercentage = Math.min((totalSizeGB / LIMIT_GB) * 100, 100);

    const displayStorage = totalSizeBytes < (1024 ** 3)
      ? (totalSizeBytes / (1024 ** 2)).toFixed(2) + ' MB'
      : totalSizeGB.toFixed(2) + ' GB';

    const seconds = process.uptime();
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

// Feature Routes
app.route('/api/buckets', bucketRoutes(db));
app.route('/api/keys', accessKeyRoutes(db));
app.route('/objects', objectRoutes(db));

app.get('/health', (c) => c.json({ status: 'ok' }));

console.log('🚀 LumbungS3 Unified Server starting on port 9000');

export default {
  port: 9000,
  fetch: app.fetch,
};
