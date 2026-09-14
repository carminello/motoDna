// One-shot index initialization for MotoDNA.
//
// Design notes:
//   - createIndex is idempotent per (keys, name, options): calling it again
//     with the same spec is a no-op. We NEVER dropIndex here — existing
//     indexes are left untouched.
//   - We use `background: true` implicitly (default on recent MongoDB) so
//     the initial creation on a warm DB doesn't block reads.
//   - Errors are logged but never bubbled: index creation is best-effort at
//     boot time. Individual failures (e.g. duplicate-key on a unique index
//     because of legacy dirty data) must not prevent the API from serving.
//
// If a `unique` index fails because of pre-existing duplicates, we retry
// without the unique flag so the query planner still gets an index. Cleaning
// duplicates is a separate migration outside this file's scope.

async function safeCreate(collection, keys, options = {}) {
  try {
    await collection.createIndex(keys, options);
  } catch (err) {
    // If a unique constraint clashes with legacy data, drop the unique flag
    // and create a non-unique index so the planner still benefits.
    const isUniqueConflict =
      options.unique && (err?.code === 11000 || /duplicate key/i.test(err?.message || ''));
    if (isUniqueConflict) {
      const { unique, ...rest } = options;
      try {
        await collection.createIndex(keys, rest);
        console.warn(
          `[MotoDNA/indexes] Unique index on ${collection.collectionName} ${JSON.stringify(keys)} `
          + `has duplicates in the collection; created NON-unique fallback. Please dedupe.`
        );
        return;
      } catch (err2) {
        console.warn(`[MotoDNA/indexes] Fallback index creation failed:`, err2?.message);
        return;
      }
    }
    // Some other error (mostly cosmetic like index-name conflict): log & move on.
    console.warn(
      `[MotoDNA/indexes] createIndex failed on ${collection.collectionName} `
      + `${JSON.stringify(keys)}: ${err?.message}`,
    );
  }
}

export async function ensureIndexes(db) {
  await Promise.all([
    // ---------- users ----------
    safeCreate(db.collection('users'), { email: 1 }, { unique: true, name: 'email_unique' }),
    safeCreate(db.collection('users'), { id: 1 }, { unique: true, name: 'id_unique' }),
    safeCreate(db.collection('users'), { last_seen: -1 }, { name: 'last_seen_desc' }),
    safeCreate(db.collection('users'), { created_at: -1 }, { name: 'created_at_desc' }),

    // ---------- motorcycles ----------
    safeCreate(db.collection('motorcycles'), { public_id: 1 }, { unique: true, name: 'public_id_unique' }),
    safeCreate(db.collection('motorcycles'), { id: 1 }, { unique: true, name: 'id_unique' }),
    safeCreate(db.collection('motorcycles'), { owner_id: 1, created_at: -1 }, { name: 'owner_created' }),

    // ---------- child collections (compound with sort key) ----------
    safeCreate(db.collection('maintenance'), { motorcycle_id: 1, date: -1 }, { name: 'moto_date_desc' }),
    safeCreate(db.collection('timeline'), { motorcycle_id: 1, event_date: -1 }, { name: 'moto_event_desc' }),
    safeCreate(db.collection('modifications'), { motorcycle_id: 1, installation_date: -1 }, { name: 'moto_install_desc' }),
    safeCreate(db.collection('gallery'), { motorcycle_id: 1, created_at: -1 }, { name: 'moto_created_desc' }),
    safeCreate(db.collection('documents'), { motorcycle_id: 1, document_date: -1 }, { name: 'moto_docdate_desc' }),
    safeCreate(db.collection('reminders'), { user_id: 1, status: 1 }, { name: 'user_status' }),
    safeCreate(db.collection('reminders'), { motorcycle_id: 1 }, { name: 'moto' }),

    // ---------- postits ----------
    safeCreate(db.collection('postits'), { motorcycle_id: 1, created_at: -1 }, { name: 'moto_created_desc' }),
    safeCreate(db.collection('postits'), { ip_hint: 1, created_at: -1 }, { name: 'ip_created_desc' }),

    // ---------- messages ----------
    safeCreate(db.collection('messages'), { from_user_id: 1, to_user_id: 1, created_at: -1 }, { name: 'from_to_created' }),
    safeCreate(db.collection('messages'), { to_user_id: 1, read_at: 1 }, { name: 'to_readat' }),

    // ---------- nfc ----------
    safeCreate(db.collection('nfc_tags'), { motorcycle_id: 1, status: 1 }, { name: 'moto_status' }),
    safeCreate(db.collection('nfc_tags'), { tag_uid: 1 }, { name: 'tag_uid' }),
    safeCreate(db.collection('nfc_scans'), { scanned_at: -1 }, { name: 'scanned_at_desc' }),

    // ---------- transfers ----------
    safeCreate(db.collection('transfers'), { code: 1 }, { unique: true, name: 'code_unique' }),
    safeCreate(db.collection('transfers'), { motorcycle_id: 1, status: 1 }, { name: 'moto_status' }),
  ]);
}
