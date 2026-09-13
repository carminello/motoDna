// Delete all test users and their related data. Keep only real users.
const { MongoClient } = require('/app/node_modules/mongodb');
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'motodna';

// Real users to KEEP (by email)
const KEEP = new Set([
  'carminellout@gmail.com',
]);

(async () => {
  const c = new MongoClient(MONGO_URL);
  await c.connect();
  const db = c.db(DB_NAME);

  const allUsers = await db.collection('users').find({}).toArray();
  const toDelete = allUsers.filter(u => !KEEP.has(u.email));
  const idsToDelete = toDelete.map(u => u.id);

  console.log(`Total users: ${allUsers.length}`);
  console.log(`To keep: ${allUsers.length - toDelete.length}`);
  console.log(`To delete: ${toDelete.length}`);
  toDelete.forEach(u => console.log('  DEL', u.email));

  if (idsToDelete.length === 0) { await c.close(); return; }

  // Collect motorcycle IDs of those users
  const bikes = await db.collection('motorcycles').find({ owner_id: { $in: idsToDelete } }).toArray();
  const bikeIds = bikes.map(b => b.id);
  console.log(`Bikes to delete: ${bikeIds.length}`);

  // Delete related data
  const collections = ['maintenance', 'timeline', 'modifications', 'gallery', 'documents', 'reminders', 'nfc_tags', 'nfc_scans', 'postits', 'ownership_history', 'transfers'];
  for (const coll of collections) {
    const r = await db.collection(coll).deleteMany({ motorcycle_id: { $in: bikeIds } });
    console.log(`  ${coll} deleted: ${r.deletedCount}`);
  }

  // Messages by/to these users
  const msgRes = await db.collection('messages').deleteMany({
    $or: [{ from_user_id: { $in: idsToDelete } }, { to_user_id: { $in: idsToDelete } }]
  });
  console.log(`  messages deleted: ${msgRes.deletedCount}`);

  // Reminders by user (in addition to by motorcycle)
  await db.collection('reminders').deleteMany({ user_id: { $in: idsToDelete } });

  // Delete the bikes
  const bikeRes = await db.collection('motorcycles').deleteMany({ id: { $in: bikeIds } });
  console.log(`Bikes deleted: ${bikeRes.deletedCount}`);

  // Delete the users
  const userRes = await db.collection('users').deleteMany({ id: { $in: idsToDelete } });
  console.log(`Users deleted: ${userRes.deletedCount}`);

  await c.close();
  console.log('Done!');
})().catch(e => { console.error(e); process.exit(1); });
