const SECRET = "lumbung-secret-key-123"; // In production, this should be an env var

export async function signUrl(bucket: string, key: string, expiresAt: number) {
  const data = `${bucket}/${key}?expires=${expiresAt}`;
  const signature = await new Bun.CryptoHasher("sha256", SECRET).update(data).digest("hex");
  return signature;
}

export async function verifyUrl(bucket: string, key: string, expires: string, signature: string) {
  const expiresAt = parseInt(expires);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const data = `${bucket}/${key}?expires=${expiresAt}`;
  const expectedSignature = await new Bun.CryptoHasher("sha256", SECRET).update(data).digest("hex");
  
  return signature === expectedSignature;
}
