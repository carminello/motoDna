# 🏁 MotoDNA — Audit Tecnico Completo

**Data:** Giugno 2026
**Auditor:** Senior Next.js 15 / React / MongoDB Architect
**Versione applicazione:** v0.1 MVP
**Stack effettivo:** Next.js 15.5 (App Router) · React 18.3 · MongoDB 6.6 (GridFS) · JWT custom · Tailwind + shadcn/ui
**Nota metodologica:** l'audit è stato eseguito in modalità *read-only*. Nessuna modifica al codice è stata effettuata.

> ⚠️ **Deviazione dallo spec originale:** l'utente ha richiesto una revisione "Supabase". L'applicazione **non usa Supabase** ma MongoDB + custom JWT + GridFS. La sezione 3 è quindi stata rinominata **"Database & API Layer"** ed è stata analizzata con la stessa profondità (query duplicate, N+1, indici mancanti, colli di bottiglia).

---

## 📊 Executive Summary

| Area                  | Stato        | Issue trovati | Severità max |
| --------------------- | ------------ | ------------- | ------------ |
| 🔐 Sicurezza          | ⚠️ Da rivedere | 6            | 🔴 Alta      |
| 🗄️ Database & API     | ⚠️ Ottimizzabile | 7          | 🔴 Alta      |
| ⚡ Performance FE      | ⚠️ Migliorabile | 8          | 🟡 Media     |
| ⚛️ Next.js 15         | ⚠️ Sotto-utilizzato | 6       | 🔴 Alta      |
| 🎨 UX / Fluidità      | 🟡 Buona base  | 7            | 🟡 Media     |
| 📱 Mobile             | 🟡 Sufficiente | 4            | 🟢 Bassa     |
| 🧹 Qualità codice     | ⚠️ Monolitica | 9            | 🟡 Media     |
| **TOTALE**            |              | **47**        |              |

**Punti di forza rilevati** 👍
- Design coerente e distintivo (café-racer aesthetic ben implementata).
- Modello dati pulito, UUID ovunque (no leak di ObjectId).
- Separazione chiara tra profilo pubblico vs. dashboard privato.
- Uso di cookie `httpOnly` + `sameSite=lax` per il JWT.
- Feature funzionanti e testate (NFC, transfer, community, admin).

**Rischi principali** 🚨
1. 🔴 `JWT_SECRET` con fallback hard-coded (`'dev_secret'`).
2. 🔴 Endpoint `/api/files/:id` **pubblico non autenticato** → documenti privati esposti per URL.
3. 🔴 **Zero indici MongoDB** — con >10K utenti il degrado sarà severo.
4. 🔴 Uso di `Math.random()` per generare token/codici di trasferimento (non crittograficamente sicuro).
5. 🔴 Nested `<a>` dentro `<Link>` nella Dashboard (hydration warning React).

---

# 1. ⚡ Performance Frontend

## 1.1 🔴 [ALTA] `Providers.js` creato ma mai collegato → React Query dead code

**File:** `/app/app/providers.js`, `/app/app/layout.js`

**Causa:** il file `providers.js` istanzia un `QueryClient` e un `QueryClientProvider`, ma **non è mai importato** in `layout.js`. Tutti i data-fetch dell'app usano `fetch()` diretto con `useEffect`, senza caching, deduplication, o refetch-on-focus. La libreria `@tanstack/react-query` è in `package.json` ma **inutilizzata** → +30KB nel bundle a vuoto.

**Soluzione:**

```jsx
// app/layout.js
import './globals.css';
import { Toaster } from 'sonner';
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html lang="it" className="dark">
      <body className="min-h-screen bg-black text-neutral-100 antialiased">
        <Providers>{children}</Providers>
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
```

Poi migrare i `fetch + useEffect` a `useQuery` per beneficiare di caching automatico e deduplication. **Oppure**, se non si vuole usare React Query, rimuovere sia `providers.js` sia la dipendenza (`yarn remove @tanstack/react-query @tanstack/react-table`).

---

## 1.2 🔴 [ALTA] Refetch integrale su ogni piccola mutazione

**File:** `/app/app/moto/[id]/page.js` (funzioni `load`, `patch`, `post`, `del`, `regenNfc`, `updateMoto`)

**Causa:** ogni azione utente (toggle privacy, elimina foto, aggiungi km, ecc.) triggera `load()` che rifà **una fetch pesante** che ritorna:
- `moto`, `maintenance` (fino a 200), `timeline` (200), `modifications` (200), `gallery` (200), `documents` (100), `reminders` (100), `nfc`, `postits` (200).

Un semplice toggle su un singolo item genera fino a **1200+ documenti** ritrasferiti. Su mobile 4G = lag percepito 300-800ms.

**Soluzione:** aggiornamento ottimistico locale + eventualmente PATCH mirato.

```jsx
const patch = async (kind, itemId, updates) => {
  // Optimistic update
  setData(d => ({
    ...d,
    [kind]: d[kind].map(x => x.id === itemId ? { ...x, ...updates } : x),
  }));
  const res = await fetch(`/api/motorcycles/${id}/${kind}/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    toast.error('Errore, ripristino...');
    load(); // rollback in caso di errore
  }
};
```

---

## 1.3 🟡 [MEDIA] Componenti pesanti senza `React.memo` / `useCallback` / `useMemo`

**File:** `/app/app/moto/[id]/page.js` (717 righe), `/app/app/dashboard/page.js`

**Causa:** i sub-componenti `TabBadge`, `QuickKmUpdate`, `EditableDescription`, `ItemActions`, `EditMotoDialog`, `AddDialog`, `SectionHeader` sono definiti dentro il file principale e **ricevono callback creati inline** (`onSave={(km) => updateMoto({ current_mileage: km })}`, `onChange={(url) => updateMoto(...)}`). Ogni re-render del padre → nuove reference → tutti i figli si ri-renderizzano anche se le props non sono cambiate.

**Soluzione:**
- Estrarre i sub-componenti in `/app/components/moto/*.jsx`.
- Wrapparli con `React.memo`.
- Stabilizzare callback con `useCallback`.
- Calcolare `publicUrl` una sola volta con `useMemo`.

```jsx
const publicUrl = useMemo(
  () => `${window.location.origin}/m/${moto.public_id}`,
  [moto.public_id]
);

const updateMoto = useCallback(async (patch) => {
  const res = await fetch(`/api/motorcycles/${id}`, { /* … */ });
  if (res.ok) { toast.success('Aggiornato'); load(); }
}, [id]);
```

---

## 1.4 🟡 [MEDIA] Landing page: flash dell'auth screen anche se già loggato

**File:** `/app/app/page.js` righe 19-28

**Causa:** l'utente autenticato vede prima il landing/form e **poi** il redirect a `/dashboard` dopo il round-trip a `/api/auth/me`. UX percepita: "flicker" e transizione lenta.

**Soluzione:** trasformare la home in **Server Component** che legge il cookie e reindirizza server-side prima ancora di renderizzare.

```jsx
// app/page.js (server component)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import LandingClient from './LandingClient';

export default async function Page() {
  const token = (await cookies()).get('motodna_token')?.value;
  if (token && verifyToken(token)) redirect('/dashboard');
  return <LandingClient />;
}
```

---

## 1.5 🟡 [MEDIA] Immagini non ottimizzate ovunque

**File:** `/app/next.config.js`, tutte le pagine

**Causa:** `images: { unoptimized: true }` disabilita l'ottimizzazione di Next. Vengono usati `<img>` nativi ovunque, senza `loading="lazy"`, senza `sizes`, senza AVIF/WebP conversion. Le immagini demo da Unsplash sono servite a **1600px @q=80** anche su thumbnail 40x40.

**Soluzione:**
1. Se GridFS è la sola fonte di verità, aggiungere endpoint di **resize on-the-fly** (`/api/files/:id?w=400`) con `sharp`.
2. Aggiungere `loading="lazy"` a tutti gli `<img>` non above-the-fold.
3. Per gli avatar tondi 32-40px, servire una thumbnail dedicata.

```jsx
<img
  src={m.main_photo}
  alt={m.model}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover"
/>
```

---

## 1.6 🟡 [MEDIA] Community: debounce 300ms triggera 2 fetch iniziali

**File:** `/app/app/community/page.js` righe 36-44

**Causa:** al mount ci sono **due** `useEffect`: uno fa `load()` senza query, l'altro parte con `q=''` e dopo 300ms fa un secondo `load('')`. Sono 2 chiamate HTTP identiche.

**Soluzione:** unificare in un solo `useEffect` con debounce:

```jsx
useEffect(() => {
  const t = setTimeout(() => load(q), q ? 300 : 0);
  return () => clearTimeout(t);
}, [q]);
```

---

## 1.7 🟢 [BASSA] Bundle: dipendenze presenti ma inutilizzate

**File:** `/app/package.json`

Pacchetti mai importati nel codice sorgente (rimozione consigliata):
- `@tanstack/react-query` + `@tanstack/react-table` (~55 KB gzip)
- `embla-carousel-react` (~12 KB)
- `react-day-picker`, `input-otp`, `react-resizable-panels`, `vaul` (installati con shadcn defaults)
- `lodash` (mai importato)
- `dayjs` **e** `date-fns` — duplicati, tenere solo uno
- `axios` — mai usato, si usa `fetch`

**Soluzione:** `yarn remove ...` dei non usati. Risparmio stimato: ~150 KB nel bundle client.

---

## 1.8 🟢 [BASSA] Chat: polling 5s consuma banda e batteria

**File:** `/app/app/messages/[userId]/page.js` riga 38

Già a roadmap (Task 5 - SSE). Peggiora esperienza mobile: la chat batte 12 richieste/minuto anche a tab aperta e inattiva.

**Soluzione temporanea:** sospendere polling quando `document.visibilityState !== 'visible'`.

```jsx
useEffect(() => {
  let interval;
  const start = () => { interval = setInterval(load, 5000); };
  const stop = () => clearInterval(interval);
  start();
  const onVis = () => document.hidden ? stop() : (load(), start());
  document.addEventListener('visibilitychange', onVis);
  return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
}, [userId]);
```

---

# 2. ⚛️ Next.js 15 (App Router)

## 2.1 🔴 [ALTA] Nested `<a>` dentro `<Link>` → hydration mismatch

**File:** `/app/app/dashboard/page.js` righe 102-134

**Causa:** `<Link href="/moto/${m.id}">` (che genera `<a>`) racchiude una `<Card>` al cui interno c'è un altro `<a href="/m/${m.public_id}">`. HTML non permette anchor annidati → React 18 emette hydration warning e Safari può comportarsi in modo imprevisto (click sul link interno può triggerare il parent).

**Soluzione:** trasformare la Card in link "primario" e usare `onClick + router.push` per il link secondario, oppure spostare il link secondario fuori dalla Card.

```jsx
<Card className="metallic overflow-hidden group cursor-pointer" onClick={() => router.push(`/moto/${m.id}`)}>
  {/* ... contenuto ... */}
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); window.open(`/m/${m.public_id}`); }}
    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
  >
    <Wifi className="w-3 h-3" /> Profilo pubblico
  </button>
</Card>
```

---

## 2.2 🔴 [ALTA] Tutto è `'use client'` — Server Components non sfruttati

**File:** `/app/app/m/[public_id]/page.js`, `/app/app/community/page.js`, `/app/app/admin/page.js`, `/app/app/dashboard/page.js`, `/app/app/moto/[id]/page.js`, `/app/app/u/[userId]/page.js`, `/app/app/messages/*`

**Causa:** ogni page è client. Il **profilo pubblico** `/m/[public_id]` in particolare è la vetrina "aha-moment" dell'app (utente scannerizza NFC → viene aperta la pagina). Deve essere:
- 🚀 Ultra-veloce (LCP < 1s da mobile 4G).
- 🌐 Indicizzabile SEO.
- 📱 Con OG meta per share preview su WhatsApp/IG.

Attualmente carica shell vuoto → fetch client → render → LCP ~2-3s.

**Soluzione:** trasformare `/m/[public_id]` e `/u/[userId]` in Server Components con `generateMetadata`.

```jsx
// app/m/[public_id]/page.js
import { getPublicMoto } from '@/lib/moto-server';

export async function generateMetadata({ params }) {
  const { public_id } = await params;
  const data = await getPublicMoto(public_id);
  if (!data) return { title: 'MotoDNA - Non trovata' };
  return {
    title: `${data.moto.brand} ${data.moto.model} · MotoDNA`,
    description: data.moto.description?.slice(0, 160) || 'Il passaporto digitale della moto',
    openGraph: {
      title: `${data.moto.brand} ${data.moto.model}`,
      images: [data.moto.main_photo],
    },
  };
}

export default async function PublicProfile({ params }) {
  const { public_id } = await params;
  const data = await getPublicMoto(public_id);
  if (!data) notFound();
  return <PublicProfileClient initialData={data} publicId={public_id} />;
}
```

I post-it rimangono client (interattivi), ma tutto il resto è SSR + streaming.

---

## 2.3 🟡 [MEDIA] File `error.js` / `not-found.js` / `loading.js` mancanti

**File:** cartella `/app/app/` (root)

**Causa:** in Next 15 App Router, questi file speciali gestiscono stati globali. Attualmente ogni pagina reimplementa il proprio errore/loading come stringa "Caricamento...".

**Soluzione:** creare:

```jsx
// app/loading.js
export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-500">
        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        Caricamento MotoDNA...
      </div>
    </div>
  );
}

// app/not-found.js
export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
      <div>
        <div className="text-6xl mono text-orange-400 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Segnale perso</h1>
        <p className="text-neutral-400 mb-6">Questa rotta non esiste — o il tag NFC punta a una moto rimossa.</p>
        <a href="/" className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded">Torna alla base</a>
      </div>
    </div>
  );
}

// app/error.js ('use client')
'use client';
export default function GlobalError({ error, reset }) {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-xl">Qualcosa è andato storto</h1>
      <button onClick={reset} className="mt-4 px-4 py-2 bg-orange-600 rounded">Riprova</button>
    </div>
  );
}
```

---

## 2.4 🟡 [MEDIA] API catch-all monolitica

**File:** `/app/app/api/[[...path]]/route.js` (774 righe)

**Causa:** un unico handler con 40+ if-else in cascata. In App Router **non è idiomatico** — ogni risorsa dovrebbe avere il proprio file.

**Soluzione (Fase 4):** migrare a struttura file-based:

```
app/api/
├── auth/
│   ├── login/route.js
│   ├── register/route.js
│   ├── logout/route.js
│   └── me/route.js
├── motorcycles/
│   ├── route.js                          # GET list, POST create
│   └── [id]/
│       ├── route.js                      # GET, PUT
│       ├── transfer/route.js
│       ├── nfc/route.js
│       ├── nfc/associate/route.js
│       └── [kind]/
│           ├── route.js                  # POST sub-item
│           └── [itemId]/route.js         # PATCH, DELETE
├── public/[public_id]/route.js
├── public/[public_id]/postit/route.js
├── community/users/route.js
├── community/users/[id]/route.js
├── messages/route.js
├── messages/[userId]/route.js
├── admin/stats/route.js
├── uploads/route.js
└── files/[id]/route.js
```

Con middleware condiviso in `/lib/api/withAuth.js`.

---

## 2.5 🟡 [MEDIA] `serverExternalPackages` corretto ma `output: 'standalone'` con headers CORS troppo aperti

**File:** `/app/next.config.js` righe 26-39

```js
{ key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" }
```

**Causa:** l'header è applicato a **tutte** le rotte, comprese quelle di auth. Con `credentials: 'include'` i browser rifiutano `*`, quindi in pratica non è sfruttabile via browser, ma resta un attack surface (script server-to-server, curl da altre origin per phishing). Inoltre `X-Frame-Options: ALLOWALL` non è un valore standard (i valori validi sono `DENY`, `SAMEORIGIN`, `ALLOW-FROM`) → **ignorato** dal browser; combinato con `frame-ancestors *` = clickjacking possibile.

**Soluzione:**

```js
async headers() {
  const isProd = process.env.NODE_ENV === 'production';
  const origin = process.env.CORS_ORIGINS || (isProd ? 'https://dna-garage.preview.emergentagent.com' : '*');
  return [
    {
      source: "/api/(.*)",
      headers: [
        { key: "Access-Control-Allow-Origin", value: origin },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, PATCH, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        { key: "Access-Control-Allow-Credentials", value: "true" },
      ],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    },
  ];
}
```

---

## 2.6 🟢 [BASSA] `console.error` di API non filtrata

**File:** `/app/app/api/[[...path]]/route.js` riga 764

Ogni errore viene loggato con `console.error`. In produzione va integrato un vero logger (Pino/Winston/Sentry).

---

# 3. 🗄️ Database & API Layer (MongoDB)

## 3.1 🔴 [ALTA] **ZERO indici definiti**

**File:** `/app/lib/mongodb.js` (nessuna inizializzazione di indici)

**Causa:** MongoDB non ha indici tranne `_id`. Le query stanno oggi funzionando perché il DB è **quasi vuoto**. A 10K utenti e 100K post-it, ogni ricerca sarà una **collection scan**.

**Query eseguite frequentemente senza indice supportante:**

| Collezione       | Query                                           | Indice mancante                                     |
| ---------------- | ----------------------------------------------- | --------------------------------------------------- |
| `users`          | `findOne({ email })`                            | `email` (unique)                                    |
| `users`          | `findOne({ id })` (ovunque)                     | `id` (unique)                                       |
| `motorcycles`    | `findOne({ public_id })`                        | `public_id` (unique)                                |
| `motorcycles`    | `find({ owner_id })`                            | `owner_id`                                          |
| `maintenance`    | `find({ motorcycle_id }).sort({ date: -1 })`    | `{ motorcycle_id: 1, date: -1 }`                    |
| `timeline`       | `find({ motorcycle_id }).sort({ event_date })`  | `{ motorcycle_id: 1, event_date: -1 }`              |
| `modifications`  | `find({ motorcycle_id })`                       | `motorcycle_id`                                     |
| `gallery`        | `find({ motorcycle_id })`                       | `motorcycle_id`                                     |
| `documents`      | `find({ motorcycle_id })`                       | `motorcycle_id`                                     |
| `reminders`      | `find({ user_id, status: 'PENDING' })`          | `{ user_id: 1, status: 1 }`                         |
| `messages`       | `find({ $or: from/to })`                        | `{ from_user_id: 1, to_user_id: 1, created_at: -1 }` |
| `messages`       | Aggregazione conversation list                  | idem                                                |
| `postits`        | `find({ motorcycle_id })`                       | `{ motorcycle_id: 1, created_at: -1 }`              |
| `postits`        | rate-limit `count({ ip_hint, created_at })`     | `{ ip_hint: 1, created_at: -1 }`                    |
| `nfc_tags`       | `findOne({ motorcycle_id, status })`            | `{ motorcycle_id: 1, status: 1 }`                   |
| `nfc_tags`       | `findOne({ tag_uid, status, motorcycle_id })`   | `{ tag_uid: 1 }`                                    |
| `transfers`      | `findOne({ code, status })`                     | `{ code: 1 }` (unique)                              |
| `nfc_scans`      | `countDocuments` in admin stats                 | `{ scanned_at: -1 }`                                |

**Soluzione:** creare `/app/lib/initIndexes.js` chiamato una volta all'avvio (per esempio al primo `getDb()`).

```js
// lib/initIndexes.js
export async function ensureIndexes(db) {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ id: 1 }, { unique: true }),
    db.collection('users').createIndex({ last_seen: -1 }),
    db.collection('users').createIndex({ created_at: -1 }),

    db.collection('motorcycles').createIndex({ public_id: 1 }, { unique: true }),
    db.collection('motorcycles').createIndex({ id: 1 }, { unique: true }),
    db.collection('motorcycles').createIndex({ owner_id: 1, created_at: -1 }),

    db.collection('maintenance').createIndex({ motorcycle_id: 1, date: -1 }),
    db.collection('timeline').createIndex({ motorcycle_id: 1, event_date: -1 }),
    db.collection('modifications').createIndex({ motorcycle_id: 1, installation_date: -1 }),
    db.collection('gallery').createIndex({ motorcycle_id: 1, created_at: -1 }),
    db.collection('documents').createIndex({ motorcycle_id: 1, document_date: -1 }),
    db.collection('reminders').createIndex({ user_id: 1, status: 1 }),
    db.collection('reminders').createIndex({ motorcycle_id: 1 }),

    db.collection('postits').createIndex({ motorcycle_id: 1, created_at: -1 }),
    db.collection('postits').createIndex({ ip_hint: 1, created_at: -1 }),

    db.collection('messages').createIndex({ from_user_id: 1, to_user_id: 1, created_at: -1 }),
    db.collection('messages').createIndex({ to_user_id: 1, read_at: 1 }),

    db.collection('nfc_tags').createIndex({ motorcycle_id: 1, status: 1 }),
    db.collection('nfc_tags').createIndex({ tag_uid: 1 }),
    db.collection('nfc_scans').createIndex({ scanned_at: -1 }),
    db.collection('nfc_scans').createIndex({ scanned_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }), // TTL 1 anno

    db.collection('transfers').createIndex({ code: 1 }, { unique: true }),
    db.collection('transfers').createIndex({ motorcycle_id: 1, status: 1 }),
  ]);
}
```

E in `lib/mongodb.js`:

```js
import { ensureIndexes } from './initIndexes';

let indexesReady;
export async function getDb() {
  const c = await clientPromise;
  const db = c.db(dbName);
  if (!indexesReady) indexesReady = ensureIndexes(db).catch(err => { console.error('Index init failed', err); indexesReady = null; });
  await indexesReady;
  return db;
}
```

**Impatto atteso:** riduzione latenza 10-50× su query di lettura filtrate + risparmio CPU DB del ~70%.

---

## 3.2 🔴 [ALTA] Query sequenziali dove servirebbero paralleli (N+1 latenza)

**File:** `/app/app/api/[[...path]]/route.js`

**Punti caldi:**

**A) Public profile — `GET /api/public/:public_id` (righe 116-136):**
7 query `await` sequenziali per pagina (moto → owner → maintenance → timeline → modifications → gallery → postits → nfc). Latenza totale ≈ sum(7 RTT).

```js
// ❌ ATTUALE
const moto = await db.collection('motorcycles').findOne(...);
const owner = await db.collection('users').findOne(...);
const maintenance = await db.collection('maintenance').find(...).toArray();
const timeline = await db.collection('timeline').find(...).toArray();
// ...

// ✅ PROPOSTO
const moto = await db.collection('motorcycles').findOne({ public_id: publicId });
if (!moto || !moto.public_profile) return json({ error: 'Profilo privato' }, 403);

const [owner, maintenance, timeline, modifications, gallery, postits, nfc] = await Promise.all([
  db.collection('users').findOne({ id: moto.owner_id }, { projection: { username: 1, first_name: 1, profile_photo: 1, _id: 0 } }),
  db.collection('maintenance').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0, cost: 0 } }).sort({ date: -1 }).limit(50).toArray(),
  db.collection('timeline').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0 } }).sort({ event_date: -1 }).limit(50).toArray(),
  db.collection('modifications').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0, cost: 0 } }).sort({ installation_date: -1 }).limit(50).toArray(),
  db.collection('gallery').find({ motorcycle_id: moto.id, is_public: true }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(100).toArray(),
  db.collection('postits').find({ motorcycle_id: moto.id, is_hidden: { $ne: true } }, { projection: { _id: 0, ip_hint: 0 } }).sort({ created_at: -1 }).limit(200).toArray(),
  db.collection('nfc_tags').findOne({ motorcycle_id: moto.id, status: 'ACTIVE' }, { projection: { _id: 0, scan_count: 1 } }),
]);
```

**B) Owner dashboard motorcycle detail — `GET /api/motorcycles/:id` (righe 603-614):** identico pattern con 8 query sequenziali. Stessa fix.

**C) Dashboard — `GET /api/dashboard` (righe 563-568):** 3 query sequenziali (motos, maintenance, reminders). Fix: `Promise.all`.

**Impatto atteso:** latenza pagina ridotta da ~250ms a ~60ms.

---

## 3.3 🔴 [ALTA] Ownership transfer non transazionale

**File:** `/app/app/api/[[...path]]/route.js` righe 179-201

**Causa:** l'accettazione trasferimento fa 4 operazioni non atomiche:
1. Chiude vecchio `ownership_history`.
2. Apre nuovo `ownership_history`.
3. Aggiorna `motorcycles.owner_id`.
4. Chiude `transfers` con `status: COMPLETED`.

Se il container crasha tra step 2 e 3 → doppia proprietà attiva. Se crasha tra 3 e 4 → il codice resta `PENDING` e riutilizzabile.

**Soluzione:** transazione MongoDB (richiede replica set — MongoDB standalone non le supporta, ma in produzione userai Atlas).

```js
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    await db.collection('ownership_history').updateMany({ /* … */ }, { /* … */ }, { session });
    await db.collection('ownership_history').insertOne({ /* … */ }, { session });
    await db.collection('motorcycles').updateOne({ /* … */ }, { /* … */ }, { session });
    await db.collection('transfers').updateOne({ /* … */ }, { /* … */ }, { session });
  });
} finally {
  session.endSession();
}
```

Alternativa quick-win (standalone): scrivere prima nel record `transfers` uno stato `LOCKED` e riordinare le operazioni in modo idempotente.

---

## 3.4 🟡 [MEDIA] `nfc_scans` cresce all'infinito

**File:** `/app/app/api/[[...path]]/route.js` riga 134

**Causa:** ogni scan inserisce un doc in `nfc_scans` senza rotazione. A 100 scan/giorno per 5000 tag = 500K doc/anno. Nessuna aggregazione, nessun TTL.

**Soluzione:** TTL index a 1 anno + aggregazione giornaliera async (job serverless).

```js
db.collection('nfc_scans').createIndex(
  { scanned_at: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }
);
```

---

## 3.5 🟡 [MEDIA] Fetch full user profile in `/api/auth/me` a ogni page mount

**File:** `/app/app/api/[[...path]]/route.js` righe 106-113

**Causa:** ogni pagina chiama `/api/auth/me` in `useEffect`. Con 3-4 route interne per sessione, sono 3-4 letture full-document di `users`.

**Soluzione:** il JWT già contiene `sub` e `email`. Restituire un profile "cache" da JWT senza query DB, oppure spostare in `middleware.ts` così il `user` viene passato via header.

---

## 3.6 🟡 [MEDIA] `/api/admin/stats` esegue 13 count su ogni load

**File:** `/app/app/api/[[...path]]/route.js` righe 342-414

**Causa:** su collezioni piccole non è un problema, ma i `countDocuments` sono O(N) senza filtri stretti. Con >1M records diventa pesante.

**Soluzione:** materializzare una `stats_cache` collection aggiornata ogni 5 minuti via job leggero.

```js
// Prima query: leggi cache
const cache = await db.collection('stats_cache').findOne({ _id: 'global' });
if (cache && cache.updated_at > new Date(Date.now() - 5 * 60_000)) {
  return json(cache.data);
}
// Altrimenti calcola e salva
```

---

## 3.7 🟢 [BASSA] `is_admin` non validato al login

**File:** `/app/app/api/[[...path]]/route.js` riga 95

Il login restituisce `is_admin: !!user.is_admin` ma il flag arriva dal DB e non è nel JWT → per verificare admin serve sempre `findOne`. Aggiungere `is_admin` al payload JWT (con rotazione all'update) accelera.

---

# 4. 🎨 UX & Fluidità

## 4.1 🔴 [ALTA] Uso di `confirm()` nativo del browser

**File:** `/app/app/moto/[id]/page.js` righe 55, 379, 438, 444, 513

**Causa:** `if (!confirm('Eliminare...?'))` fa apparire un popup di sistema, non stilizzato, blocca il touch UI su iOS, non è dark-mode-aware. Rompe l'estetica café-racer.

**Soluzione:** usare shadcn `<AlertDialog>` (già installato in `package.json`).

```jsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

<AlertDialog>
  <AlertDialogTrigger asChild>
    <button className="p-1.5 rounded-md hover:bg-red-500/10 text-neutral-400 hover:text-red-400">
      <Trash2 className="w-4 h-4" />
    </button>
  </AlertDialogTrigger>
  <AlertDialogContent className="bg-neutral-950 border-white/10">
    <AlertDialogHeader>
      <AlertDialogTitle>Eliminare questo elemento?</AlertDialogTitle>
      <AlertDialogDescription>L'azione è permanente.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annulla</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-500">Elimina</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 4.2 🟡 [MEDIA] Loading states = `"Caricamento..."` testuale

**File:** tutte le pagine

Sostituire con **skeleton loaders** shadcn. Il template ha già `<Skeleton>` disponibile.

```jsx
if (!data) return (
  <div className="max-w-6xl mx-auto px-5 pt-8 space-y-4">
    <Skeleton className="h-10 w-64 bg-neutral-900" />
    <div className="grid md:grid-cols-2 gap-4">
      {[1,2].map(i => <Skeleton key={i} className="h-64 bg-neutral-900" />)}
    </div>
  </div>
);
```

---

## 4.3 🟡 [MEDIA] Public profile: nessun bottone Share / QR

Chi scansiona il tag non può ri-condividere. Aggiungere un floating button con `navigator.share` API.

```jsx
<button
  onClick={() => navigator.share({
    title: `${moto.brand} ${moto.model}`,
    text: `Guarda questa moto su MotoDNA`,
    url: window.location.href,
  })}
  className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-500 shadow-2xl flex items-center justify-center z-50 md:hidden"
>
  <Share2 className="w-5 h-5" />
</button>
```

---

## 4.4 🟡 [MEDIA] Add dialog: nessuna validazione visibile

**File:** `/app/app/moto/[id]/page.js` `AddDialog` componente riga 679

Il form usa `required` HTML ma non mostra errori inline. Su iOS il tooltip nativo di validazione è brutto.

**Soluzione:** integrare `react-hook-form` + `zod` (entrambi già in `package.json`).

---

## 4.5 🟡 [MEDIA] Tab bar da 8 tab su mobile

**File:** `/app/app/moto/[id]/page.js` riga 112

`grid grid-cols-4 md:grid-cols-8` = 2 righe su mobile. Su schermi <380px le icone diventano cramped. Meglio uno scroll orizzontale con snap.

```jsx
<TabsList className="flex md:grid md:grid-cols-8 gap-2 bg-transparent h-auto p-0 w-full overflow-x-auto snap-x snap-mandatory md:overflow-visible pb-2">
  <TabBadge className="snap-start shrink-0 w-[100px] md:w-auto" /* ... */ />
```

---

## 4.6 🟢 [BASSA] Toast non descrittivi

`toast.success('Aggiornato')` per qualsiasi cosa. Meglio contestualizzare: "Km aggiornati a 15.420", "Foto profilo cambiata", ecc.

---

## 4.7 🟢 [BASSA] Empty states poveri

Dashboard senza moto: manca CTA visiva. Community senza risultati: solo testo "Nessun utente trovato". Aggiungere illustrazioni SVG minimal.

---

# 5. 🔐 Sicurezza

## 5.1 🔴 [ALTA] `JWT_SECRET` con fallback hard-coded

**File:** `/app/lib/auth.js` riga 5

```js
const SECRET = process.env.JWT_SECRET || 'dev_secret';
```

**Causa:** in produzione, se la variabile non è settata (o è vuota per errore), il fallback `'dev_secret'` è usato. Un attaccante può forgiare JWT arbitrari (`sub: <any-user-id>`) e prendere il controllo di qualsiasi account.

**Attenzione:** `.env` in questo repo **non contiene** `JWT_SECRET` → **attualmente in produzione stai usando `'dev_secret'`**. È una vulnerabilità critica attiva.

**Soluzione:**

```js
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set (min 32 chars) — refuse to boot');
}
```

E aggiungere in `.env`:
```
JWT_SECRET=<generato con: openssl rand -base64 48>
```

---

## 5.2 🔴 [ALTA] `/api/files/:id` pubblico → documenti privati leakable

**File:** `/app/app/api/[[...path]]/route.js` righe 37-61

**Causa:** l'endpoint serve **qualsiasi file GridFS** senza controllo di ownership. I documenti (fatture, tagliandi, ricevute) sono uploadati nello stesso bucket delle foto pubbliche. Chiunque conosca l'`ObjectId` scarica il file (12 byte, non brute-force in tempo reale, ma **URL leak via referer / analytics / condivisione accidentale** = compromissione).

**Soluzione:** discriminare "file pubblico" vs "file privato" già a upload:

1. **Metadata GridFS** con `visibility: 'public' | 'private'` e `owner_id`.
2. Il GET verifica:
   - `visibility === 'public'` → serve senza auth.
   - `visibility === 'private'` → richiede `auth.sub === metadata.owner_id`.

```js
if (p[0] === 'files' && p[1] && method === 'GET') {
  const idStr = p[1].split('.')[0];
  if (!ObjectId.isValid(idStr)) return new NextResponse('Not found', { status: 404 });
  const bucket = await getBucket();
  const fileId = new ObjectId(idStr);
  const files = await bucket.find({ _id: fileId }).toArray();
  if (!files[0]) return new NextResponse('Not found', { status: 404 });
  const file = files[0];
  if (file.metadata?.visibility === 'private') {
    const auth = await getUserFromRequest(request);
    if (!auth || auth.sub !== file.metadata.owner_id) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  // ... stream
}
```

E in `/api/uploads` distinguere in base al `kind` (documento = private; foto/avatar = public).

---

## 5.3 🔴 [ALTA] `Math.random()` per token/codici

**File:** `/app/lib/publicId.js` righe 6-8

```js
function randChars(source, len) {
  let out = '';
  for (let i = 0; i < len; i++) out += source[Math.floor(Math.random() * source.length)];
  return out;
}
```

**Causa:** `generateTransferCode()` (codice a 8 char che dà accesso a proprietà di una moto), `generatePublicToken()` (24 char) usano `Math.random()` → **non crittograficamente sicuro**, predicibile con abbastanza sample.

**Soluzione:** usare `crypto.randomInt` (Node.js builtin).

```js
import { randomInt } from 'crypto';

function randChars(source, len) {
  let out = '';
  for (let i = 0; i < len; i++) out += source[randomInt(source.length)];
  return out;
}
```

---

## 5.4 🟡 [MEDIA] Nessun rate limit su `/api/auth/login`

**File:** `/app/app/api/[[...path]]/route.js` righe 88-98

Un attaccante può brute-forceare password. bcrypt cost=10 rallenta (~100ms/try) ma non blocca.

**Soluzione:** implementare rate limiting a livello di route (o via middleware) — 5 tentativi/min/IP.

```js
// lib/rateLimit.js
const attempts = new Map();
export function rateLimit(key, max = 5, windowMs = 60_000) {
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  attempts.set(key, entry);
  return entry.count <= max;
}
```

E nel login:
```js
const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
if (!rateLimit(`login:${ip}`)) return json({ error: 'Troppi tentativi' }, 429);
```

In produzione, sostituire con Redis o `@upstash/ratelimit`.

---

## 5.5 🟡 [MEDIA] Validazione input assente / manuale

**File:** tutti gli endpoint di `route.js`

**Causa:** ogni endpoint fa `parseInt`, `String(x).trim()`, `body.foo || ''` a mano. Nessuno schema. Un client malintenzionato può inviare payload arbitrari (esempio: `year: { $ne: null }` → NoSQL injection prevented da MongoDB driver ma buon pattern comunque).

**Soluzione:** definire schemi `zod` per ogni endpoint.

```js
// lib/schemas.js
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(200),
  first_name: z.string().max(60).optional(),
  last_name: z.string().max(60).optional(),
  username: z.string().max(40).optional(),
});

export const MotoCreateSchema = z.object({
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  engine_cc: z.coerce.number().int().min(1).max(3000).optional(),
  // ...
});
```

Nel route:
```js
const parsed = RegisterSchema.safeParse(await request.json());
if (!parsed.success) return json({ error: 'Dati non validi', issues: parsed.error.issues }, 400);
```

---

## 5.6 🟢 [BASSA] Trasferimento — codice riutilizzabile prima della scadenza

**File:** `/app/app/api/[[...path]]/route.js`

Il codice trasferimento è valido 7 giorni. Se l'utente lo condivide su un canale non sicuro e uno "estraneo" lo intercetta prima del destinatario → prende la moto. Aggiungere una conferma email opzionale + un limite di 1 view del preview prima della conferma.

---

# 6. 📱 Mobile

## 6.1 🟡 [MEDIA] Touch target sotto la soglia

**File:** header di tutte le pagine

Alcuni bottoni sono `size="sm"` = h-9 (36px). Le Human Interface Guidelines Apple raccomandano 44×44px, Google 48dp. Su Dashboard: bottoni Admin, Community, Messaggi h-9 su mobile.

**Soluzione:** `h-10 md:h-9` per compattare solo su desktop.

---

## 6.2 🟢 [BASSA] Hero pubblico `70vh min-h-[500px]` occupa quasi tutto lo schermo mobile

**File:** `/app/app/m/[public_id]/page.js` riga 67

Su iPhone SE (568px altezza) l'hero copre 100% dello schermo. L'utente crede che sia una vecchia landing page.

**Soluzione:** `h-[50vh] md:h-[70vh] min-h-[400px]`.

---

## 6.3 🟢 [BASSA] `PostItWall` grid con rotazione può overfloware orizzontalmente

**File:** `/app/app/m/[public_id]/page.js` riga 321

Le rotazioni `rotate(${rotate}deg)` con `-2..+2 deg` su cards larghe possono generare scroll orizzontale. Aggiungere `overflow-hidden` al parent.

---

## 6.4 🟢 [BASSA] Font monospace per numeri km su schermi molto piccoli

Su iPhone SE il numero "15.420" con font-mono a `text-3xl` insieme all'icona pencil può wrappare. Testare a 320px.

---

# 7. 🧹 Qualità del codice

## 7.1 🔴 [ALTA] `moto/[id]/page.js` = 717 righe, componente God-file

**File:** `/app/app/moto/[id]/page.js`

**Soluzione:** split proposto:

```
app/moto/[id]/
├── page.js                    # Wrapper (server) + data fetch iniziale
├── MotoView.jsx               # Client shell con Tabs
├── tabs/
│   ├── OverviewTab.jsx
│   ├── MaintenanceTab.jsx
│   ├── TimelineTab.jsx
│   ├── ModificationsTab.jsx
│   ├── GalleryTab.jsx
│   ├── DocumentsTab.jsx
│   ├── BachecaTab.jsx
│   └── NfcTab.jsx
├── components/
│   ├── EditMotoDialog.jsx
│   ├── QuickKmUpdate.jsx
│   ├── AddItemDialog.jsx
│   ├── ItemActions.jsx
│   ├── TransferPanel.jsx
│   └── ChangeMainPhoto.jsx
```

---

## 7.2 🟡 [MEDIA] `route.js` = 774 righe monolitico

Vedi Sez. 2.4.

---

## 7.3 🟡 [MEDIA] Codice duplicato: `timeAgo`

**File:** `/app/app/m/[public_id]/page.js` riga 265, `/app/app/messages/page.js` riga 11

Estrarre in `/lib/date.js`.

```js
// lib/date.js
export function timeAgo(date) {
  const d = new Date(date);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'ora';
  if (s < 3600) return `${Math.floor(s / 60)}m fa`;
  if (s < 86400) return `${Math.floor(s / 3600)}h fa`;
  if (s < 604800) return `${Math.floor(s / 86400)}g fa`;
  return d.toLocaleDateString('it-IT');
}
```

---

## 7.4 🟡 [MEDIA] Upload handler duplicato in 3 file

**File:** `/app/app/dashboard/page.js` (`ImageUploaderCircle`), `/app/app/moto/[id]/page.js` (`ChangeMainPhoto`), `/app/components/ImageUploader.jsx`

Tre implementazioni della stessa logica di upload. Consolidare in un unico componente parametrizzato.

```jsx
// components/UploadButton.jsx
export default function UploadButton({ onUploaded, accept = 'image/*', children, className }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded(data);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => handle(e.target.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={className}>
        {typeof children === 'function' ? children(busy) : children}
      </button>
    </>
  );
}
```

---

## 7.5 🟡 [MEDIA] `MAINT_TYPES`, `EVENT_TYPES` ridondanti

**File:** `/app/app/moto/[id]/page.js` righe 23-26

Le costanti duplicano quello che è già in `lib/categoryIcons.js` (`MAINTENANCE_ICONS.map(x => x.value)`).

```js
// Rimuovi le costanti locali, deriva dall'icon map
const MAINT_TYPES = MAINTENANCE_ICONS.map(o => o.value);
// oppure semplicemente non serve — il codice usa già gli icon objects
```

---

## 7.6 🟢 [BASSA] Import non usati

- `/app/app/dashboard/page.js`: `Calendar` (riga 10), `Cpu`.
- `/app/app/admin/page.js`: `LineChart`, `Line` da recharts (usa solo `AreaChart`).
- `/app/app/page.js`: `Cpu` (mai usato).

---

## 7.7 🟢 [BASSA] Seed demo con dati "futuri" (2026-09-13 ecc.)

**File:** `/app/lib/seedDemo.js`

Le date del demo sono nel futuro (2026-2027). Alla presentazione a un investitore il 15/06/2026 si vede una manutenzione "13 settembre 2026" → strano. Meglio usare date relative:

```js
const daysAgo = (n) => new Date(Date.now() - n * 86400_000);
date: daysAgo(30),
```

---

## 7.8 🟢 [BASSA] `scan_count: 327` nel seed → inquina metriche admin

Il demo bike ha 327 scan simulate → l'admin dashboard totalizza scansioni fake. Impostare `scan_count: 0` nel seed o marcare `is_demo` e filtrarli.

---

## 7.9 🟢 [BASSA] `providers.js` è dead-code (vedi 1.1)

Duplicato con la sezione performance ma va segnalato anche qui: file creato e mai importato. Rimuovere o wire.

---

# 🗺️ ROADMAP CONSIGLIATA

## 🔴 FASE 1 — Bug critici (1-2 giorni)

Prima di qualsiasi nuova feature. Sono issue che espongono utenti/dati.

| # | Titolo                                             | File principale                    | Effort |
|---|----------------------------------------------------|------------------------------------|--------|
| 1 | Rimuovere fallback `JWT_SECRET = 'dev_secret'`     | `lib/auth.js` + `.env`             | 15 min |
| 2 | Autenticare `/api/files/:id` per doc privati       | `route.js` + `uploads`             | 2h     |
| 3 | Passare da `Math.random()` a `crypto.randomInt`    | `lib/publicId.js`                  | 20 min |
| 4 | Rate limit su `/api/auth/login`                    | `route.js` + `lib/rateLimit.js`    | 1h     |
| 5 | Fix nested `<a>` in Dashboard                      | `app/dashboard/page.js`            | 30 min |
| 6 | Creare indici MongoDB `ensureIndexes`              | `lib/mongodb.js` + init            | 2h     |
| 7 | Fix headers CSP/CORS (`ALLOWALL` non valido)       | `next.config.js`                   | 30 min |

**Totale: ~1 giorno di lavoro.**

## ⚡ FASE 2 — Performance (2-3 giorni)

| # | Titolo                                                  | File                                | Effort |
|---|---------------------------------------------------------|-------------------------------------|--------|
| 1 | Parallelizzare query `/api/public/:public_id`           | `route.js`                          | 30 min |
| 2 | Parallelizzare query `/api/motorcycles/:id`             | `route.js`                          | 30 min |
| 3 | Parallelizzare `/api/dashboard`                         | `route.js`                          | 15 min |
| 4 | Optimistic updates su patch/delete `moto/[id]`          | `app/moto/[id]/page.js`             | 2h     |
| 5 | Convertire `/m/[public_id]` in Server Component         | `app/m/[public_id]/*`               | 3h     |
| 6 | `generateMetadata` per share preview                    | `app/m/[public_id]/page.js`         | 30 min |
| 7 | Rimuovere pacchetti npm inutilizzati                    | `package.json`                      | 30 min |
| 8 | Chat polling: pausa quando tab hidden                   | `app/messages/[userId]/page.js`     | 15 min |
| 9 | Aggiungere `loading="lazy"` a tutti gli `<img>`         | ovunque                             | 1h     |
| 10| Wire `Providers` in layout o rimuovere QueryClient      | `layout.js` + `providers.js`        | 30 min |

## 🎨 FASE 3 — UX (3-4 giorni)

| # | Titolo                                                | File                            | Effort |
|---|-------------------------------------------------------|---------------------------------|--------|
| 1 | Sostituire tutti i `confirm()` con AlertDialog        | `moto/[id]`, `dashboard`        | 2h     |
| 2 | Skeleton loaders al posto di "Caricamento..."         | tutte le pagine                 | 3h     |
| 3 | `loading.js`, `error.js`, `not-found.js` globali      | `app/`                          | 1h     |
| 4 | Share button + Web Share API su profilo pubblico      | `m/[public_id]`                 | 1h     |
| 5 | QR code fallback (già in backlog Task 2)              | `moto/[id]` + `qrcode` lib      | 3h     |
| 6 | Toast contestualizzati (con dati)                     | ovunque                         | 2h     |
| 7 | Empty states illustrati                               | `dashboard`, `community`        | 3h     |
| 8 | Validazione form con react-hook-form + zod            | `AddDialog`, `EditMotoDialog`   | 4h     |
| 9 | Tab bar mobile scroll orizzontale con snap            | `moto/[id]`                     | 1h     |

## 🚀 FASE 4 — Scalabilità (5-7 giorni)

| # | Titolo                                                | File                            | Effort |
|---|-------------------------------------------------------|---------------------------------|--------|
| 1 | Split `route.js` in file per risorsa                  | `app/api/**`                    | 1.5g   |
| 2 | Split `moto/[id]/page.js` in tab + components         | `app/moto/[id]/*`               | 1g     |
| 3 | Estrarre `timeAgo`, `UploadButton`, `MotoCard` in `/lib` & `/components` | vari                            | 4h     |
| 4 | Zod schemas per tutti gli endpoint                    | `lib/schemas.js` + route        | 1g     |
| 5 | Ownership transfer transazionale                      | `route.js`                      | 3h     |
| 6 | Stats cache per admin (job periodico)                 | `route.js` + cron               | 4h     |
| 7 | TTL su `nfc_scans` + aggregazione giornaliera         | `mongodb.js` + job              | 3h     |
| 8 | Passare `messages` da polling a SSE (Task backlog #5) | `route.js` + client             | 1g     |
| 9 | Middleware auth centralizzato                         | `middleware.ts` + `lib/api`     | 4h     |
| 10| Logger strutturato (pino) + Sentry                    | ovunque                         | 4h     |
| 11| Resize immagini on-the-fly con sharp                  | `route.js` files GET            | 4h     |

---

# 📋 Appendice — Checklist di deploy production-ready

- [ ] `JWT_SECRET` (≥32 char) in secrets manager
- [ ] `MONGO_URL` punta a replica set (per transazioni)
- [ ] `NODE_ENV=production`
- [ ] Indici MongoDB creati (verificare con `db.motorcycles.getIndexes()`)
- [ ] Backup automatici GridFS
- [ ] Rate limit distribuito (Redis / Upstash)
- [ ] Sentry attivo
- [ ] Cookie `secure: true` (già ok)
- [ ] `X-Frame-Options: SAMEORIGIN`, CSP restrittivo
- [ ] Certificato SSL valido (Web NFC richiede HTTPS)
- [ ] Dominio custom con OG tags OK per WhatsApp/IG

---

# 📌 Note finali

**Il progetto è in ottima salute per un MVP.** L'architettura è coerente, il design è distintivo e il valore utente è chiaro. Le correzioni critiche (Fase 1) sono realizzabili in una giornata, dopodiché la base è solida per scalare a diverse migliaia di utenti.

Le priorità assolute prima del lancio pubblico sono:
1. **JWT secret** (blocker sicurezza)
2. **Files auth** (blocker privacy documenti)
3. **Indici MongoDB** (blocker performance a scala)

Il resto può essere iterato progressivamente senza pressione.

---

*Fine report — MOTODNA_TECHNICAL_AUDIT.md*
