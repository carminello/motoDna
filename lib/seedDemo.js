import { v4 as uuidv4 } from 'uuid';
import { generatePublicId, generateTagUid, generatePublicToken } from './publicId.js';

export async function seedDemoForUser(db, userId) {
  const existing = await db.collection('motorcycles').findOne({ owner_id: userId, is_demo: true });
  if (existing) return existing;

  const now = new Date();
  const motoId = uuidv4();
  const publicId = generatePublicId({ year: 1984, model: 'VF4' });

  const moto = {
    id: motoId,
    public_id: publicId,
    owner_id: userId,
    brand: 'Honda',
    model: 'VF400F',
    version: 'Interceptor',
    year: 1984,
    engine_cc: 399,
    engine_type: 'V4 4-tempi liquid cooled',
    color: 'Rosso / Bianco',
    current_mileage: 15420,
    main_photo: 'https://images.unsplash.com/photo-1611182150972-4094e06cba79?w=1600&q=80',
    description: 'Honda VF400F del 1984, motore V4 raffreddato a liquido, un piccolo gioiello degli anni 80. Restauro conservativo in corso, meccanica revisionata, verniciatura originale.',
    public_profile: true,
    is_demo: true,
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
  };
  await db.collection('motorcycles').insertOne(moto);

  // NFC tag
  const tagId = uuidv4();
  await db.collection('nfc_tags').insertOne({
    id: tagId,
    motorcycle_id: motoId,
    tag_uid: generateTagUid(),
    public_token: generatePublicToken(),
    status: 'ACTIVE',
    activated_at: now,
    last_scan_at: now,
    scan_count: 327,
    created_at: now,
  });

  // Maintenance
  const maints = [
    {
      id: uuidv4(), motorcycle_id: motoId, user_id: userId,
      service_type: 'OIL', title: 'Cambio olio motore + filtro',
      description: 'Sostituzione olio 10W40 semi-sintetico, filtro olio HiFlo, controllo livello liquido di raffreddamento.',
      date: new Date('2026-09-13'), mileage: 15420, cost: 85, currency: 'EUR',
      verified: false, is_public: true, created_at: new Date('2026-09-13'),
    },
    {
      id: uuidv4(), motorcycle_id: motoId, user_id: userId,
      service_type: 'BRAKES', title: 'Pastiglie freno anteriore',
      description: 'Sostituzione pastiglie freno anteriore con set Brembo sinterizzate. Spurgo circuito.',
      date: new Date('2026-06-02'), mileage: 14200, cost: 120, currency: 'EUR',
      verified: false, is_public: true, created_at: new Date('2026-06-02'),
    },
    {
      id: uuidv4(), motorcycle_id: motoId, user_id: userId,
      service_type: 'CARBURATION', title: 'Sincronizzazione carburatori',
      description: 'Pulizia e sincronizzazione dei 4 carburatori Keihin. Sostituzione getti principali.',
      date: new Date('2026-03-15'), mileage: 13800, cost: 260, currency: 'EUR',
      verified: true, is_public: true, created_at: new Date('2026-03-15'),
    },
  ];
  await db.collection('maintenance').insertMany(maints);

  // Timeline
  const timeline = [
    {
      id: uuidv4(), motorcycle_id: motoId, created_by: userId,
      event_type: 'PURCHASE', title: 'Acquisto della moto',
      description: 'Trovata in un garage nel nord Italia dopo 12 anni di fermo. Documenti in ordine.',
      event_date: new Date('2024-04-11'), mileage: 12980, is_public: true,
      created_at: new Date('2024-04-11'),
    },
    {
      id: uuidv4(), motorcycle_id: motoId, created_by: userId,
      event_type: 'RESTORATION', title: 'Inizio restauro conservativo',
      description: 'Smontaggio, pulizia, revisione motore, elettronica rinnovata.',
      event_date: new Date('2024-06-20'), mileage: 12980, is_public: true,
      created_at: new Date('2024-06-20'),
    },
    {
      id: uuidv4(), motorcycle_id: motoId, created_by: userId,
      event_type: 'TRIP', title: 'Motoraduno Passo dello Stelvio',
      description: 'Prima uscita ufficiale dopo il restauro. 380 km di curve.',
      event_date: new Date('2025-07-05'), mileage: 14020, is_public: true,
      created_at: new Date('2025-07-05'),
    },
    {
      id: uuidv4(), motorcycle_id: motoId, created_by: userId,
      event_type: 'MILESTONE', title: '15.000 km raggiunti',
      description: 'Piccolo traguardo dopo il ritorno in strada.',
      event_date: new Date('2026-08-01'), mileage: 15000, is_public: true,
      created_at: new Date('2026-08-01'),
    },
  ];
  await db.collection('timeline').insertMany(timeline);

  // Modifications
  const mods = [
    {
      id: uuidv4(), motorcycle_id: motoId,
      category: 'EXHAUST', name: 'Silenziatori conici alluminio',
      brand: 'Marving', model: 'Master',
      description: 'Sostituzione silenziatori originali con Marving conici in alluminio. Sound migliorato senza perdere carattere.',
      installation_date: new Date('2025-05-10'), installation_mileage: 13950, cost: 480, is_public: true,
      created_at: new Date('2025-05-10'),
    },
    {
      id: uuidv4(), motorcycle_id: motoId,
      category: 'SUSPENSION', name: 'Ammortizzatori posteriori',
      brand: 'YSS', model: 'G-Series',
      description: 'Ammortizzatori regolabili in precarico e idraulica. Assetto molto migliorato.',
      installation_date: new Date('2025-04-02'), installation_mileage: 13500, cost: 520, is_public: true,
      created_at: new Date('2025-04-02'),
    },
  ];
  await db.collection('modifications').insertMany(mods);

  // Gallery
  const gallery = [
    { id: uuidv4(), motorcycle_id: motoId, uploaded_by: userId, file_url: 'https://images.unsplash.com/photo-1611182150972-4094e06cba79?w=1600&q=80', caption: 'La moto oggi', category: 'PROFILE', is_cover: true, is_public: true, created_at: new Date() },
    { id: uuidv4(), motorcycle_id: motoId, uploaded_by: userId, file_url: 'https://images.unsplash.com/photo-1592466377615-bfe581fe0a63?w=1600&q=80', caption: 'Dettaglio motore V4', category: 'RESTORATION', is_public: true, created_at: new Date() },
    { id: uuidv4(), motorcycle_id: motoId, uploaded_by: userId, file_url: 'https://images.unsplash.com/photo-1505052533681-2be9d65eade5?w=1600&q=80', caption: 'In garage', category: 'PROFILE', is_public: true, created_at: new Date() },
    { id: uuidv4(), motorcycle_id: motoId, uploaded_by: userId, file_url: 'https://images.unsplash.com/photo-1576183135095-4b52bdbb849c?w=1600&q=80', caption: 'Uscita al passo', category: 'TRIP', is_public: true, created_at: new Date() },
  ];
  await db.collection('gallery').insertMany(gallery);

  // Reminders
  await db.collection('reminders').insertMany([
    {
      id: uuidv4(), motorcycle_id: motoId, user_id: userId,
      title: 'Controllo generale 18.000 km',
      description: 'Tagliando completo: valvole, catena, gomme, freni.',
      target_mileage: 18000, repeat_interval_km: 3000,
      status: 'PENDING', created_at: now,
    },
    {
      id: uuidv4(), motorcycle_id: motoId, user_id: userId,
      title: 'Cambio olio motore',
      description: 'Ogni 5000 km o annualmente.',
      target_date: new Date('2027-09-13'), repeat_interval_km: 5000, repeat_interval_months: 12,
      status: 'PENDING', created_at: now,
    },
  ]);

  return moto;
}
