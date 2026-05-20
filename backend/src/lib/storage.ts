import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand, 
  AbortMultipartUploadCommand,
  CopyObjectCommand
} from "@aws-sdk/client-s3";

let fsModule: any = null;
let pathModule: any = null;

const getFs = () => {
  if (!fsModule) {
    const req = typeof require !== "undefined" ? eval("require") : null;
    if (!req) throw new Error("FileSystem operations are not supported in this environment (require is undefined).");
    fsModule = req("node:fs");
  }
  return fsModule;
};

const getPath = () => {
  if (!pathModule) {
    const req = typeof require !== "undefined" ? eval("require") : null;
    if (!req) throw new Error("Path operations are not supported in this environment (require is undefined).");
    pathModule = req("node:path");
  }
  return pathModule;
};

export interface StorageProvider {
  putObject(key: string, body: ArrayBuffer | Uint8Array, contentType?: string): Promise<void>;
  getObject(key: string): Promise<ArrayBuffer>;
  deleteObject(key: string): Promise<void>;
  
  // Multipart upload methods
  initiateMultipart(key: string, contentType?: string): Promise<string>; // Returns uploadId
  uploadPart(key: string, uploadId: string, partNumber: number, body: ArrayBuffer | Uint8Array): Promise<{ etag: string }>;
  completeMultipart(key: string, uploadId: string, parts: { partNumber: number, etag: string }[], destinationKey: string): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
}

// Local Storage Provider (uses fs)
export class LocalStorageProvider implements StorageProvider {
  private baseDir = "storage/objects";
  private tempDir = "storage/temp";

  constructor() {
    const fs = getFs();
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  private getFilePath(key: string): string {
    const path = getPath();
    const prefix = key.slice(0, 2);
    return path.join(this.baseDir, prefix, `${key}.object`);
  }

  async putObject(key: string, body: ArrayBuffer | Uint8Array, contentType?: string): Promise<void> {
    const fs = getFs();
    const path = getPath();
    const filePath = this.getFilePath(key);
    fs.mkdirSync(path.join(filePath, ".."), { recursive: true });
    await Bun.write(filePath, body);
  }

  async getObject(key: string): Promise<ArrayBuffer> {
    const fs = getFs();
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    const file = Bun.file(filePath);
    return await file.arrayBuffer();
  }

  async deleteObject(key: string): Promise<void> {
    const fs = getFs();
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async initiateMultipart(key: string, contentType?: string): Promise<string> {
    const fs = getFs();
    const path = getPath();
    const uploadId = crypto.randomUUID();
    fs.mkdirSync(path.join(this.tempDir, uploadId), { recursive: true });
    return uploadId;
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: ArrayBuffer | Uint8Array): Promise<{ etag: string }> {
    const path = getPath();
    const partPath = path.join(this.tempDir, uploadId, `${partNumber}.part`);
    await Bun.write(partPath, body);
    const etag = new Bun.CryptoHasher("md5").update(body).digest("hex");
    return { etag };
  }

  async completeMultipart(key: string, uploadId: string, parts: { partNumber: number, etag: string }[], destinationKey: string): Promise<void> {
    const fs = getFs();
    const path = getPath();
    const finalFilePath = this.getFilePath(destinationKey);
    fs.mkdirSync(path.join(finalFilePath, ".."), { recursive: true });
    if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);

    const tempUploadDir = path.join(this.tempDir, uploadId);
    // Sort parts by partNumber
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    for (const part of sortedParts) {
      const partPath = path.join(tempUploadDir, `${part.partNumber}.part`);
      if (!fs.existsSync(partPath)) {
        throw new Error(`Missing part: ${part.partNumber}`);
      }
      const data = fs.readFileSync(partPath);
      fs.appendFileSync(finalFilePath, data);
    }

    // Clean up temp dir
    fs.rmSync(tempUploadDir, { recursive: true, force: true });
  }

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    const fs = getFs();
    const path = getPath();
    const tempUploadDir = path.join(this.tempDir, uploadId);
    if (fs.existsSync(tempUploadDir)) {
      fs.rmSync(tempUploadDir, { recursive: true, force: true });
    }
  }
}

// S3 Storage Provider (uses AWS SDK)
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(config: {
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
  }) {
    const safeProcessEnv = typeof process !== "undefined" ? process.env : {} as Record<string, string | undefined>;
    const endpoint = config.endpoint || safeProcessEnv.S3_ENDPOINT;
    const accessKeyId = config.accessKeyId || safeProcessEnv.S3_ACCESS_KEY_ID;
    const secretAccessKey = config.secretAccessKey || safeProcessEnv.S3_SECRET_ACCESS_KEY;
    this.bucket = config.bucket || safeProcessEnv.S3_BUCKET || "lumbung-s3";

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("S3 Storage Provider requires accessKeyId and secretAccessKey credentials.");
    }

    this.client = new S3Client({
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region: "auto", // Required by R2
      forcePathStyle: true,
    });
  }

  private getS3Key(key: string): string {
    const prefix = key.slice(0, 2);
    return `objects/${prefix}/${key}.object`;
  }

  private getTempS3Key(uploadId: string): string {
    return `temp/${uploadId}`;
  }

  async putObject(key: string, body: ArrayBuffer | Uint8Array, contentType?: string): Promise<void> {
    const s3Key = this.getS3Key(key);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: body instanceof ArrayBuffer ? new Uint8Array(body) : body,
      ContentType: contentType,
    }));
  }

  async getObject(key: string): Promise<ArrayBuffer> {
    const s3Key = this.getS3Key(key);
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    }));

    if (!response.Body) {
      throw new Error(`S3 GetObject returned empty body for key: ${key}`);
    }

    const bytes = await response.Body.transformToByteArray();
    return bytes.buffer as ArrayBuffer;
  }

  async deleteObject(key: string): Promise<void> {
    const s3Key = this.getS3Key(key);
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    }));
  }

  async initiateMultipart(key: string, contentType?: string): Promise<string> {
    const uploadId = crypto.randomUUID();
    const tempKey = this.getTempS3Key(uploadId);
    
    const response = await this.client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: tempKey,
      ContentType: contentType,
    }));
    
    if (!response.UploadId) {
      throw new Error("Failed to initiate S3 Multipart Upload: No UploadId received.");
    }
    
    // We return a combined string containing both our Hono uploadId and S3's native uploadId
    // format: honoUploadId:s3UploadId
    return `${uploadId}:${response.UploadId}`;
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: ArrayBuffer | Uint8Array): Promise<{ etag: string }> {
    const [honoId, s3UploadId] = uploadId.split(":");
    const tempKey = this.getTempS3Key(honoId);
    
    const response = await this.client.send(new UploadPartCommand({
      Bucket: this.bucket,
      Key: tempKey,
      UploadId: s3UploadId,
      PartNumber: partNumber,
      Body: body instanceof ArrayBuffer ? new Uint8Array(body) : body,
    }));
    
    if (!response.ETag) {
      throw new Error(`Failed to upload part ${partNumber}: No ETag returned.`);
    }
    
    return { etag: response.ETag };
  }

  async completeMultipart(key: string, uploadId: string, parts: { partNumber: number, etag: string }[], destinationKey: string): Promise<void> {
    const [honoId, s3UploadId] = uploadId.split(":");
    const tempKey = this.getTempS3Key(honoId);
    
    // Complete the multipart upload at the temporary key
    await this.client.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: tempKey,
      UploadId: s3UploadId,
      MultipartUpload: {
        Parts: parts.map(p => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    }));

    // Copy completed object to final destination key
    const s3DestKey = this.getS3Key(destinationKey);
    const s3SourcePath = `${this.bucket}/${tempKey}`;
    
    // Modern JS AWS SDK CopyObjectCommand
    await this.client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: s3DestKey,
      CopySource: s3SourcePath,
    }));

    // Delete temporary completed object
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: tempKey,
    }));
  }

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    const [honoId, s3UploadId] = uploadId.split(":");
    const tempKey = this.getTempS3Key(honoId);
    
    await this.client.send(new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: tempKey,
      UploadId: s3UploadId,
    }));
  }
}

// Factory function
export const getStorage = (env?: any): StorageProvider => {
  const safeProcessEnv = typeof process !== "undefined" ? process.env : {} as Record<string, string | undefined>;
  const provider = env?.STORAGE_PROVIDER || safeProcessEnv.STORAGE_PROVIDER || "s3";
  const isCloudflare = typeof (globalThis as any).WebSocketPair !== "undefined" || (typeof Bun === "undefined" && typeof process === "undefined");

  if (provider === "s3" || isCloudflare) {
    try {
      return new S3StorageProvider({
        endpoint: env?.S3_ENDPOINT || safeProcessEnv.S3_ENDPOINT,
        accessKeyId: env?.S3_ACCESS_KEY_ID || safeProcessEnv.S3_ACCESS_KEY_ID,
        secretAccessKey: env?.S3_SECRET_ACCESS_KEY || safeProcessEnv.S3_SECRET_ACCESS_KEY,
        bucket: env?.S3_BUCKET || safeProcessEnv.S3_BUCKET,
      });
    } catch (e) {
      if (isCloudflare) {
        // If in Cloudflare, we must never fall back to LocalStorageProvider because it relies on node:fs and will crash.
        // Instead, throw the original credentials exception.
        throw e;
      }
      console.warn("⚠️ S3 Credentials missing. Falling back to Local Storage Provider:", (e as Error).message);
      return new LocalStorageProvider();
    }
  }

  return new LocalStorageProvider();
};
