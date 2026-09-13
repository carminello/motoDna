import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId, GridFSBucket } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { hashPassword, verifyPassword, signToken, getUserFromRequest } from '@/lib/auth';
import { generatePublicId, generateTagUid, generatePublicToken, generateTransferCode } from '@/lib/publicId';
import { seedDemoForUser } from '@/lib/seedDemo';

export const runtime = 'nodejs';

const json = (data, status = 200) => NextResponse.json(data, { status });

async function getBucket() {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: 'uploads' });
}

function setAuthCookie(response, token) {
  response.cookies.set('motodna_token', token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: 60 * 60 * 24 * 30, secure: true,
  });
  return response;
}

async function handler(request, { params }) {
  const resolved = await params;
  const p = resolved?.path || [];
  const method = request.method;
  const path = '/' + p.join('/');

  try {
    const db = await getDb();

    // ============== FILES (public GET) ==============
    if (p[0] === 'files' && p[1] && method === 'GET') {
      const idStr = p[1].split('.')[0]; // strip extension if any
      if (!ObjectId.isValid(idStr)) return new NextResponse('Not found', { status: 404 });
      const bucket = await getBucket();
      const fileId = new ObjectId(idStr);
      const files = await bucket.find({ _id: fileId }).toArray();
      if (!files[0]) return new NextResponse('Not found', { status: 404 });
      const file = files[0];
      const stream = bucket.openDownloadStream(fileId);
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        },
        cancel() { stream.destroy(); },
      });
      return new NextResponse(webStream, {
        headers: {
          'Content-Type': file.contentType || 'application/octet-stream',
          'Content-Length': String(file.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // ============== AUTH ==============
    if (path === '/auth/register' && method === 'POST') {
      const body = await request.json();
      const { email, password, first_name, last_name, username } = body;
      if (!email || !password) return json({ error: 'Email e password richiesti' }, 400);
      const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
      if (existing) return json({ error: 'Email già registrata' }, 400);
      const id = uuidv4();
      const now = new Date();
      const user = {
        id, email: email.toLowerCase(),
        password_hash: await hashPassword(password),
        first_name: first_name || '', last_name: last_name || '',
        username: username || email.split('@')[0],
        profile_photo: null, country: '', status: 'ACTIVE',
        created_at: now, updated_at: now,
      };
      await db.collection('users').insertOne(user);
      await seedDemoForUser(db, id);
      const token = signToken({ sub: id, email: user.email });
      const res = json({ user: { id, email: user.email, first_name: user.first_name, last_name: user.last_name, username: user.username } });
      setAuthCookie(res, token);
      return res;
    }

    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = await request.json();
      const user = await db.collection('users').findOne({ email: (email || '').toLowerCase() });
      if (!user) return json({ error: 'Credenziali non valide' }, 401);
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) return json({ error: 'Credenziali non valide' }, 401);
      const token = signToken({ sub: user.id, email: user.email });
      const res = json({ user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, username: user.username } });
      setAuthCookie(res, token);
      return res;
    }

    if (path === '/auth/logout' && method === 'POST') {
      const res = json({ ok: true });
      res.cookies.set('motodna_token', '', { path: '/', maxAge: 0 });
      return res;
    }

    if (path === '/auth/me' && method === 'GET') {
      const auth = await getUserFromRequest(request);
      if (!auth) return json({ user: null });
      const user = await db.collection('users').findOne({ id: auth.sub }, { projection: { password_hash: 0, _id: 0 } });
      return json({ user });
    }

    // ============== PUBLIC PROFILE ==============
    if (p[0] === 'public' && p[1] && method === 'GET') {
      const publicId = p[1];
      const moto = await db.collection('motorcycles').findOne({ public_id: publicId }, { projection: { _id: 0 } });
      if (!moto) return json({ error: 'Moto non trovata' }, 404);
      if (!moto.public_profile) return json({ error: 'Profilo privato' }, 403);
      const ownerId = moto.owner_id;
      // Strip private fields before exposing to public
      delete moto.plate;
      delete moto.owner_id;
      delete moto.is_demo;
      const owner = await db.collection('users').findOne({ id: ownerId }, { projection: { username: 1, first_name: 1, profile_photo: 1, _id: 0 } });
      const maintenance = await db.collection('maintenance').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0, cost: 0, currency: 0 } }).sort({ date: -1 }).limit(50).toArray();
      const timeline = await db.collection('timeline').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0 } }).sort({ event_date: -1 }).limit(50).toArray();
      const modifications = await db.collection('modifications').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0, cost: 0 } }).sort({ installation_date: -1 }).limit(50).toArray();
      const gallery = await db.collection('gallery').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(100).toArray();
      const postits = await db.collection('postits').find({ motorcycle_id: moto.id, is_hidden: { $ne: true } }, { projection: { _id: 0, ip_hint: 0 } }).sort({ created_at: -1 }).limit(200).toArray();
      const nfc = await db.collection('nfc_tags').findOne({ motorcycle_id: moto.id, status: 'ACTIVE' }, { projection: { _id: 0, scan_count: 1 } });
      db.collection('nfc_tags').updateOne({ motorcycle_id: moto.id, status: 'ACTIVE' }, { $inc: { scan_count: 1 }, $set: { last_scan_at: new Date() } }).catch(() => {});
      db.collection('nfc_scans').insertOne({ id: uuidv4(), motorcycle_id: moto.id, scanned_at: new Date(), device_type: (request.headers.get('user-agent') || '').slice(0, 200) }).catch(() => {});
      return json({ moto, owner, maintenance, timeline, modifications, gallery, postits, scan_count: (nfc?.scan_count || 0) + 1 });
    }

    // ============== PUBLIC POST-IT (no auth) ==============
    if (p[0] === 'public' && p[1] && p[2] === 'postit' && method === 'POST') {
      const publicId = p[1];
      const moto = await db.collection('motorcycles').findOne({ public_id: publicId, public_profile: true });
      if (!moto) return json({ error: 'Moto non trovata' }, 404);
      const body = await request.json().catch(() => ({}));
      const message = String(body.message || '').trim().slice(0, 500);
      const author = String(body.author_name || '').trim().slice(0, 60) || 'Anonimo';
      if (!message) return json({ error: 'Messaggio richiesto' }, 400);
      // Very light anti-spam: reject if same IP posted >5 times in last minute
      const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
      const recent = await db.collection('postits').countDocuments({ motorcycle_id: moto.id, ip_hint: ip, created_at: { $gt: new Date(Date.now() - 60_000) } });
      if (recent >= 5) return json({ error: 'Troppi messaggi, riprova tra un minuto' }, 429);
      const doc = {
        id: uuidv4(), motorcycle_id: moto.id,
        author_name: author, message,
        is_hidden: false, ip_hint: ip.slice(0, 45),
        created_at: new Date(),
      };
      await db.collection('postits').insertOne(doc);
      delete doc._id; delete doc.ip_hint;
      return json({ postit: doc }, 201);
    }

    // ============== AUTHENTICATED ==============
    const auth = await getUserFromRequest(request);
    if (!auth) return json({ error: 'Non autorizzato' }, 401);
    const userId = auth.sub;

    // ============== OWNERSHIP TRANSFER ==============
    // GET /api/transfer/:code -> preview (auth)
    if (p[0] === 'transfer' && p[1] && !p[2] && method === 'GET') {
      const t = await db.collection('transfers').findOne({ code: p[1].toUpperCase(), status: 'PENDING' });
      if (!t) return json({ error: 'Codice non valido o già utilizzato' }, 404);
      if (t.expires_at < new Date()) return json({ error: 'Codice scaduto' }, 410);
      const moto = await db.collection('motorcycles').findOne({ id: t.motorcycle_id }, { projection: { _id: 0, owner_id: 0 } });
      const fromUser = await db.collection('users').findOne({ id: t.from_user_id }, { projection: { username: 1, first_name: 1, _id: 0 } });
      return json({ transfer: { code: t.code, expires_at: t.expires_at, from: fromUser }, moto });
    }

    // POST /api/transfer/:code/accept (auth)
    if (p[0] === 'transfer' && p[1] && p[2] === 'accept' && method === 'POST') {
      const t = await db.collection('transfers').findOne({ code: p[1].toUpperCase(), status: 'PENDING' });
      if (!t) return json({ error: 'Codice non valido o già utilizzato' }, 404);
      if (t.expires_at < new Date()) return json({ error: 'Codice scaduto' }, 410);
      if (t.from_user_id === userId) return json({ error: 'Non puoi trasferire una moto a te stesso' }, 400);
      const now = new Date();
      // Close previous ownership record
      await db.collection('ownership_history').updateMany(
        { motorcycle_id: t.motorcycle_id, end_date: null },
        { $set: { end_date: now, transfer_verified: true } }
      );
      // Open new ownership record
      await db.collection('ownership_history').insertOne({
        id: uuidv4(), motorcycle_id: t.motorcycle_id, owner_id: userId,
        start_date: now, end_date: null, transfer_verified: true, created_at: now,
      });
      // Update motorcycle owner
      await db.collection('motorcycles').updateOne({ id: t.motorcycle_id }, { $set: { owner_id: userId, updated_at: now } });
      // Mark transfer complete
      await db.collection('transfers').updateOne({ _id: t._id }, { $set: { status: 'COMPLETED', to_user_id: userId, completed_at: now } });
      const moto = await db.collection('motorcycles').findOne({ id: t.motorcycle_id }, { projection: { _id: 0 } });
      return json({ moto });
    }

    // POST /api/motorcycles/:id/transfer -> generate code
    if (p[0] === 'motorcycles' && p[1] && p[2] === 'transfer' && method === 'POST') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      // Cancel previous pending transfers
      await db.collection('transfers').updateMany(
        { motorcycle_id: moto.id, status: 'PENDING' },
        { $set: { status: 'CANCELLED', cancelled_at: new Date() } }
      );
      const now = new Date();
      const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const transfer = {
        id: uuidv4(),
        code: generateTransferCode(),
        motorcycle_id: moto.id,
        from_user_id: userId,
        to_user_id: null,
        status: 'PENDING',
        created_at: now,
        expires_at: expires,
      };
      await db.collection('transfers').insertOne(transfer);
      delete transfer._id;
      return json({ transfer });
    }

    // GET /api/motorcycles/:id/transfer -> current pending transfer
    if (p[0] === 'motorcycles' && p[1] && p[2] === 'transfer' && method === 'GET') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      const transfer = await db.collection('transfers').findOne(
        { motorcycle_id: moto.id, status: 'PENDING' },
        { projection: { _id: 0 } }
      );
      return json({ transfer });
    }

    // DELETE /api/motorcycles/:id/transfer -> cancel pending
    if (p[0] === 'motorcycles' && p[1] && p[2] === 'transfer' && method === 'DELETE') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      await db.collection('transfers').updateMany(
        { motorcycle_id: moto.id, status: 'PENDING' },
        { $set: { status: 'CANCELLED', cancelled_at: new Date() } }
      );
      return json({ ok: true });
    }

    // Upload endpoint
    if (path === '/uploads' && method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      const MAX = 10 * 1024 * 1024;
      const ALLOWED = new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif','application/pdf']);
      let bytes, ctype, originalName;
      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        const entry = form.get('file');
        if (!entry || typeof entry === 'string') return json({ error: 'file richiesto' }, 400);
        bytes = Buffer.from(await entry.arrayBuffer());
        ctype = entry.type || 'application/octet-stream';
        originalName = entry.name || 'file';
      } else if (contentType.includes('application/json')) {
        const body = await request.json();
        const m = /^data:([^;]+);base64,(.+)$/.exec(body.data || '');
        if (!m) return json({ error: 'data URL richiesto' }, 400);
        ctype = m[1];
        bytes = Buffer.from(m[2], 'base64');
        originalName = body.filename || `upload-${uuidv4()}`;
      } else {
        return json({ error: 'Content-Type non supportato' }, 400);
      }
      if (!bytes.length) return json({ error: 'File vuoto' }, 400);
      if (bytes.length > MAX) return json({ error: 'File troppo grande (max 10MB)' }, 413);
      if (!ALLOWED.has(ctype)) return json({ error: 'Formato non supportato' }, 400);
      const bucket = await getBucket();
      const id = new ObjectId();
      const safeName = String(originalName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
      await new Promise((resolve, reject) => {
        const stream = bucket.openUploadStreamWithId(id, safeName, { contentType: ctype, metadata: { uploaded_by: userId } });
        stream.on('finish', resolve);
        stream.on('error', reject);
        stream.end(bytes);
      });
      const url = `/api/files/${id.toHexString()}`;
      return json({ id: id.toHexString(), url, contentType: ctype, size: bytes.length }, 201);
    }

    // ============== COMMUNITY & MESSAGES ==============
    // GET /api/community/users - list users (basic info + bike count)
    if (p[0] === 'community' && p[1] === 'users' && !p[2] && method === 'GET') {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const filter = q ? { $or: [
        { username: { $regex: q, $options: 'i' } },
        { first_name: { $regex: q, $options: 'i' } },
        { last_name: { $regex: q, $options: 'i' } },
      ] } : {};
      const users = await db.collection('users').find(filter, {
        projection: { _id: 0, id: 1, username: 1, first_name: 1, last_name: 1, profile_photo: 1, country: 1, created_at: 1 }
      }).limit(100).toArray();
      const ids = users.map(u => u.id);

      // Per-user pick the best cover bike: prefer public + has photo, then most recent
      const bikeAgg = ids.length ? await db.collection('motorcycles').aggregate([
        { $match: { owner_id: { $in: ids } } },
        { $addFields: {
          _has_photo: { $cond: [{ $and: [{ $ne: ['$main_photo', null] }, { $ne: ['$main_photo', ''] }] }, 1, 0] },
          _is_public: { $cond: [{ $eq: ['$public_profile', true] }, 1, 0] },
        } },
        { $sort: { _is_public: -1, _has_photo: -1, created_at: -1 } },
        { $group: {
          _id: '$owner_id',
          count: { $sum: 1 },
          sample_photo: { $first: '$main_photo' },
          sample_model: { $first: '$model' },
          sample_brand: { $first: '$brand' },
          sample_public_id: { $first: '$public_id' },
          sample_year: { $first: '$year' },
        } },
      ]).toArray() : [];
      const bikeMap = Object.fromEntries(bikeAgg.map(b => [b._id, b]));
      const enriched = users.map(u => ({
        ...u,
        bike_count: bikeMap[u.id]?.count || 0,
        sample_photo: bikeMap[u.id]?.sample_photo || null,
        sample_model: bikeMap[u.id]?.sample_model || null,
        sample_brand: bikeMap[u.id]?.sample_brand || null,
        sample_public_id: bikeMap[u.id]?.sample_public_id || null,
        sample_year: bikeMap[u.id]?.sample_year || null,
        is_self: u.id === userId,
      }));
      enriched.sort((a, b) => {
        // With photo first, then more bikes, then self last
        const scoreA = (a.sample_photo ? 100 : 0) + a.bike_count - (a.is_self ? 1000 : 0);
        const scoreB = (b.sample_photo ? 100 : 0) + b.bike_count - (b.is_self ? 1000 : 0);
        return scoreB - scoreA;
      });
      return json({ users: enriched });
    }

    // GET /api/community/users/:id - single user with public bikes
    if (p[0] === 'community' && p[1] === 'users' && p[2] && method === 'GET') {
      const user = await db.collection('users').findOne({ id: p[2] }, {
        projection: { _id: 0, id: 1, username: 1, first_name: 1, last_name: 1, profile_photo: 1, country: 1, created_at: 1 }
      });
      if (!user) return json({ error: 'Utente non trovato' }, 404);
      const bikes = await db.collection('motorcycles').find(
        { owner_id: p[2], public_profile: true },
        { projection: { _id: 0, id: 1, public_id: 1, brand: 1, model: 1, year: 1, engine_cc: 1, main_photo: 1, current_mileage: 1 } }
      ).sort({ created_at: -1 }).limit(50).toArray();
      return json({ user, bikes });
    }

    // GET /api/messages - conversation list
    if (p[0] === 'messages' && !p[1] && method === 'GET') {
      const convs = await db.collection('messages').aggregate([
        { $match: { $or: [{ from_user_id: userId }, { to_user_id: userId }] } },
        { $sort: { created_at: -1 } },
        { $group: {
          _id: { $cond: [{ $eq: ['$from_user_id', userId] }, '$to_user_id', '$from_user_id'] },
          last_message: { $first: '$content' },
          last_at: { $first: '$created_at' },
          last_from: { $first: '$from_user_id' },
          unread: { $sum: { $cond: [{ $and: [{ $eq: ['$to_user_id', userId] }, { $eq: ['$read_at', null] }] }, 1, 0] } },
        } },
        { $sort: { last_at: -1 } },
        { $limit: 100 },
      ]).toArray();
      const otherIds = convs.map(c => c._id);
      const users = await db.collection('users').find({ id: { $in: otherIds } }, {
        projection: { _id: 0, id: 1, username: 1, first_name: 1, profile_photo: 1 }
      }).toArray();
      const uMap = Object.fromEntries(users.map(u => [u.id, u]));
      const conversations = convs.map(c => ({
        user: uMap[c._id] || { id: c._id, username: 'utente' },
        last_message: c.last_message,
        last_at: c.last_at,
        last_from_me: c.last_from === userId,
        unread: c.unread,
      }));
      return json({ conversations });
    }

    // GET /api/messages/:userId - fetch conversation + mark read
    if (p[0] === 'messages' && p[1] && method === 'GET') {
      const otherId = p[1];
      if (otherId === userId) return json({ error: 'Non puoi chattare con te stesso' }, 400);
      const other = await db.collection('users').findOne({ id: otherId }, {
        projection: { _id: 0, id: 1, username: 1, first_name: 1, profile_photo: 1 }
      });
      if (!other) return json({ error: 'Utente non trovato' }, 404);
      const messages = await db.collection('messages').find({
        $or: [
          { from_user_id: userId, to_user_id: otherId },
          { from_user_id: otherId, to_user_id: userId },
        ]
      }, { projection: { _id: 0 } }).sort({ created_at: 1 }).limit(500).toArray();
      // Mark received messages as read
      await db.collection('messages').updateMany(
        { from_user_id: otherId, to_user_id: userId, read_at: null },
        { $set: { read_at: new Date() } }
      );
      return json({ other, messages });
    }

    // POST /api/messages/:userId - send message
    if (p[0] === 'messages' && p[1] && method === 'POST') {
      const otherId = p[1];
      if (otherId === userId) return json({ error: 'Non puoi inviare a te stesso' }, 400);
      const other = await db.collection('users').findOne({ id: otherId });
      if (!other) return json({ error: 'Utente non trovato' }, 404);
      const body = await request.json();
      const content = String(body.content || '').trim().slice(0, 2000);
      if (!content) return json({ error: 'Messaggio vuoto' }, 400);
      const msg = {
        id: uuidv4(),
        from_user_id: userId,
        to_user_id: otherId,
        content,
        created_at: new Date(),
        read_at: null,
      };
      await db.collection('messages').insertOne(msg);
      delete msg._id;
      return json({ message: msg }, 201);
    }

    // GET /api/messages-unread-count
    if (path === '/messages-unread-count' && method === 'GET') {
      const count = await db.collection('messages').countDocuments({ to_user_id: userId, read_at: null });
      return json({ count });
    }

    if (path === '/dashboard' && method === 'GET') {
      const motos = await db.collection('motorcycles').find({ owner_id: userId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(100).toArray();
      const motoIds = motos.map(m => m.id);
      const recentMaint = await db.collection('maintenance').find({ motorcycle_id: { $in: motoIds } }, { projection: { _id: 0 } }).sort({ date: -1 }).limit(5).toArray();
      const reminders = await db.collection('reminders').find({ user_id: userId, status: 'PENDING' }, { projection: { _id: 0 } }).limit(5).toArray();
      return json({ motos, recent_maintenance: recentMaint, reminders });
    }

    if (path === '/motorcycles' && method === 'GET') {
      const motos = await db.collection('motorcycles').find({ owner_id: userId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(100).toArray();
      return json({ motos });
    }

    if (path === '/motorcycles' && method === 'POST') {
      const body = await request.json();
      const id = uuidv4();
      const public_id = generatePublicId({ year: body.year, model: body.model });
      const now = new Date();
      const moto = {
        id, public_id, owner_id: userId,
        brand: body.brand || '', model: body.model || '', version: body.version || '',
        year: parseInt(body.year) || null, engine_cc: parseInt(body.engine_cc) || null,
        engine_type: body.engine_type || '', color: body.color || '',
        plate: (body.plate || '').toUpperCase().trim(),
        current_mileage: parseInt(body.current_mileage) || 0,
        main_photo: body.main_photo || null,
        description: body.description || '',
        public_profile: body.public_profile !== false,
        status: 'ACTIVE', created_at: now, updated_at: now,
      };
      await db.collection('motorcycles').insertOne(moto);
      await db.collection('nfc_tags').insertOne({
        id: uuidv4(), motorcycle_id: id,
        tag_uid: generateTagUid(), public_token: generatePublicToken(),
        status: 'ACTIVE', activated_at: now, scan_count: 0, created_at: now,
      });
      delete moto._id;
      return json({ moto });
    }

    if (p[0] === 'motorcycles' && p[1] && !p[2] && method === 'GET') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId }, { projection: { _id: 0 } });
      if (!moto) return json({ error: 'Moto non trovata' }, 404);
      const maintenance = await db.collection('maintenance').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ date: -1 }).limit(200).toArray();
      const timeline = await db.collection('timeline').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ event_date: -1 }).limit(200).toArray();
      const modifications = await db.collection('modifications').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ installation_date: -1 }).limit(200).toArray();
      const gallery = await db.collection('gallery').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(200).toArray();
      const documents = await db.collection('documents').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ document_date: -1 }).limit(100).toArray();
      const reminders = await db.collection('reminders').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(100).toArray();
      const nfc = await db.collection('nfc_tags').findOne({ motorcycle_id: moto.id, status: 'ACTIVE' }, { projection: { _id: 0 } });
      const postits = await db.collection('postits').find({ motorcycle_id: moto.id }, { projection: { _id: 0, ip_hint: 0 } }).sort({ created_at: -1 }).limit(200).toArray();
      return json({ moto, maintenance, timeline, modifications, gallery, documents, reminders, nfc, postits });
    }

    if (p[0] === 'motorcycles' && p[1] && !p[2] && method === 'PUT') {
      const body = await request.json();
      const updates = {};
      const fields = ['brand','model','version','year','engine_cc','engine_type','color','plate','current_mileage','main_photo','description','public_profile','status'];
      for (const f of fields) if (f in body) {
        if (f === 'plate') updates[f] = (body[f] || '').toUpperCase().trim();
        else updates[f] = body[f];
      }
      updates.updated_at = new Date();
      await db.collection('motorcycles').updateOne({ id: p[1], owner_id: userId }, { $set: updates });
      const moto = await db.collection('motorcycles').findOne({ id: p[1] }, { projection: { _id: 0 } });
      return json({ moto });
    }

    if (p[0] === 'motorcycles' && p[1] && p[2] === 'nfc' && method === 'POST') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      const body = await request.json().catch(() => ({}));
      await db.collection('nfc_tags').updateMany({ motorcycle_id: moto.id, status: 'ACTIVE' }, { $set: { status: 'REPLACED' } });
      const tag = {
        id: uuidv4(), motorcycle_id: moto.id,
        tag_uid: body.tag_uid || generateTagUid(),
        public_token: generatePublicToken(),
        status: 'ACTIVE', activated_at: new Date(), scan_count: 0, created_at: new Date(),
      };
      await db.collection('nfc_tags').insertOne(tag);
      delete tag._id;
      return json({ nfc: tag });
    }

    if (p[0] === 'motorcycles' && p[1] && p[2] && !p[3] && method === 'POST') {
      const motorcycleId = p[1];
      const kind = p[2];
      const body = await request.json();
      const moto = await db.collection('motorcycles').findOne({ id: motorcycleId, owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      const id = uuidv4();
      const now = new Date();
      let doc = { id, motorcycle_id: motorcycleId, created_at: now };
      const collections = {
        maintenance: () => Object.assign(doc, { user_id: userId, service_type: body.service_type || 'OTHER', title: body.title || '', description: body.description || '', date: body.date ? new Date(body.date) : now, mileage: parseInt(body.mileage) || 0, cost: parseFloat(body.cost) || 0, currency: body.currency || 'EUR', verified: false, is_public: body.is_public !== false }),
        timeline: () => Object.assign(doc, { created_by: userId, event_type: body.event_type || 'OTHER', title: body.title || '', description: body.description || '', event_date: body.event_date ? new Date(body.event_date) : now, mileage: parseInt(body.mileage) || 0, is_public: body.is_public !== false }),
        modifications: () => Object.assign(doc, { category: body.category || 'OTHER', name: body.name || '', brand: body.brand || '', model: body.model || '', description: body.description || '', installation_date: body.installation_date ? new Date(body.installation_date) : now, installation_mileage: parseInt(body.installation_mileage) || 0, cost: parseFloat(body.cost) || 0, is_public: body.is_public !== false }),
        gallery: () => Object.assign(doc, { uploaded_by: userId, file_url: body.file_url || '', thumbnail_url: body.thumbnail_url || body.file_url || '', caption: body.caption || '', category: body.category || 'OTHER', is_cover: !!body.is_cover, is_public: body.is_public !== false }),
        documents: () => Object.assign(doc, { uploaded_by: userId, file_url: body.file_url || '', document_type: body.document_type || 'OTHER', title: body.title || '', document_date: body.document_date ? new Date(body.document_date) : now, is_public: !!body.is_public }),
        reminders: () => Object.assign(doc, { user_id: userId, title: body.title || '', description: body.description || '', target_date: body.target_date ? new Date(body.target_date) : null, target_mileage: body.target_mileage ? parseInt(body.target_mileage) : null, repeat_interval_km: body.repeat_interval_km ? parseInt(body.repeat_interval_km) : null, repeat_interval_months: body.repeat_interval_months ? parseInt(body.repeat_interval_months) : null, status: 'PENDING' }),
      };
      if (!collections[kind]) return json({ error: 'Risorsa sconosciuta' }, 400);
      collections[kind]();
      await db.collection(kind).insertOne(doc);
      delete doc._id;
      return json({ item: doc });
    }

    // PATCH sub-item (edit is_public etc)
    if (p[0] === 'motorcycles' && p[1] && p[2] && p[3] && (method === 'PATCH' || method === 'PUT')) {
      const kind = p[2];
      const valid = ['maintenance','timeline','modifications','gallery','documents','reminders','postits'];
      if (!valid.includes(kind)) return json({ error: 'Risorsa sconosciuta' }, 400);
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      const body = await request.json();
      const allowed = {
        maintenance: ['title','description','date','mileage','cost','currency','service_type','is_public'],
        timeline: ['title','description','event_date','mileage','event_type','is_public'],
        modifications: ['name','brand','model','description','installation_date','installation_mileage','cost','category','is_public'],
        gallery: ['caption','category','is_cover','is_public'],
        documents: ['title','document_type','document_date','is_public'],
        reminders: ['title','description','target_date','target_mileage','repeat_interval_km','repeat_interval_months','status'],
        postits: ['is_hidden'],
      };
      const updates = {};
      for (const f of allowed[kind]) if (f in body) updates[f] = body[f];
      if ('date' in updates && updates.date) updates.date = new Date(updates.date);
      if ('event_date' in updates && updates.event_date) updates.event_date = new Date(updates.event_date);
      if ('installation_date' in updates && updates.installation_date) updates.installation_date = new Date(updates.installation_date);
      if ('document_date' in updates && updates.document_date) updates.document_date = new Date(updates.document_date);
      if ('target_date' in updates && updates.target_date) updates.target_date = new Date(updates.target_date);
      await db.collection(kind).updateOne({ id: p[3], motorcycle_id: p[1] }, { $set: updates });
      const item = await db.collection(kind).findOne({ id: p[3] }, { projection: { _id: 0 } });
      return json({ item });
    }

    if (p[0] === 'motorcycles' && p[1] && p[2] && p[3] && method === 'DELETE') {
      const kind = p[2];
      const valid = ['maintenance','timeline','modifications','gallery','documents','reminders','postits'];
      if (!valid.includes(kind)) return json({ error: 'Risorsa sconosciuta' }, 400);
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      await db.collection(kind).deleteOne({ id: p[3], motorcycle_id: p[1] });
      return json({ ok: true });
    }

    return json({ error: 'Route non trovata', path, method }, 404);
  } catch (e) {
    console.error('API error', e);
    return json({ error: e.message || 'Errore server' }, 500);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
