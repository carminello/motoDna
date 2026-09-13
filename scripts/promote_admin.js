// Promote a user to admin by email.
const { MongoClient } = require('/app/node_modules/mongodb');
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'motodna';
const EMAIL = process.argv[2] || 'carminellout@gmail.com';

(async () => {
  const c = new MongoClient(MONGO_URL);
  await c.connect();
  const db = c.db(DB_NAME);
  const r = await db.collection('users').updateOne(
    { email: EMAIL.toLowerCase() },
    { $set: { is_admin: true, updated_at: new Date() } }
  );
  console.log(`Matched: ${r.matchedCount}, Modified: ${r.modifiedCount} for ${EMAIL}`);
  const u = await db.collection('users').findOne({ email: EMAIL.toLowerCase() }, { projection: { email: 1, is_admin: 1, _id: 0 } });
  console.log('Now:', u);
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
