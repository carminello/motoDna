import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { sendGmail } from '@/lib/gmail';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId, GridFSBucket } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { hashPassword, verifyPassword, signToken, getUserFromRequest } from '@/lib/auth';
import { generatePublicId, generateTagUid, generatePublicToken, generateTransferCode } from '@/lib/publicId';
import { seedDemoForUser } from '@/lib/seedDemo';
import { isAllowed, getClientIp } from '@/lib/rateLimit';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';

const json = (data, status = 200) => NextResponse.json(data, { status });

// Parse the ADMIN_EMAILS env var into a lowercased Set for O(1) lookup.
// Emails listed here are always granted is_admin=true at register/login.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
);

async function ensureAdminFlag(db, userDoc) {
  if (!userDoc || !userDoc.email) return userDoc;
  if (!ADMIN_EMAILS.has(userDoc.email.toLowerCase())) return userDoc;
  if (userDoc.is_admin === true) return userDoc;
  await db.collection('users').updateOne(
    { id: userDoc.id },
    { $set: { is_admin: true, admin_granted_at: new Date() } },
  );
  return { ...userDoc, is_admin: true };
}

// ---------- GridFS orphan cleanup helpers ----------
// Parse a MotoDNA file URL and return its Mongo ObjectId, or null.
// Accepts "/api/files/<hex24>", optionally with a trailing extension.
function fileIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/api\/files\/([a-f0-9]{24})/i);
  if (!m) return null;
  return ObjectId.isValid(m[1]) ? new ObjectId(m[1]) : null;
}

// Collect every file ObjectId referenced by the given motorcycle ids
// (cover photo + gallery + documents). Deduplicated.
async function collectMotoFileIds(db, motoIds) {
  if (!motoIds.length) return [];
  const seen = new Set();
  const push = (url) => {
    const id = fileIdFromUrl(url);
    if (id) seen.add(id.toString());
  };
  const [motos, gallery, docs] = await Promise.all([
    db.collection('motorcycles').find({ id: { $in: motoIds } }, { projection: { main_photo: 1, _id: 0 } }).toArray(),
    db.collection('gallery').find({ motorcycle_id: { $in: motoIds } }, { projection: { file_url: 1, _id: 0 } }).toArray(),
    db.collection('documents').find({ motorcycle_id: { $in: motoIds } }, { projection: { file_url: 1, _id: 0 } }).toArray(),
  ]);
  motos.forEach(m => push(m.main_photo));
  gallery.forEach(g => push(g.file_url));
  docs.forEach(d => push(d.file_url));
  return Array.from(seen).map(s => new ObjectId(s));
}

// Best-effort GridFS delete. "File not found" is fine (already removed).
async function deleteGridFsFiles(bucket, fileIds) {
  if (!fileIds.length) return 0;
  let ok = 0;
  await Promise.all(fileIds.map(async (id) => {
    try {
      await bucket.delete(id);
      ok++;
    } catch (e) {
      const msg = e?.message || '';
      if (!/FileNotFound|does not exist/i.test(msg)) {
        console.warn('[gridfs] delete failed for', id.toString(), msg);
      }
    }
  }));
  return ok;
}

async function getBucket() {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: 'uploads' });
}

function setAuthCookie(response, token, remember = true) {
  response.cookies.set('motodna_token', token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    ...(remember ? { maxAge: 60 * 60 * 24 * 90 } : {}),
    secure: true,
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

    // ============== FILES ==============
    // Public files (default): open access + long CDN cache.
    // Private files (metadata.visibility === 'private'): require auth
    // AND caller must be the uploader (owner).
    if (p[0] === 'files' && p[1] && method === 'GET') {
      const idStr = p[1].split('.')[0]; // strip extension if any
      if (!ObjectId.isValid(idStr)) return new NextResponse('Not found', { status: 404 });
      const bucket = await getBucket();
      const fileId = new ObjectId(idStr);
      const files = await bucket.find({ _id: fileId }).toArray();
      if (!files[0]) return new NextResponse('Not found', { status: 404 });
      const file = files[0];
      const meta = file.metadata || {};
      const isPrivate = meta.visibility === 'private';
      if (isPrivate) {
        const caller = await getUserFromRequest(request);
        if (!caller) return new NextResponse('Unauthorized', { status: 401 });
        if (!meta.uploaded_by || caller.sub !== meta.uploaded_by) {
          return new NextResponse('Forbidden', { status: 403 });
        }
      }
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
          // Public files: aggressive CDN cache; private: no cache.
          'Cache-Control': isPrivate
            ? 'private, no-store'
            : 'public, max-age=31536000, immutable',
        },
      });
    }

    // ============== TELEGRAM PASSWORD RECOVERY WEBHOOK (public, secret protected) ==============
    if (path === '/telegram/webhook' && method === 'POST') {
      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (!process.env.TELEGRAM_BOT_TOKEN || !expectedSecret) {
        return json({ error: 'Webhook Telegram non configurato' }, 503);
      }
      const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
      if (suppliedSecret !== expectedSecret) return json({ error: 'Non autorizzato' }, 401);

      const update = await request.json().catch(() => ({}));
      const callback = update.callback_query;
      if (callback) {
        await telegramApi('answerCallbackQuery', { callback_query_id: callback.id }).catch(() => {});
        const chat = callback.message?.chat;
        if (callback.data === 'recover_password' && chat?.type === 'private') {
          await db.collection('password_reset_sessions').updateOne(
            { chat_id: String(chat.id) },
            { $set: { chat_id: String(chat.id), telegram_user_id: String(callback.from?.id || chat.id), state: 'awaiting_email', updated_at: new Date() } },
            { upsert: true },
          );
          await telegramApi('sendMessage', {
            chat_id: chat.id,
            text: 'Scrivi l’indirizzo email che usi per accedere a MotoDNA. Per sicurezza, il link di reimpostazione verrà inviato solo all’email registrata.',
          });
        }
        return json({ ok: true });
      }

      const message = update.message;
      const chat = message?.chat;
      if (!message || chat?.type !== 'private' || typeof message.text !== 'string') return json({ ok: true });
      const chatId = String(chat.id);
      const messageText = message.text.trim();

      if (/^\/start(?:@\w+)?(?:\s|$)/i.test(messageText)) {
        await telegramApi('sendMessage', {
          chat_id: chat.id,
          text: 'Benvenuto nell’assistenza MotoDNA. Da qui puoi richiedere il recupero della password. La richiesta verrà verificata da un amministratore.',
          reply_markup: { inline_keyboard: [[{ text: '🔐 Recupera password', callback_data: 'recover_password' }]] },
        });
        return json({ ok: true });
      }

      if (/^recupera password$/i.test(messageText)) {
        await db.collection('password_reset_sessions').updateOne(
          { chat_id: chatId },
          { $set: { chat_id: chatId, telegram_user_id: String(message.from?.id || chatId), state: 'awaiting_email', updated_at: new Date() } },
          { upsert: true },
        );
        await telegramApi('sendMessage', { chat_id: chat.id, text: 'Scrivi l’indirizzo email che usi per accedere a MotoDNA. Il link verrà inviato solo all’email registrata.' });
        return json({ ok: true });
      }

      const session = await db.collection('password_reset_sessions').findOne({ chat_id: chatId, state: 'awaiting_email' });
      if (!session) {
        await telegramApi('sendMessage', {
          chat_id: chat.id,
          text: 'Per iniziare, premi il pulsante qui sotto.',
          reply_markup: { inline_keyboard: [[{ text: '🔐 Recupera password', callback_data: 'recover_password' }]] },
        });
        return json({ ok: true });
      }

      const email = messageText.toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await telegramApi('sendMessage', { chat_id: chat.id, text: 'L’indirizzo non sembra valido. Riprova inserendo la tua email.' });
        return json({ ok: true });
      }

      const now = new Date();
      const recentRequests = await db.collection('password_reset_requests').countDocuments({
        chat_id: chatId,
        created_at: { $gte: new Date(now.getTime() - 15 * 60_000) },
      });
      if (recentRequests >= 3) {
        await db.collection('password_reset_sessions').updateOne({ chat_id: chatId }, { $set: { state: 'idle', updated_at: now } });
        await telegramApi('sendMessage', { chat_id: chat.id, text: 'Hai già inviato diverse richieste. Attendi 15 minuti prima di riprovare.' });
        return json({ ok: true });
      }

      await db.collection('password_reset_requests').insertOne({
        id: uuidv4(),
        email,
        chat_id: chatId,
        telegram_user_id: String(message.from?.id || chatId),
        status: 'PENDING',
        created_at: now,
        updated_at: now,
      });
      await db.collection('password_reset_sessions').updateOne(
        { chat_id: chatId },
        { $set: { state: 'idle', updated_at: now } },
      );
      await telegramApi('sendMessage', {
        chat_id: chat.id,
        text: 'Richiesta registrata. Un amministratore la verificherà. Se approvata, riceverai le istruzioni all’indirizzo email registrato nel tuo account MotoDNA.',
      });
      return json({ ok: true });
    }

    // ============== AUTH ==============


    // ============== PASSWORD RESET (public) ==============
    if (path === '/auth/reset-password' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const token = String(body.token || '');
      const password = String(body.password || '');
      if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: 'Link non valido o scaduto. Richiedi un nuovo link.' }, 400);
      if (password.length < 8 || password.length > 128) return json({ error: 'La password deve contenere almeno 8 caratteri e non superare 128 caratteri.' }, 400);

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const now = new Date();
      const resetRecord = await db.collection('password_reset_tokens').findOne({ token_hash: tokenHash, source: 'telegram_admin_approved', expires_at: { $gt: now }, used_at: null });
      if (!resetRecord) return json({ error: 'Link non valido o scaduto. Richiedi un nuovo link.' }, 400);

      const consumed = await db.collection('password_reset_tokens').updateOne(
        { _id: resetRecord._id, used_at: null, expires_at: { $gt: now } },
        { $set: { used_at: now } },
      );
      if (consumed.modifiedCount !== 1) return json({ error: 'Link non valido o scaduto. Richiedi un nuovo link.' }, 400);

      const result = await db.collection('users').updateOne(
        { id: resetRecord.user_id },
        { $set: { password_hash: await hashPassword(password), password_changed_at: now, updated_at: now } },
      );
      if (result.modifiedCount !== 1) return json({ error: 'Impossibile aggiornare la password. Richiedi un nuovo link.' }, 400);
      await db.collection('password_reset_tokens').deleteMany({ user_id: resetRecord.user_id });
      return json({ message: 'Password aggiornata. Ora puoi accedere con la nuova password.' });
    }

    if (path === '/auth/register' && method === 'POST') {
      const body = await request.json();
      const { email, password, first_name, last_name, username } = body;
      if (!email || !password) return json({ error: 'Email e password richiesti' }, 400);
      const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
      if (existing) return json({ error: 'Email già registrata' }, 400);
      const id = uuidv4();
      const now = new Date();
      const normalizedEmail = email.toLowerCase();
      const user = {
        id, email: normalizedEmail,
        password_hash: await hashPassword(password),
        first_name: first_name || '', last_name: last_name || '',
        username: username || email.split('@')[0],
        profile_photo: null, country: '', status: 'ACTIVE',
        // Auto-grant admin if the email is whitelisted via env.
        is_admin: ADMIN_EMAILS.has(normalizedEmail),
        created_at: now, updated_at: now,
      };
      if (user.is_admin) user.admin_granted_at = now;
      await db.collection('users').insertOne(user);
      await seedDemoForUser(db, id);
      const token = signToken({ sub: id, email: user.email });
      const res = json({ user: { id, email: user.email, first_name: user.first_name, last_name: user.last_name, username: user.username, is_admin: !!user.is_admin } });
      setAuthCookie(res, token);
      return res;
    }

    if (path === '/auth/login' && method === 'POST') {
      const { email, password, remember } = await request.json();
      // Rate limit: 5 attempts per 60s per (IP + email lowercased).
      // This blocks both single-IP bursts and slow attackers pivoting emails.
      const ip = getClientIp(request);
      const key = `login:${ip}:${(email || '').toLowerCase()}`;
      const rl = isAllowed(key, { max: 5, windowMs: 60_000 });
      if (!rl.allowed) {
        return json(
          { error: `Troppi tentativi di accesso, riprova tra ${rl.retryAfterSec}s.` },
          429,
        );
      }
      const user = await db.collection('users').findOne({ email: (email || '').toLowerCase() });
      if (!user) return json({ error: 'Credenziali non valide' }, 401);
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) return json({ error: 'Credenziali non valide' }, 401);
      // If the email is whitelisted as admin but the DB flag isn't set yet
      // (e.g. account created before ADMIN_EMAILS was configured), grant it now.
      const promoted = await ensureAdminFlag(db, user);
      const token = signToken({ sub: promoted.id, email: promoted.email });
      const res = json({ user: { id: promoted.id, email: promoted.email, first_name: promoted.first_name, last_name: promoted.last_name, username: promoted.username, is_admin: !!promoted.is_admin } });
      setAuthCookie(res, token, remember !== false);
      return res;
    }

    if (path === '/auth/logout' && method === 'POST') {
      const res = json({ ok: true });
      res.cookies.set('motodna_token', '', { path: '/', maxAge: 0 });
      return res;
    }

    if (path === '/auth/me' && method === 'GET') {
      const authMe = await getUserFromRequest(request);
      if (!authMe) return json({ user: null });
      // Track last_seen (best-effort, non-blocking)
      db.collection('users').updateOne({ id: authMe.sub }, { $set: { last_seen: new Date() } }).catch(() => {});
      let user = await db.collection('users').findOne({ id: authMe.sub }, { projection: { password_hash: 0, _id: 0 } });
      // Auto-promote if the current email is now whitelisted.
      user = await ensureAdminFlag(db, user);
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
      // Ensure uniqueness of the transfer code (collision probability is
      // negligible with 33^8 space but retry defensively).
      let code = generateTransferCode();
      for (let i = 0; i < 5; i++) {
        const clash = await db.collection('transfers').findOne({ code }, { projection: { _id: 1 } });
        if (!clash) break;
        code = generateTransferCode();
      }
      const transfer = {
        id: uuidv4(),
        code,
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
    // Accepts optional `visibility` = 'public' | 'private' (default: public).
    // Private files can only be downloaded by the uploader.
    if (path === '/uploads' && method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      const MAX = 10 * 1024 * 1024;
      const ALLOWED = new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif','application/pdf']);
      let bytes, ctype, originalName, visibility = 'public';
      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        const entry = form.get('file');
        if (!entry || typeof entry === 'string') return json({ error: 'file richiesto' }, 400);
        bytes = Buffer.from(await entry.arrayBuffer());
        ctype = entry.type || 'application/octet-stream';
        originalName = entry.name || 'file';
        const v = String(form.get('visibility') || '').toLowerCase();
        if (v === 'private') visibility = 'private';
      } else if (contentType.includes('application/json')) {
        const body = await request.json();
        const m = /^data:([^;]+);base64,(.+)$/.exec(body.data || '');
        if (!m) return json({ error: 'data URL richiesto' }, 400);
        ctype = m[1];
        bytes = Buffer.from(m[2], 'base64');
        originalName = body.filename || `upload-${uuidv4()}`;
        if (String(body.visibility || '').toLowerCase() === 'private') visibility = 'private';
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
        const stream = bucket.openUploadStreamWithId(id, safeName, {
          contentType: ctype,
          metadata: { uploaded_by: userId, visibility },
        });
        stream.on('finish', resolve);
        stream.on('error', reject);
        stream.end(bytes);
      });
      const url = `/api/files/${id.toHexString()}`;
      return json({ id: id.toHexString(), url, contentType: ctype, size: bytes.length, visibility }, 201);
    }

    // PUT /api/auth/me - update own profile
    if (path === '/auth/me' && method === 'PUT') {
      const body = await request.json();
      const updates = {};
      const allowed = ['first_name','last_name','username','profile_photo','country'];
      for (const f of allowed) if (f in body) updates[f] = body[f];
      updates.updated_at = new Date();
      await db.collection('users').updateOne({ id: userId }, { $set: updates });
      const user = await db.collection('users').findOne({ id: userId }, { projection: { password_hash: 0, _id: 0 } });
      return json({ user });
    }

    // POST /api/reminders/:reminderId/complete - complete a reminder -> creates maintenance
    if (p[0] === 'reminders' && p[1] && p[2] === 'complete' && method === 'POST') {
      const reminder = await db.collection('reminders').findOne({ id: p[1], user_id: userId });
      if (!reminder) return json({ error: 'Promemoria non trovato' }, 404);
      const body = await request.json().catch(() => ({}));
      const now = new Date();
      const maint = {
        id: uuidv4(),
        motorcycle_id: reminder.motorcycle_id,
        user_id: userId,
        service_type: body.service_type || 'OTHER',
        title: body.title || reminder.title,
        description: body.description || reminder.description || '',
        date: body.date ? new Date(body.date) : now,
        mileage: parseInt(body.mileage) || reminder.target_mileage || 0,
        cost: parseFloat(body.cost) || 0,
        currency: body.currency || 'EUR',
        verified: false,
        is_public: body.is_public !== false,
        from_reminder_id: reminder.id,
        created_at: now,
      };
      await db.collection('maintenance').insertOne(maint);
      // If reminder is recurring, keep it (bump target). Otherwise mark DONE.
      if (reminder.repeat_interval_km || reminder.repeat_interval_months) {
        const nextUpdate = {};
        if (reminder.repeat_interval_km) nextUpdate.target_mileage = (maint.mileage || 0) + reminder.repeat_interval_km;
        if (reminder.repeat_interval_months && reminder.target_date) {
          const nd = new Date(maint.date);
          nd.setMonth(nd.getMonth() + reminder.repeat_interval_months);
          nextUpdate.target_date = nd;
        }
        await db.collection('reminders').updateOne({ id: reminder.id }, { $set: { ...nextUpdate, last_completed_at: now } });
      } else {
        await db.collection('reminders').updateOne({ id: reminder.id }, { $set: { status: 'DONE', completed_at: now } });
      }
      delete maint._id;
      return json({ maintenance: maint });
    }
    // ============== ADMIN ==============

    // Helper: guard for admin-only routes. Reads the current user; returns
    // an early NextResponse on unauthorised access, or null when allowed.
    async function requireAdmin() {
      const me = await db.collection('users').findOne({ id: userId }, { projection: { is_admin: 1, _id: 0 } });
      if (!me?.is_admin) return json({ error: 'Accesso riservato agli admin' }, 403);
      return null;
    }

    // GET /api/admin/users?q=... — searchable list for admin management.
    if (p[0] === 'admin' && p[1] === 'users' && !p[2] && method === 'GET') {
      const denied = await requireAdmin();
      if (denied) return denied;
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').trim();
      const filter = q ? { $or: [
        { email: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { first_name: { $regex: q, $options: 'i' } },
        { last_name: { $regex: q, $options: 'i' } },
      ] } : {};
      const users = await db.collection('users').find(filter, {
        projection: { _id: 0, id: 1, email: 1, username: 1, first_name: 1, last_name: 1, profile_photo: 1, created_at: 1, last_seen: 1, is_admin: 1 }
      }).sort({ created_at: -1 }).limit(200).toArray();
      // Enrich with bike count in a single aggregation.
      const ids = users.map(u => u.id);
      const bikeCounts = ids.length ? await db.collection('motorcycles').aggregate([
        { $match: { owner_id: { $in: ids } } },
        { $group: { _id: '$owner_id', count: { $sum: 1 } } },
      ]).toArray() : [];
      const bmap = Object.fromEntries(bikeCounts.map(b => [b._id, b.count]));
      return json({ users: users.map(u => ({ ...u, bike_count: bmap[u.id] || 0 })) });
    }

    // DELETE /api/admin/users/:id — cascade delete a user and every doc
    // referencing them, plus GridFS files owned by their content. Blocks
    // self-deletion and admin-on-admin deletion.
    if (p[0] === 'admin' && p[1] === 'users' && p[2] && method === 'DELETE') {
      const denied = await requireAdmin();
      if (denied) return denied;
      const targetId = p[2];
      if (targetId === userId) {
        return json({ error: 'Non puoi cancellare te stesso' }, 400);
      }
      const target = await db.collection('users').findOne({ id: targetId });
      if (!target) return json({ error: 'Utente non trovato' }, 404);
      if (target.is_admin) {
        return json({ error: 'Impossibile cancellare un altro admin. Rimuovi prima il flag is_admin dal database.' }, 403);
      }

      // Collect all motorcycle ids for cascade.
      const motos = await db.collection('motorcycles').find(
        { owner_id: targetId },
        { projection: { id: 1, _id: 0 } },
      ).toArray();
      const motoIds = motos.map(m => m.id);

      // 1) Collect referenced GridFS files (moto content + user profile photo).
      const bucket = await getBucket();
      const motoFileIds = await collectMotoFileIds(db, motoIds);
      const profileFileId = fileIdFromUrl(target.profile_photo);
      const allFileIds = [...motoFileIds];
      if (profileFileId && !motoFileIds.find(id => id.equals(profileFileId))) {
        allFileIds.push(profileFileId);
      }

      // 2) Cascade delete sub-collection docs (parallel).
      const childCollections = ['maintenance','timeline','modifications','gallery','documents','reminders','nfc_tags','nfc_scans','postits'];
      const cascadeOps = [];
      if (motoIds.length) {
        for (const c of childCollections) {
          cascadeOps.push(db.collection(c).deleteMany({ motorcycle_id: { $in: motoIds } }));
        }
      }
      cascadeOps.push(db.collection('reminders').deleteMany({ user_id: targetId }));
      cascadeOps.push(db.collection('messages').deleteMany({ $or: [{ from_user_id: targetId }, { to_user_id: targetId }] }));
      cascadeOps.push(db.collection('transfers').deleteMany({ $or: [{ from_user_id: targetId }, { to_user_id: targetId }] }));
      cascadeOps.push(db.collection('ownership_history').deleteMany({ owner_id: targetId }));

      const results = await Promise.all(cascadeOps);
      const removedChildren = results.reduce((s, r) => s + (r?.deletedCount || 0), 0);

      // 3) Delete GridFS files (best-effort).
      const filesRemoved = await deleteGridFsFiles(bucket, allFileIds);

      // 4) Finally: motorcycles + the user itself.
      const motosRes = await db.collection('motorcycles').deleteMany({ owner_id: targetId });
      const userRes = await db.collection('users').deleteOne({ id: targetId });

      return json({
        ok: true,
        deleted: {
          user: userRes.deletedCount,
          motorcycles: motosRes.deletedCount,
          child_documents: removedChildren,
          files: filesRemoved,
        },
      });
    }

    // GET /api/admin/password-reset-requests — Telegram recovery queue.
    if (p[0] === 'admin' && p[1] === 'password-reset-requests' && !p[2] && method === 'GET') {
      const denied = await requireAdmin();
      if (denied) return denied;
      const requests = await db.collection('password_reset_requests').find(
        { status: 'PENDING' },
        { projection: { _id: 0, id: 1, email: 1, chat_id: 1, created_at: 1, status: 1 } },
      ).sort({ created_at: 1 }).limit(100).toArray();
      return json({ requests });
    }

    if (p[0] === 'admin' && p[1] === 'password-reset-requests' && p[2] && method === 'POST') {
      const denied = await requireAdmin();
      if (denied) return denied;
      const requestId = p[2];
      const body = await request.json().catch(() => ({}));
      const action = String(body.action || '').toLowerCase();
      if (!['approve', 'reject'].includes(action)) return json({ error: 'Azione non valida' }, 400);

      const recoveryRequest = await db.collection('password_reset_requests').findOne({ id: requestId, status: 'PENDING' });
      if (!recoveryRequest) return json({ error: 'Richiesta non trovata o già gestita' }, 404);
      const now = new Date();

      if (action === 'reject') {
        const changed = await db.collection('password_reset_requests').updateOne(
          { id: requestId, status: 'PENDING' },
          { $set: { status: 'REJECTED', decided_at: now, decided_by: userId, updated_at: now } },
        );
        if (!changed.modifiedCount) return json({ error: 'La richiesta è già stata gestita' }, 409);
        await telegramApi('sendMessage', {
          chat_id: recoveryRequest.chat_id,
          text: 'La richiesta di recupero non è stata approvata. Se hai ancora bisogno di assistenza, contatta il supporto MotoDNA.',
        }).catch(() => {});
        return json({ ok: true, status: 'REJECTED' });
      }

      const claimed = await db.collection('password_reset_requests').updateOne(
        { id: requestId, status: 'PENDING' },
        { $set: { status: 'PROCESSING', decided_by: userId, updated_at: now } },
      );
      if (!claimed.modifiedCount) return json({ error: 'La richiesta è già stata presa in carico' }, 409);

      const email = String(recoveryRequest.email || '').trim().toLowerCase();
      const user = await db.collection('users').findOne({ email }, { projection: { id: 1, email: 1 } });
      if (!user) {
        await db.collection('password_reset_requests').updateOne(
          { id: requestId, status: 'PROCESSING' },
          { $set: { status: 'REJECTED', decided_at: new Date(), updated_at: new Date(), decision_reason: 'ACCOUNT_NOT_FOUND' } },
        );
        await telegramApi('sendMessage', {
          chat_id: recoveryRequest.chat_id,
          text: 'La richiesta è stata gestita. Se non ricevi un’email, verifica di aver usato l’indirizzo associato al tuo account MotoDNA.',
        }).catch(() => {});
        return json({ ok: true, status: 'REJECTED', message: 'Nessun account trovato per questa email; richiesta chiusa.' });
      }

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60_000);
      await db.collection('password_reset_tokens').deleteMany({ user_id: user.id });
      await db.collection('password_reset_tokens').insertOne({
        user_id: user.id, token_hash: tokenHash, source: 'telegram_admin_approved', created_at: now, expires_at: expiresAt, used_at: null,
      });
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
      try {
        await sendGmail({
          to: user.email,
          subject: 'Reimposta la password di MotoDNA',
          text: `Un amministratore ha approvato la tua richiesta di recupero password MotoDNA. Apri questo link entro 30 minuti: ${resetUrl}\n\nSe non hai richiesto tu il recupero, ignora questa email.`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#171717"><h2>Reimposta la password di MotoDNA</h2><p>La tua richiesta è stata approvata. Usa il pulsante qui sotto per scegliere una nuova password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px">Scegli una nuova password</a></p><p>Il link scade tra 30 minuti e può essere usato una sola volta.</p><p>Se non hai richiesto tu il recupero, ignora questa email.</p></div>`,
        });
      } catch (error) {
        await db.collection('password_reset_tokens').deleteOne({ token_hash: tokenHash }).catch(() => {});
        await db.collection('password_reset_requests').updateOne(
          { id: requestId, status: 'PROCESSING' },
          { $set: { status: 'PENDING', updated_at: new Date() }, $unset: { decided_by: '' } },
        );
        console.error('[MotoDNA/password-reset] Approved-request email failed:', error?.message || 'unknown error');
        return json({ error: 'Invio email non riuscito. La richiesta è rimasta in attesa, riprova.' }, 502);
      }

      await db.collection('password_reset_requests').updateOne(
        { id: requestId, status: 'PROCESSING' },
        { $set: { status: 'APPROVED', decided_at: new Date(), updated_at: new Date() } },
      );
      await telegramApi('sendMessage', {
        chat_id: recoveryRequest.chat_id,
        text: 'La richiesta è stata approvata. Controlla l’email registrata nel tuo account MotoDNA: il link scade tra 30 minuti. Per sicurezza, il link non viene inviato su Telegram.',
      }).catch(() => {});
      return json({ ok: true, status: 'APPROVED' });
    }

    // POST /api/admin/broadcast - send a message from admin to every user
    if (p[0] === 'admin' && p[1] === 'broadcast' && method === 'POST') {
      const denied = await requireAdmin();
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      const content = String(body.content || '').trim().slice(0, 2000);
      if (!content) return json({ error: 'Messaggio vuoto' }, 400);
      // Recipients: every active user except the sender themselves.
      const recipients = await db.collection('users').find(
        { id: { $ne: userId }, status: { $ne: 'DISABLED' } },
        { projection: { id: 1, _id: 0 } },
      ).toArray();
      if (recipients.length === 0) return json({ sent: 0 });
      const now = new Date();
      const docs = recipients.map(r => ({
        id: uuidv4(),
        from_user_id: userId,
        to_user_id: r.id,
        content,
        created_at: now,
        read_at: null,
        broadcast: true,
      }));
      await db.collection('messages').insertMany(docs);
      return json({ sent: docs.length });
    }

    // GET /api/admin/stats - only admins
    if (p[0] === 'admin' && p[1] === 'stats' && method === 'GET') {
      const denied = await requireAdmin();
      if (denied) return denied;

      const now = new Date();
      const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
      const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsers, newToday, new7d, totalBikes, totalPostits,
        totalMessages, onlineLast24h, registrationsByDay
      ] = await Promise.all([
        db.collection('users').countDocuments({}),
        db.collection('users').countDocuments({ created_at: { $gte: startToday } }),
        db.collection('users').countDocuments({ created_at: { $gte: start7d } }),
        db.collection('motorcycles').countDocuments({}),
        db.collection('postits').countDocuments({ is_hidden: { $ne: true } }),
        db.collection('messages').countDocuments({}),
        db.collection('users').countDocuments({ last_seen: { $gte: start24h } }),
        db.collection('users').aggregate([
          { $match: { created_at: { $gte: start30d } } },
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
            count: { $sum: 1 }
          } },
          { $sort: { _id: 1 } }
        ]).toArray()
      ]);

      // Build a continuous 30-day chart array (fill gaps with 0)
      const chart = [];
      const dayMs = 24 * 60 * 60 * 1000;
      const map = Object.fromEntries(registrationsByDay.map(r => [r._id, r.count]));
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * dayMs);
        const key = d.toISOString().slice(0, 10);
        chart.push({ date: key, label: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), users: map[key] || 0 });
      }

      // Recent users (last 10)
      const recentUsers = await db.collection('users').find({}, {
        projection: { _id: 0, id: 1, username: 1, first_name: 1, last_name: 1, email: 1, profile_photo: 1, created_at: 1, last_seen: 1, is_admin: 1 }
      }).sort({ created_at: -1 }).limit(10).toArray();

      // Total scans, gallery items for extra "likes/comments" style metrics
      const [totalScans, totalGallery, totalMaintenance, totalTimeline, totalMods] = await Promise.all([
        db.collection('nfc_scans').countDocuments({}),
        db.collection('gallery').countDocuments({}),
        db.collection('maintenance').countDocuments({}),
        db.collection('timeline').countDocuments({}),
        db.collection('modifications').countDocuments({}),
      ]);

      return json({
        stats: {
          total_users: totalUsers,
          new_today: newToday,
          new_7d: new7d,
          total_bikes: totalBikes,
          total_postits: totalPostits,
          total_messages: totalMessages,
          online_24h: onlineLast24h,
          total_scans: totalScans,
          total_gallery: totalGallery,
          total_maintenance: totalMaintenance,
          total_timeline: totalTimeline,
          total_modifications: totalMods,
        },
        chart_registrations_30d: chart,
        recent_users: recentUsers,
      });
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

    // DELETE /api/motorcycles/:id — owner cascade delete
    // Cleans up sub-collections, transfers, ownership history, NFC data
    // AND orphan files in GridFS (cover + gallery + documents).
    if (p[0] === 'motorcycles' && p[1] && !p[2] && method === 'DELETE') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato o moto non trovata' }, 403);
      const motoId = moto.id;

      // 1) Collect referenced files BEFORE we delete the docs.
      const bucket = await getBucket();
      const fileIds = await collectMotoFileIds(db, [motoId]);

      // 2) Delete sub-collection docs (parallel).
      const childCollections = ['maintenance','timeline','modifications','gallery','documents','reminders','nfc_tags','nfc_scans','postits'];
      const results = await Promise.all([
        ...childCollections.map(c => db.collection(c).deleteMany({ motorcycle_id: motoId })),
        db.collection('transfers').deleteMany({ motorcycle_id: motoId }),
        db.collection('ownership_history').deleteMany({ motorcycle_id: motoId }),
      ]);
      const removedChildren = results.reduce((s, r) => s + (r?.deletedCount || 0), 0);

      // 3) Delete GridFS files (best-effort — never blocks the response).
      const filesRemoved = await deleteGridFsFiles(bucket, fileIds);

      // 4) Finally, delete the motorcycle itself.
      const motoRes = await db.collection('motorcycles').deleteOne({ id: motoId, owner_id: userId });

      return json({
        ok: true,
        deleted: {
          motorcycle: motoRes.deletedCount,
          child_documents: removedChildren,
          files: filesRemoved,
        },
      });
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

    // POST /api/motorcycles/:id/nfc/associate - ultra-simple flow
    if (p[0] === 'motorcycles' && p[1] && p[2] === 'nfc' && p[3] === 'associate' && method === 'POST') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      const body = await request.json().catch(() => ({}));
      const rawUid = String(body.tag_uid || '').trim();
      if (!rawUid) return json({ error: 'Tag UID richiesto' }, 400);
      const tagUid = rawUid.toLowerCase().replace(/[^a-z0-9:]/g, '');
      if (tagUid.length < 4) return json({ error: 'Tag UID non valido' }, 400);

      // Check duplicate on another bike (any active/replaced tag stored)
      const existing = await db.collection('nfc_tags').findOne({ tag_uid: tagUid, status: 'ACTIVE', motorcycle_id: { $ne: moto.id } });
      if (existing) return json({ error: "Questo tag NFC risulta già collegato ad un'altra moto." }, 409);

      const now = new Date();
      // Deactivate any previous ACTIVE tag on this bike
      await db.collection('nfc_tags').updateMany(
        { motorcycle_id: moto.id, status: 'ACTIVE' },
        { $set: { status: 'REPLACED', replaced_at: now } }
      );
      // Create new ACTIVE tag
      const tag = {
        id: uuidv4(), motorcycle_id: moto.id,
        tag_uid: tagUid,
        public_token: generatePublicToken(),
        status: 'ACTIVE', activated_at: now, scan_count: 0, created_at: now,
      };
      await db.collection('nfc_tags').insertOne(tag);
      // Convenience fields on motorcycle
      await db.collection('motorcycles').updateOne(
        { id: moto.id },
        { $set: { nfc_tag_id: tagUid, nfc_associated: true, nfc_associated_date: now, updated_at: now } }
      );
      delete tag._id;
      return json({ nfc: tag, motorcycle: { id: moto.id, nfc_tag_id: tagUid, nfc_associated: true, nfc_associated_date: now } });
    }

    // DELETE /api/motorcycles/:id/nfc/associate - remove association
    if (p[0] === 'motorcycles' && p[1] && p[2] === 'nfc' && p[3] === 'associate' && method === 'DELETE') {
      const moto = await db.collection('motorcycles').findOne({ id: p[1], owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      await db.collection('nfc_tags').updateMany(
        { motorcycle_id: moto.id, status: 'ACTIVE' },
        { $set: { status: 'DISABLED', disabled_at: new Date() } }
      );
      await db.collection('motorcycles').updateOne(
        { id: moto.id },
        { $set: { nfc_associated: false, nfc_tag_id: null, updated_at: new Date() } }
      );
      return json({ ok: true });
    }

    if (p[0] === 'motorcycles' && p[1] && p[2] && !p[3] && method === 'POST') {
      const motorcycleId = p[1];
      const kind = p[2];
      const body = await request.json();
      const moto = await db.collection('motorcycles').findOne({ id: motorcycleId, owner_id: userId });
      if (!moto) return json({ error: 'Non autorizzato' }, 403);
      // Enforce photo limit: cover (main_photo) + gallery items ≤ 3.
      if (kind === 'gallery') {
        const galleryCount = await db.collection('gallery').countDocuments({ motorcycle_id: motorcycleId });
        const hasCover = !!moto.main_photo;
        const total = galleryCount + (hasCover ? 1 : 0);
        if (total >= 3) {
          return json({ error: 'Limite di 3 foto raggiunto (inclusa la copertina). Elimina una foto prima di aggiungerne una nuova.' }, 400);
        }
      }
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
