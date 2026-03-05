/**
 * 🚀 LumbungS3 Integration Test Script
 * This script tests single-part and multipart uploads/downloads.
 */

async function runTest() {
  const BACKEND_URL = 'http://localhost:9000';
  const BUCKET_NAME = 'test-bucket';
  
  console.log(`\n🧪 Testing LumbungS3 at ${BACKEND_URL}...`);

  try {
    // 1. Check if server is up
    const health = await fetch(`${BACKEND_URL}/health`).then(r => r.json());
    if (health.status !== 'ok') throw new Error('Backend not healthy');

    // 2. Create bucket (if not exists)
    console.log('📦 Creating/checking bucket...');
    await fetch(`${BACKEND_URL}/api/buckets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: BUCKET_NAME })
    });

    // 3. Simple Upload (Small File)
    const smallContent = 'Hello LumbungS3! Simple upload test.';
    const smallKey = 'test/small.txt';
    console.log(`📤 Uploading small file: ${smallKey}`);
    const upRes = await fetch(`${BACKEND_URL}/objects/${BUCKET_NAME}/${smallKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: smallContent
    }).then(r => r.json());
    console.log('✅ Small upload response:', upRes);

    // 4. Multipart Upload (Simulated with 3 chunks)
    const bigKey = 'test/multipart.dat';
    console.log(`🚀 Starting Multipart Upload: ${bigKey}`);
    
    // a. Initiate
    const { uploadId } = await fetch(`${BACKEND_URL}/objects/${BUCKET_NAME}/${bigKey}?uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' }
    }).then(r => r.json());
    console.log(`🆔 Upload ID: ${uploadId}`);

    // b. Upload Parts
    for (let p = 1; p <= 3; p++) {
      const chunkData = Buffer.alloc(1024 * 1024, `Part ${p} content `.repeat(100)); // 1MB chunk
      console.log(`   📤 Uploading Part ${p}...`);
      await fetch(`${BACKEND_URL}/objects/${BUCKET_NAME}/${bigKey}?uploadId=${uploadId}&partNumber=${p}`, {
        method: 'PUT',
        body: chunkData
      });
    }

    // c. Complete
    console.log('   🏁 Completing multipart upload...');
    const completeRes = await fetch(`${BACKEND_URL}/objects/${BUCKET_NAME}/${bigKey}?uploadId=${uploadId}`, {
      method: 'POST'
    }).then(r => r.json());
    console.log('✅ Multipart upload response:', completeRes);

    // 5. Download test
    console.log(`📥 Downloading back: ${smallKey}`);
    const downContent = await fetch(`${BACKEND_URL}/objects/${BUCKET_NAME}/${smallKey}`).then(r => r.text());
    if (downContent === smallContent) {
      console.log('✨ Data integrity verified! (Small)');
    } else {
      throw new Error(`Data mismatch! Got: ${downContent}`);
    }

    console.log('\n🌟 ALL TESTS PASSED SUCCESSFULLY! 🌟\n');
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTest();
