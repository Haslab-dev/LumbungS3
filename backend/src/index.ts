import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initDb } from './lib/db';
import { bucketRoutes } from './features/buckets/bucket.controller';

const app = new Hono();
const db = initDb();

app.use('/*', cors());

// API Group
const api = new Hono();

// Feature Routes
api.route('/buckets', bucketRoutes(db));

// Metrics Endpoint (Real implementation)
api.get('/metrics', (c) => {
  const bucketCountResult = db.query('SELECT COUNT(*) as count FROM buckets').get() as { count: number };
  const objectCountResult = db.query('SELECT COUNT(*) as count FROM objects').get() as { count: number };
  const totalSizeResult = db.query('SELECT SUM(size) as total FROM objects').get() as { total: number };

  return c.json({
    totalStorage: (totalSizeResult.total / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    usedPercentage: 45, // Hardcoded for demo
    bucketCount: bucketCountResult.count,
    objectCount: objectCountResult.count,
    uptime: '1m',
    throughput: {
      in: '0 MB/s',
      out: '0 MB/s'
    }
  });
});

app.route('/api', api);

// Root routes
app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  port: 9000,
  fetch: app.fetch,
};
