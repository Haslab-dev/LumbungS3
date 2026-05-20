import { handle } from 'hono/cloudflare-pages';
import { app } from '../backend/src/index';

export const onRequest = handle(app);
