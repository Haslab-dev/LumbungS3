import { sha256 } from './hash';

const SECRET = "lumbung-secret-key-123"; // In production, this should be an env var

export async function signUrl(bucket: string, key: string, expiresAt: number) {
  const data = `${bucket}/${key}?expires=${expiresAt}`;
  const signature = await sha256(`${SECRET}:${data}`);
  return signature;
}

export async function verifyUrl(bucket: string, key: string, expires: string, signature: string) {
  const expiresAt = parseInt(expires);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const data = `${bucket}/${key}?expires=${expiresAt}`;
  const expectedSignature = await sha256(`${SECRET}:${data}`);
  
  return signature === expectedSignature;
}
