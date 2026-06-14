const { MongoClient } = require('mongodb');

async function main() {
  const uri =
    process.env.AUDIT_MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/docvault_audit?directConnection=true';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('docvault_audit');
    const events = await db.collection('audit_events').find({
      action: { $in: ['DOCUMENT_CREATED', 'DOCUMENT_UPLOADED'] }
    }).sort({ timestamp: -1 }).limit(1).toArray();
    console.log(JSON.stringify(events, null, 2));
  } finally {
    await client.close();
  }
}
main().catch(console.error);
