const fs = require('fs');

async function run() {
  try {
    // 1. Get token
    console.log("Getting token...");
    const tokenRes = await fetch(
      'http://localhost:8080/realms/docvault/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: 'docvault-gateway',
          client_secret: 'dev-gateway-secret',
          grant_type: 'password',
          username: 'editor1',
          password: 'Passw0rd!'
        })
      }
    );
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    console.log("- Token acquired.");

    // 2. Upload
    console.log("\nUploading file...");
    const form = new FormData();
    form.append('title', 'Native Fetch Upload');
    form.append('description', 'Native fetch E2E script');
    
    // We must read the file fully into a Blob or buffer for Node's native fetch FormData
    const buffer = fs.readFileSync('./README.md');
    const blob = new Blob([buffer], { type: 'text/markdown' });
    form.append('file', blob, 'README.md');

    const uploadRes = await fetch('http://localhost:3000/metadata/documents/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    
    if (!uploadRes.ok) throw new Error(`Upload failed ${uploadRes.status} ${await uploadRes.text()}`);
    const uploadData = await uploadRes.json();
    const docId = uploadData.id;
    console.log("- Upload Success! Document ID:", docId);

    // 3. Download URL
    console.log("\nFetching Presigned URL...");
    const urlRes = await fetch(`http://localhost:3000/metadata/documents/${docId}/download-url`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!urlRes.ok) throw new Error(`URL failed ${urlRes.status} ${await urlRes.text()}`);
    
    console.log("- Success! URL Data:", await urlRes.json());

    // 4. Download Stream
    console.log("\nFetching Direct Stream...");
    const streamRes = await fetch(`http://localhost:3000/metadata/documents/${docId}/download`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!streamRes.ok) throw new Error(`Stream failed ${streamRes.status} ${await streamRes.text()}`);
    
    const arrayBuffer = await streamRes.arrayBuffer();
    console.log(`- Success! Stream downloaded ${arrayBuffer.byteLength} bytes.`);
    
  } catch (e) {
    console.error("\n[ERROR]", e);
  }
}

run();
