import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { hashPassword, verifyPassword, signToken, getUserFromRequest } from '@/lib/auth';
import { generatePublicId, generateTagUid, generatePublicToken } from '@/lib/publicId';
import { seedDemoForUser } from '@/lib/seedDemo';

const json = (data, status = 200) => NextResponse.json(data, { status });

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
      const owner = await db.collection('users').findOne({ id: moto.owner_id }, { projection: { username: 1, first_name: 1, profile_photo: 1, _id: 0 } });
      const maintenance = await db.collection('maintenance').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0, cost: 0, currency: 0 } }).sort({ date: -1 }).limit(10).toArray();
      const timeline = await db.collection('timeline').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0 } }).sort({ event_date: -1 }).toArray();
      const modifications = await db.collection('modifications').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0, cost: 0 } }).sort({ installation_date: -1 }).toArray();
      const gallery = await db.collection('gallery').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
      const nfc = await db.collection('nfc_tags').findOne({ motorcycle_id: moto.id, status: 'ACTIVE' }, { projection: { _id: 0, scan_count: 1 } });
      db.collection('nfc_tags').updateOne({ motorcycle_id: moto.id, status: 'ACTIVE' }, { $inc: { scan_count: 1 }, $set: { last_scan_at: new Date() } }).catch(() => {});
      db.collection('nfc_scans').insertOne({ id: uuidv4(), motorcycle_id: moto.id, scanned_at: new Date(), device_type: (request.headers.get('user-agent') || '').slice(0, 200) }).catch(() => {});
      return json({ moto, owner, maintenance, timeline, modifications, gallery, scan_count: (nfc?.scan_count || 0) + 1 });
    }

    // ============== AUTHENTICATED ==============
    const auth = await getUserFromRequest(request);
    if (!auth) return json({ error: 'Non autorizzato' }, 401);
    const userId = auth.sub;

    if (path === '/dashboard' && method === 'GET') {
      const motos = await db.collection('motorcycles').find({ owner_id: userId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
      const motoIds = motos.map(m => m.id);
      const recentMaint = await db.collection('maintenance').find({ motorcycle_id: { $in: motoIds } }, { projection: { _id: 0 } }).sort({ date: -1 }).limit(5).toArray();
      const reminders = await db.collection('reminders').find({ user_id: userId, status: 'PENDING' }, { projection: { _id: 0 } }).limit(5).toArray();
      return json({ motos, recent_maintenance: recentMaint, reminders });
    }

    if (path === '/motorcycles' && method === 'GET') {
      const motos = await db.collection('motorcycles').find({ owner_id: userId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
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
      const maintenance = await db.collection('maintenance').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ date: -1 }).toArray();
      const timeline = await db.collection('timeline').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ event_date: -1 }).toArray();
      const modifications = await db.collection('modifications').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ installation_date: -1 }).toArray();
      const gallery = await db.collection('gallery').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
      const documents = await db.collection('documents').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).sort({ document_date: -1 }).toArray();
      const reminders = await db.collection('reminders').find({ motorcycle_id: moto.id }, { projection: { _id: 0 } }).toArray();
      const nfc = await db.collection('nfc_tags').findOne({ motorcycle_id: moto.id, status: 'ACTIVE' }, { projection: { _id: 0 } });
      return json({ moto, maintenance, timeline, modifications, gallery, documents, reminders, nfc });
    }

    if (p[0] === 'motorcycles' && p[1] && !p[2] && method === 'PUT') {
      const body = await request.json();
      const updates = {};
      const fields = ['brand','model','version','year','engine_cc','engine_type','color','current_mileage','main_photo','description','public_profile','status'];
      for (const f of fields) if (f in body) updates[f] = body[f];
      updates.updated_at = new Date();
      await db.collection('motorcycles').updateOne({ id: p[1], owner_id: userId }, { $set: updates });
      const moto = await db.collection('motorcycles').findOne({ id: p[1] }, { projection: { _id: 0 } });
      return json({ moto });
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

    if (p[0] === 'motorcycles' && p[1] && p[2] && p[3] && method === 'DELETE') {
      const kind = p[2];
      const valid = ['maintenance','timeline','modifications','gallery','documents','reminders'];
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
