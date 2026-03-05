import { expect, test, describe, beforeAll } from "bun:test";

const BASE_URL = "http://localhost:9000";

describe("Phase 2: Object Versioning", () => {
  const bucket = `versioning-test-${Date.now()}`;
  let bucketId: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bucket })
    });
    const data = await res.json();
    bucketId = data.id;

    // Make bucket public for easy download testing
    await fetch(`${BASE_URL}/api/buckets/${bucketId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: "public" })
    });
  });

  test("PATCH /api/buckets/:id/versioning should enable versioning", async () => {
    const res = await fetch(`${BASE_URL}/api/buckets/${bucketId}/versioning`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versioning: "enabled" })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.versioning).toBe("enabled");
  });

  test("Uploading same key should create versions", async () => {
    // Upload version 1
    const r1 = await fetch(`${BASE_URL}/objects/${bucket}/doc.txt`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "Version 1 content"
    });
    const d1 = await r1.json();
    expect(d1.versionId).toBeTruthy();

    // Upload version 2
    const r2 = await fetch(`${BASE_URL}/objects/${bucket}/doc.txt`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "Version 2 content"
    });
    const d2 = await r2.json();
    expect(d2.versionId).toBeTruthy();
    expect(d2.versionId).not.toBe(d1.versionId);
  });

  test("GET /objects/:bucket/:key/versions should list all versions", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/doc.txt/versions`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.versioning).toBe("enabled");
    expect(data.versions.length).toBeGreaterThanOrEqual(2);
    
    // Only one should be latest
    const latestVersions = data.versions.filter((v: any) => v.isLatest);
    expect(latestVersions.length).toBe(1);
  });

  test("Latest download should return newest content", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/doc.txt`);
    const content = await res.text();
    expect(content).toBe("Version 2 content");
  });

  test("Delete should create a delete marker", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/doc.txt`, {
      method: "DELETE"
    });
    const data = await res.json();
    expect(data.status).toBe("delete_marker_created");

    // Listing should no longer show the object
    const listRes = await fetch(`${BASE_URL}/objects/${bucket}`);
    const listData = await listRes.json();
    const found = listData.find((o: any) => o.key === "doc.txt" && !o.isDeleteMarker);
    expect(found).toBeUndefined();
  });

  test("Versions should still exist after soft delete", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/doc.txt/versions`);
    const data = await res.json();
    // Should have v1, v2, and the delete marker
    expect(data.versions.length).toBeGreaterThanOrEqual(3);
    const deleteMarkers = data.versions.filter((v: any) => v.isDeleteMarker);
    expect(deleteMarkers.length).toBe(1);
  });
});

describe("Phase 2: Object Metadata & Tags", () => {
  const bucket = `metadata-test-${Date.now()}`;
  let bucketId: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bucket })
    });
    const data = await res.json();
    bucketId = data.id;

    await fetch(`${BASE_URL}/api/buckets/${bucketId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: "public" })
    });

    // Upload a test object
    await fetch(`${BASE_URL}/objects/${bucket}/readme.md`, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: "# Hello"
    });
  });

  test("PUT /objects/:bucket/:key/metadata should set metadata", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/readme.md/metadata`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "testuser", project: "lumbungs3" })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("updated");
  });

  test("GET /objects/:bucket/:key/metadata should return metadata", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/readme.md/metadata`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.author).toBe("testuser");
    expect(data.project).toBe("lumbungs3");
  });

  test("PUT /objects/:bucket/:key/tagging should set tags", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/readme.md/tagging`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env: "production", team: "backend" })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("updated");
  });

  test("GET /objects/:bucket/:key/tagging should return tags", async () => {
    const res = await fetch(`${BASE_URL}/objects/${bucket}/readme.md/tagging`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.env).toBe("production");
    expect(data.team).toBe("backend");
  });

  test("DELETE /objects/:bucket/:key/tagging should remove all tags", async () => {
    const delRes = await fetch(`${BASE_URL}/objects/${bucket}/readme.md/tagging`, {
      method: "DELETE"
    });
    expect(delRes.status).toBe(200);

    const res = await fetch(`${BASE_URL}/objects/${bucket}/readme.md/tagging`);
    const data = await res.json();
    expect(Object.keys(data).length).toBe(0);
  });

  test("Tags should have a maximum of 10", async () => {
    const tooManyTags: Record<string, string> = {};
    for (let i = 0; i < 11; i++) tooManyTags[`key${i}`] = `val${i}`;

    const res = await fetch(`${BASE_URL}/objects/${bucket}/readme.md/tagging`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tooManyTags)
    });
    expect(res.status).toBe(400);
  });
});

describe("Phase 2: Lifecycle Rules", () => {
  const bucket = `lifecycle-test-${Date.now()}`;
  let bucketId: string;
  let ruleId: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bucket })
    });
    const data = await res.json();
    bucketId = data.id;
  });

  test("POST /api/lifecycle/:bucketId should create a rule", async () => {
    const res = await fetch(`${BASE_URL}/api/lifecycle/${bucketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Expire old logs",
        prefix: "logs/",
        expirationDays: 30,
        noncurrentExpirationDays: 7
      })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("created");
    ruleId = data.id;
  });

  test("GET /api/lifecycle/:bucketId should list rules", async () => {
    const res = await fetch(`${BASE_URL}/api/lifecycle/${bucketId}`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].name).toBe("Expire old logs");
    expect(data[0].expirationDays).toBe(30);
  });

  test("PATCH /api/lifecycle/:bucketId/:ruleId should update rule", async () => {
    const res = await fetch(`${BASE_URL}/api/lifecycle/${bucketId}/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expirationDays: 60, status: "disabled" })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("updated");

    // Verify
    const listRes = await fetch(`${BASE_URL}/api/lifecycle/${bucketId}`);
    const listData = await listRes.json();
    expect(listData[0].expirationDays).toBe(60);
    expect(listData[0].status).toBe("disabled");
  });

  test("POST /api/lifecycle/evaluate should run evaluation", async () => {
    const res = await fetch(`${BASE_URL}/api/lifecycle/evaluate`, {
      method: "POST"
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveProperty("evaluated");
    expect(data).toHaveProperty("actions");
  });

  test("DELETE /api/lifecycle/:bucketId/:ruleId should delete rule", async () => {
    const res = await fetch(`${BASE_URL}/api/lifecycle/${bucketId}/${ruleId}`, {
      method: "DELETE"
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("deleted");

    const listRes = await fetch(`${BASE_URL}/api/lifecycle/${bucketId}`);
    const listData = await listRes.json();
    expect(listData.length).toBe(0);
  });
});
