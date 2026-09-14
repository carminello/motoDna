import { MongoClient } from 'mongodb';
import { ensureIndexes } from './initIndexes';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'motodna';

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

// Cache the ensureIndexes promise so it runs at most once per process.
// If it fails, we null the cache and retry lazily on the next getDb() call.
let indexesReady = null;

export async function getDb() {
  const c = await clientPromise;
  const db = c.db(dbName);
  if (!indexesReady) {
    indexesReady = ensureIndexes(db).catch((err) => {
      console.warn('[MotoDNA/mongo] Index init failed, will retry on next call:', err?.message);
      indexesReady = null;
    });
  }
  // We intentionally do NOT `await indexesReady` on every call — the first
  // request pays the (small) latency, subsequent ones don't wait. Since our
  // reads are all cursor-based they still work while indexes build in the
  // background. But we DO await it on cold start:
  if (indexesReady && typeof indexesReady.then === 'function') {
    try { await indexesReady; } catch (_) { /* handled above */ }
  }
  return db;
}

export default clientPromise;
