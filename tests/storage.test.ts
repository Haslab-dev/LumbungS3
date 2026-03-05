import { expect, test, describe, beforeAll } from "bun:test";

const BASE_URL = "http://localhost:9000";

describe("LumbungS3 API Integration Tests", () => {
  const testBucket = `test-bucket-${Date.now()}`;

  beforeAll(async () => {
    // Ensure server is reachable
    try {
      await fetch(`${BASE_URL}/health`);
    } catch (e) {
      console.error("\n❌ ERROR: Test requires the server to be running (bun dev or bun backend/src/index.ts)\n");
      process.exit(1);
    }
  });

  test("GET /health should return ok", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  let testBucketId: string;

  test("POST /api/buckets should create a new bucket and set visibility to public", async () => {
    const res = await fetch(`${BASE_URL}/api/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: testBucket })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.name).toBe(testBucket);
    testBucketId = data.id;

    // Immediately make it public for download tests
    const patchRes = await fetch(`${BASE_URL}/api/buckets/${testBucketId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: 'public' })
    });
    expect(patchRes.status).toBe(200);
  });

  test("GET /api/buckets should list the new bucket", async () => {
    const res = await fetch(`${BASE_URL}/api/buckets`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((b: any) => b.name === testBucket)).toBe(true);
  });

  test("PUT /objects/:bucket/:key should upload a file", async () => {
    const content = "Hello World from Bun Test";
    const res = await fetch(`${BASE_URL}/objects/${testBucket}/test.txt`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: content
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("uploaded");
    expect(data.key).toBe("test.txt");
  });

  test("GET /objects/:bucket should list objects", async () => {
    const res = await fetch(`${BASE_URL}/objects/${testBucket}`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.some((o: any) => o.key === "test.txt")).toBe(true);
  });

  test("GET /objects/:bucket/:key should download file content", async () => {
    const res = await fetch(`${BASE_URL}/objects/${testBucket}/test.txt`);
    const content = await res.text();
    expect(res.status).toBe(200);
    expect(content).toBe("Hello World from Bun Test");
  });

  test("DELETE /objects/:bucket/:key should delete the file", async () => {
    const res = await fetch(`${BASE_URL}/objects/${testBucket}/test.txt`, {
      method: "DELETE"
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("deleted");
  });

  test("GET /api/metrics should reflect counts", async () => {
    const res = await fetch(`${BASE_URL}/api/metrics`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveProperty("bucketCount");
    expect(data).toHaveProperty("objectCount");
  });
});
