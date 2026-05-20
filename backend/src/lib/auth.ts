import type { MiddlewareHandler } from 'hono';
import { sha256 } from './hash';

export interface TokenPayload {
  username: string;
  expiresAt: number;
  role?: string;
  userId?: string | null;
}

/**
 * Encodes a JSON object and signs it with a secret key using SHA-256 HMAC-style digest.
 */
export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const payloadStr = JSON.stringify(payload);
  // Safe base64 encoding supporting unicode
  const base64Payload = btoa(unescape(encodeURIComponent(payloadStr)));
  const signature = await sha256(base64Payload + secret);
  return `${base64Payload}.${signature}`;
}

/**
 * Decodes and verifies a signed token against a secret key.
 * Returns the payload if valid and unexpired, otherwise null.
 */
export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [base64Payload, signature] = parts;
  const expectedSignature = await sha256(base64Payload + secret);
  
  if (signature !== expectedSignature) return null;
  
  try {
    const payloadStr = decodeURIComponent(escape(atob(base64Payload)));
    const payload = JSON.parse(payloadStr) as TokenPayload;
    
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null; // Token has expired
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Hono Middleware to protect general routes for any authenticated user.
 */
export const adminAuth = (): MiddlewareHandler => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.ADMIN_PASSWORD || 'lumbungs3admin';
    const payload = await verifyToken(token, secret);

    if (!payload) {
      return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
    }

    c.set('user' as any, payload);
    await next();
  };
};

/**
 * Hono Middleware to protect admin-only routes (e.g. user management).
 */
export const superAdminAuth = (): MiddlewareHandler => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.ADMIN_PASSWORD || 'lumbungs3admin';
    const payload = await verifyToken(token, secret);

    if (!payload) {
      return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
    }

    if (payload.role !== 'admin') {
      return c.json({ error: 'Forbidden: Requires super admin privileges' }, 403);
    }

    c.set('user' as any, payload);
    await next();
  };
};
