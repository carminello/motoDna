const { MongoClient } = require('/app/node_modules/mongodb');
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'motodna';
(async () => {
  const c = new MongoClient(MONGO_URL);
  await c.connect();
  const db = c.db(DB_NAME);
  const users = await db.collection('users').find({}, { projection: { _id: 0, id: 1, email: 1, username: 1, first_name: 1, created_at: 1 } }).sort({ created_at: 1 }).toArray();
  console.log('Total users:', users.length);
  users.forEach(u => console.log(u.email, '|', u.username, '|', u.id, '|', new Date(u.created_at).toISOString()));
  await c.close();
})();
