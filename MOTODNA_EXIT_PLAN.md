# 🚪 MotoDNA — Exit Emergent Audit Report

**Data:** giugno 2026
**Modalità:** READ-ONLY (nessuna modifica al codice, DB o config)
**Obiettivo:** valutare la portabilità del progetto MotoDNA fuori dalla piattaforma Emergent e produrre un piano di uscita.

> ✅ **Buona notizia in apertura:** MotoDNA **non ha dipendenze SDK / API / servizi proprietari di Emergent**. Il codice è 100% Next.js standard + MongoDB. L'unico legame è **infrastrutturale** (supervisor, preview URL). Uscita fattibile in **< 1 giornata** su Railway o VPS, ~1 giornata su Vercel (richiede migrazione GridFS → S3 opzionale).

---

## 1. 🧱 Stack completo

| Layer | Tecnologia | Versione | Note |
|---|---|---|---|
| **Framework** | Next.js | **15.5.18** | App Router (`app/*/page.js`) |
| **UI** | React | 18.3.1 | Client components ovunque |
| **Language** | JavaScript | — | Nessun TypeScript |
| **Styling** | Tailwind CSS | 3.4.1 | + `tailwindcss-animate` |
| **Design system** | shadcn/ui + Radix | Radix 1.x/2.x | 30+ primitives inclusi |
| **Icons** | lucide-react | 0.516.0 | — |
| **DB** | MongoDB | 6.6.0 (driver) | Local via supervisor (dev) |
| **Object storage** | **MongoDB GridFS** | bucket `uploads` | ⚠️ Vincolo esclusivo Mongo |
| **Auth** | JWT custom (jsonwebtoken 9) | — | Cookie httpOnly `motodna_token` |
| **Password hash** | bcryptjs | 3.0.3 | cost=10 |
| **UUID** | uuid | 11.1.1 | Solo UUID, mai ObjectId visibili |
| **Charts** | recharts | 2.15.3 | Admin dashboard |
| **Toasts** | sonner | 2.0.5 | — |
| **Runtime** | Node.js | 20.20.2 (host) | Nessun `engines` in package.json |
| **Package manager** | yarn | 1.22.22 | `packageManager` fisso |

**Nota architetturale**: API monolitica in `app/api/[[...path]]/route.js` (1019 righe, 37 endpoint discriminati per string-matching di path/method). Non usa file-based routing per gli endpoint singoli — è deliberato per MVP ma fuori scope Emergent è un candidato al refactoring.

---

## 2. 📦 Dipendenze complete

### Production dependencies (57)

**In uso attivo** (10)
- `next`, `react`, `react-dom` — framework
- `mongodb` — DB driver + GridFS
- `bcryptjs`, `jsonwebtoken` — auth
- `uuid` — ID generation
- `lucide-react`, `recharts`, `sonner` — UI

**shadcn/ui backbone (in uso)**
- Radix: `alert-dialog`, `avatar`, `dialog`, `label`, `select`, `slot`, `switch`, `tabs`, `tooltip`, `checkbox`, `dropdown-menu`, `popover`, `radio-group`, `scroll-area`, `separator`, `toast`
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`

**Installati ma NON usati** (18) — candidati a rimozione
- `@tanstack/react-query`, `@tanstack/react-table`
- `axios`, `lodash`, `date-fns`, `dayjs`
- `embla-carousel-react`, `framer-motion`, `input-otp`
- `react-day-picker`, `react-resizable-panels`, `vaul`
- `react-hook-form`, `@hookform/resolvers`, `zod`
- `swr`, `next-themes`, `cmdk`
- Radix `accordion`, `aspect-ratio`, `collapsible`, `context-menu`, `hover-card`, `menubar`, `navigation-menu`, `progress`, `slider`, `toggle`, `toggle-group`

**Risparmio bundle stimato dopo cleanup**: ~150 KB gzip.

### Dev dependencies (5)
- `autoprefixer`, `postcss`, `tailwindcss`
- `@types/lodash`, `globals`

### Resolutions (yarn overrides)
```json
{
  "follow-redirects": "1.16.0",
  "form-data": "4.0.6",
  "**/micromatch/picomatch": "2.3.2",
  "postcss": "8.5.10",
  "yaml": "2.8.3",
  "lodash": "4.18.1"
}
```

---

## 3. 📂 Struttura cartelle

```
/app/
├── app/                                # Next.js App Router
│   ├── api/[[...path]]/route.js        # ⚠️ API monolitica (1019 righe, 37 endpoints)
│   ├── admin/page.js                   # Console admin (auth + is_admin)
│   ├── community/page.js               # Directory utenti
│   ├── dashboard/page.js               # Home privata
│   ├── m/[public_id]/page.js           # Profilo pubblico moto (no auth)
│   ├── messages/
│   │   ├── page.js                     # Inbox
│   │   └── [userId]/page.js            # Chat
│   ├── moto/
│   │   ├── new/page.js                 # Wizard registrazione moto
│   │   └── [id]/page.js                # Gestione moto (owner-only, 8 tab)
│   ├── transfer/[code]/page.js         # Accettazione trasferimento
│   ├── u/[userId]/page.js              # Profilo pubblico utente
│   ├── layout.js                       # Root layout
│   ├── page.js                         # Landing / auth
│   ├── providers.js                    # QueryClient (⚠️ dead code, non wired)
│   └── globals.css                     # Tailwind base
│
├── components/
│   ├── skeletons.jsx                   # Skeleton loaders
│   ├── ImageUploader.jsx               # Upload GridFS con supporto private
│   ├── IconSelect.jsx                  # Dropdown con icone categoria
│   ├── NfcAssociator.jsx               # Web NFC (NDEFReader) — solo Android/HTTPS
│   ├── Logo.jsx                        # SVG café-racer
│   └── ui/                             # shadcn primitives (30+ file)
│
├── lib/
│   ├── auth.js                         # signToken / verifyToken / cookies
│   ├── mongodb.js                      # Client + ensureIndexes lazy
│   ├── initIndexes.js                  # 23 indici idempotenti
│   ├── rateLimit.js                    # ⚠️ In-memory (multi-istanza non safe)
│   ├── publicId.js                     # generatePublicId / TransferCode (CSPRNG)
│   ├── categoryIcons.js                # Mapping icone
│   ├── seedDemo.js                     # Demo bike al registration
│   ├── utils.js                        # cn() helper
│   └── constants/testIds/              # (test IDs, non usati a runtime)
│
├── hooks/
│   └── use-mobile.jsx                  # (di shadcn, non usato attivamente)
│
├── scripts/                            # Manual DB scripts (node)
│   ├── promote_admin.js                # Sostituibile con ADMIN_EMAILS env var
│   ├── cleanup_test_users.js
│   └── list_users.js
│
├── public/                             # (vuoto, no static assets)
├── memory/                             # PRD + test credentials (interno)
├── test_reports/                       # (build artefacts)
├── tests/                              # (vuoto)
│
├── .env                                # 5 env vars + JWT_SECRET
├── next.config.js                      # output: standalone
├── package.json
├── tailwind.config.js
├── components.json                     # shadcn config
├── jsconfig.json                       # path aliases (@/*)
└── MOTODNA_TECHNICAL_AUDIT.md          # Report tecnico precedente
```

---

## 4. 🔐 Variabili environment

### Attualmente in `/app/.env`
| Nome | Valore corrente | Uso reale | Necessaria per prod? |
|---|---|---|---|
| `MONGO_URL` | `mongodb://localhost:27017` | ✅ Usata in `lib/mongodb.js` e `scripts/*.js` | **SÌ** |
| `DB_NAME` | `motodna` | ✅ Usata in `lib/mongodb.js` | **SÌ** |
| `JWT_SECRET` | *(64 char base64)* | ✅ **Boot-fail se manca o < 32 char** | **SÌ (critico)** |
| `NEXT_PUBLIC_BASE_URL` | `https://dna-garage.preview.emergentagent.com` | ❌ **DEAD CODE — mai referenziato nel codice** | NO (rimuovibile) |
| `CORS_ORIGINS` | `*` | ✅ In `next.config.js` header | Opzionale (default `*`) |
| `ADMIN_EMAILS` | `carminellolab@gmail.com` | ✅ Auto-promote admin in route.js | Opzionale |

### Iniettate dal supervisor Emergent (in `[program:nextjs]`)
| Nome | Valore | Uso |
|---|---|---|
| `HOST` | `0.0.0.0` | usata da `next dev` |
| `PORT` | `3000` | usata da `next dev` |
| `APP_URL` | *(pod preview URL)* | ❌ **DEAD — mai referenziato** |
| `INTEGRATION_PROXY_URL` | `https://integrations.emergentagent.com` | ❌ **DEAD — mai referenziato** |

### Env var necessarie in produzione (minime)
```env
MONGO_URL=mongodb+srv://<user>:<pw>@cluster.xxxx.mongodb.net
DB_NAME=motodna
JWT_SECRET=<generato con: openssl rand -base64 48>
# Opzionali:
CORS_ORIGINS=https://motodna.app,https://www.motodna.app
ADMIN_EMAILS=carminellolab@gmail.com
NODE_ENV=production
```

---

## 5. 🗄️ Configurazione MongoDB

### Client
`/app/lib/mongodb.js`
- Singleton `MongoClient(uri)` cachato su `global._mongoClientPromise` (evita reconnect in hot-reload dev).
- Chiamata a `ensureIndexes(db)` lazy — solo al primo `getDb()`, cache in-process.
- Esporta `getDb()` e `clientPromise` default.

### Indici (`/app/lib/initIndexes.js`)
23 indici creati idempotentemente all'avvio:
- `users`: `email` (unique), `id` (unique), `last_seen`, `created_at`
- `motorcycles`: `public_id` (unique), `id` (unique), `owner_id + created_at`
- Sub-collections: compound `motorcycle_id + <date-field>` per maintenance/timeline/modifications/gallery/documents
- `reminders`: `user_id + status`, `motorcycle_id`
- `postits`: `motorcycle_id + created_at`, `ip_hint + created_at`
- `messages`: `from + to + created`, `to + read_at`
- `nfc_tags`: `motorcycle_id + status`, `tag_uid`
- `nfc_scans`: `scanned_at`
- `transfers`: `code` (unique), `motorcycle_id + status`

### Storage GridFS
- Bucket **custom**: `bucketName: 'uploads'` → collezioni `uploads.files` e `uploads.chunks`.
- Metadata per file: `{ uploaded_by: userId, visibility: 'public' | 'private' }`.
- Nessun cleanup TTL automatico (fatto solo su delete cascade).

### Collezioni (13 totali)
```
users, motorcycles, maintenance, timeline, modifications, gallery, documents,
reminders, postits, messages, nfc_tags, nfc_scans, transfers, ownership_history,
uploads.files, uploads.chunks
```

### Locale (attuale)
```
mongodb://localhost:27017/motodna
```
Gestito da supervisor `[program:mongodb]` → **NON scalabile in prod**. Serve Atlas / self-hosted cluster.

---

## 6. 🔑 Configurazione autenticazione JWT

**File:** `/app/lib/auth.js`

### Flusso
1. `hashPassword(pw)` → bcrypt cost 10
2. `signToken({sub, email})` → JWT HS256, TTL **30 giorni**
3. `setAuthCookie(res, token, remember)` →
   ```
   name:     motodna_token
   httpOnly: true
   secure:   true      # sempre — richiede HTTPS anche in dev
   sameSite: lax
   path:     /
   maxAge:   30 giorni (remember=true) | session (remember=false)
   ```
4. `getUserFromRequest()` → legge cookie, verifica, ritorna `{sub, email}` o `null`

### Boot-fail
```js
if (!SECRET || SECRET.length < 32) {
  throw new Error('[MotoDNA/auth] JWT_SECRET is ... Refusing to boot.');
}
```
Nessun fallback: **il processo Node fallisce all'import se `JWT_SECRET` non è configurato**. Ottimo per fail-fast in produzione.

### Rate limit login
`lib/rateLimit.js` — sliding-window in-memory (`Map`), 5 tentativi / 60s per chiave `IP + email`.
⚠️ **Limitazione documentata nel file**: funziona solo single-instance. Multi-pod → serve Redis/Upstash.

### Auto-admin
Se l'email è in `ADMIN_EMAILS` (env), `is_admin=true` viene settato automaticamente in DB al register / login / auth-me.

---

## 7. 🖼️ Configurazione upload immagini

**Endpoint:** `POST /api/uploads`

### Accetta
- `multipart/form-data` con campo `file` + campo opzionale `visibility` ('public' | 'private')
- `application/json` con `{ data: "data:<mime>;base64,...", filename?, visibility? }`

### Vincoli
- **Max 10 MB**
- MIME whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, `application/pdf`
- Nome file sanitizzato (regex `[^a-zA-Z0-9._-]`, max 120 char)

### Storage
- GridFS bucket `uploads` in MongoDB (NON filesystem, NON S3, NON blob storage).
- **Nessuna dipendenza da disco locale**: puoi girare il container su file system read-only.

### Serving
- `GET /api/files/:id[.ext]`
- Public: `Cache-Control: public, max-age=31536000, immutable`
- Private: richiede cookie + `metadata.uploaded_by === auth.sub`; risponde `Cache-Control: private, no-store`

### Streaming
Node `Readable` → Web `ReadableStream` (compatibile Edge, ma **route.js gira su Node runtime** — vedi §11).

---

## 8. 🔌 API endpoints (37 totali, tutti su `/api/[[...path]]/route.js`)

### 🌍 Pubblici (nessuna auth richiesta)
| Method | Path | Descrizione |
|---|---|---|
| POST | `/api/auth/register` | Registrazione |
| POST | `/api/auth/login` | Login (rate-limited) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Ritorna `{user:null}` se non loggato |
| GET | `/api/public/:public_id` | Profilo pubblico moto (rispetta `public_profile:true`) |
| POST | `/api/public/:public_id/postit` | Guestbook (rate-limited 5/min per IP hint) |
| GET | `/api/files/:id` | Serving file (auth solo se `visibility=private`) |
| GET | `/api/transfer/:code` | Preview trasferimento |
| POST | `/api/transfer/:code/accept` | Accetta trasferimento (richiede auth per `to_user_id`) |

### 🔒 Protetti (auth cookie richiesto)
| Method | Path | Descrizione |
|---|---|---|
| PUT | `/api/auth/me` | Aggiorna profilo utente |
| GET | `/api/dashboard` | Dati home |
| POST | `/api/motorcycles` | Crea moto |
| GET | `/api/motorcycles/:id` | Dettaglio + sub-collections |
| PUT | `/api/motorcycles/:id` | Aggiorna moto |
| **DELETE** | `/api/motorcycles/:id` | **Cascade delete + GridFS cleanup** |
| POST | `/api/motorcycles/:id/nfc` | Rigenera NFC |
| POST | `/api/motorcycles/:id/nfc/associate` | Associa tag NFC fisico |
| DELETE | `/api/motorcycles/:id/nfc/associate` | Scollega tag |
| POST | `/api/motorcycles/:id/transfer` | Genera codice trasferimento |
| GET | `/api/motorcycles/:id/transfer` | Codice attivo |
| POST | `/api/motorcycles/:id/:kind` | Aggiungi sub-item (7 kinds) |
| PATCH/PUT | `/api/motorcycles/:id/:kind/:itemId` | Aggiorna |
| DELETE | `/api/motorcycles/:id/:kind/:itemId` | Elimina |
| POST | `/api/uploads` | Upload file GridFS |
| GET | `/api/community/users` | Directory |
| GET | `/api/community/users/:id` | Profilo utente + bike |
| GET | `/api/messages` | Inbox |
| GET | `/api/messages/:userId` | Chat |
| POST | `/api/messages/:userId` | Invia messaggio |
| GET | `/api/messages-unread-count` | Badge counter |
| GET | `/api/reminders/mine` | Reminders utente |

### 👑 Admin only (`is_admin: true`)
| Method | Path | Descrizione |
|---|---|---|
| GET | `/api/admin/stats` | Statistiche + chart data |
| GET | `/api/admin/users` | Lista/search utenti (max 200) |
| DELETE | `/api/admin/users/:id` | Cascade delete + GridFS cleanup |
| POST | `/api/admin/broadcast` | Messaggio a tutti gli utenti |

### Middleware / guardrails
- `getUserFromRequest()` chiamato all'ingresso di ogni request per settare `userId`
- Helper `requireAdmin()` per endpoint admin
- `rateLimit` su `/api/auth/login` + su `/api/public/:public_id/postit`

---

## 9. 🏢 Dipendenze specifiche Emergent

### Nel **codice sorgente**
✅ **Nessuna dipendenza reale**. Verifica esaustiva:

```
grep -rn "emergent" /app/app /app/lib /app/components
```

Solo 2 match, entrambi **cosmetici**:
1. `/app/lib/constants/testIds/home.js:5` → `emergentLink: 'home-emergent-link'` (test-id per link "made with Emergent" mai renderizzato → dead reference)
2. `/app/lib/constants/testIds/auth.js:12` → commento `emergent(kebab-case-testid)` (nomenclatura convenzione, non runtime)

### Nell'**infrastruttura**
- **Supervisor config** (`/etc/supervisor/conf.d/supervisord.conf`) — **READ-ONLY, non modificabile in Emergent**:
  ```
  [program:nextjs]      command = yarn dev       ← ⚠️ DEV MODE, non prod
  [program:mongodb]     command = mongod
  [program:code-server] (IDE web)
  [program:nginx-code-proxy]
  [program:webhook-crond] → /app/.emergent/cron/webhook_crond.sh
  ```
- **Env vars** iniettate senza uso: `APP_URL`, `INTEGRATION_PROXY_URL`, `PASSWORD` (code-server)
- **Dominio preview**: `*.preview.emergentagent.com` con SSL cert Emergent
- **Cartella `/app/.emergent/`** contiene crond scripts della piattaforma (non-progetto)

### Nel `.env`
- `NEXT_PUBLIC_BASE_URL=https://dna-garage.preview.emergentagent.com` → **valore Emergent-branded ma la variabile è dead code** (verificato: 0 riferimenti in `/app`). Rimuovibile.

**Conclusione §9**: Il codice applicativo è **completamente portabile**. L'unico lavoro di uscita è replicare l'infrastruttura (Node + Mongo + reverse proxy).

---

## 10. 🚫 Servizi che impediscono il deploy esterno

**Nessuno**. Dettaglio:

| Servizio | Uso attuale | Blocker uscita? |
|---|---|---|
| Autenticazione | Custom JWT (in-house) | No |
| Database | MongoDB (open source) | No — replica su Atlas / self |
| File storage | GridFS in Mongo | No — viaggia col DB |
| Email | Nessuna | N/A |
| Payments | Nessuna | N/A |
| Analytics | Nessuna | N/A |
| LLM/AI | Nessuna | N/A |
| Push notifications | Nessuna | N/A |
| Emergent SDK | Non installato | ✅ |
| Emergent Auth | Non usato | ✅ |
| Emergent Integrations Proxy | Env presente ma inutilizzata | ✅ |

**Il progetto è auto-contenuto.**

---

## 11. ▲ Blockers deploy su **Vercel**

### 🟢 Compatibili
- Next.js 15 App Router → target primo di Vercel
- `output: 'standalone'` viene **ignorato** su Vercel (usa la sua build) ma non causa problemi
- Client components, generateMetadata (assente ma compatibile)
- Env vars — configurabili nel dashboard
- Nessun uso di `fs` o percorsi assoluti

### 🟡 Attenzione — richiedono modifiche
| Issue | Impatto | Fix |
|---|---|---|
| **GridFS su MongoDB serverless** | Se usi MongoDB Atlas, tutto ok. Ma latenza upload/download da Vercel Function ↔ Atlas può essere >200ms. Timeout upload = timeout function (10s Hobby, 60s Pro, 300s Enterprise) | Usare Atlas nella stessa regione del Vercel Edge; oppure migrare upload a **S3/R2** con presigned URL |
| **Rate limit in-memory** (`lib/rateLimit.js`) | Ogni serverless function ha il suo `Map`. In pratica il limite diventa N×5 tentativi/min | Migrare a **Upstash Redis** — API `isAllowed(key)` invariata |
| **File streaming** (`ReadableStream` in `/api/files`) | Funziona su Node runtime Vercel. Su Edge runtime **potrebbe** avere limiti su binary streaming | Restare su Node runtime (default per `route.js` con `mongodb`) |
| **Auto-admin promozione** (`ensureAdminFlag`) | Fa una write su ogni login se non-admin → OK | Nessun fix |
| **MongoDB connection pooling** | Serverless cold start apre nuova connessione. `global._mongoClientPromise` mitiga ma non elimina | Impostare `maxPoolSize: 10`, considerare Atlas Data API o Prisma Data Proxy per pool centralizzato |

### 🔴 Bloccanti in production
| Issue | Impatto | Fix |
|---|---|---|
| **CSP `frame-ancestors *`** e **`X-Frame-Options: ALLOWALL`** in `next.config.js` | Necessario per iframe preview di Emergent. Su Vercel Production **espone a clickjacking** | Restringere: `X-Frame-Options: SAMEORIGIN`, `CSP: frame-ancestors 'self'` |
| **Nessun `NEXT_PUBLIC_BASE_URL` valido** | Variabile presente ma dead-code — non blocca. Ma per email/OG serviranno base URL correttamente configurati in futuro | Documentare nel `.env.example` |
| **NDEFReader (Web NFC)** | Funziona solo su HTTPS. Vercel HTTPS di default OK. Ma il **dominio preview `*.vercel.app`** funziona; il preview.emergentagent.com scomparirà — assicurarsi di puntare i tag NFC fisici al **nuovo dominio finale** | Comprare motodna.app o simile e configurare dominio custom **prima** di stampare tag NFC |

**Verdetto Vercel:** ✅ Compatibile con 2-3 ore di setup + Atlas + Upstash + dominio.

---

## 12. 🚂 Blockers deploy su **Railway**

### 🟢 Compatibili al 100%
- Container-based → il progetto gira in-container come oggi (`yarn build && yarn start`)
- Persistent MongoDB via Railway plugin o Atlas
- Volumi persistenti non necessari (GridFS in Mongo)
- Env vars gestibili
- Custom domain + SSL automatico

### 🟡 Attenzione minime
| Issue | Impatto | Fix |
|---|---|---|
| **`yarn dev` in supervisor** | Su Railway `yarn build && yarn start` è standard. Basta un `railway.toml` o un `Procfile`/`start` script | Aggiungere `"start": "next start"` (già presente in `package.json`) |
| **HOST/PORT** hardcoded | `next dev --hostname 0.0.0.0 --port 3000` — Railway espone auto | Nessun fix (funziona) |
| **CSP `frame-ancestors *`** | Fuori Emergent è troppo aperto | Restringere in `next.config.js` |
| **MongoDB su Railway plugin** | Storage limitato (5GB piano base). Va bene MVP | Migrazione ad Atlas quando si passa i 5GB |

### 🔴 Nessun blocker vero
Railway è il match più naturale per questo stack container-based.

**Verdetto Railway:** ✅ Deploy in **< 1 ora** con MongoDB plugin. Più semplice di Vercel.

---

## 13. 🖥️ Blockers deploy **self-hosted** (VPS / Docker / Kubernetes)

### 🟢 Compatibili
- `output: 'standalone'` in `next.config.js` → build genera `.next/standalone/server.js` + tutti i moduli necessari → **Docker image minimale ~100MB** (contro ~800MB con node_modules completo)
- MongoDB installabile via apt o Docker
- Nginx/Caddy reverse proxy + Let's Encrypt SSL
- Systemd o PM2 per process management

### 🟡 Attenzione
| Issue | Impatto | Fix |
|---|---|---|
| **HTTPS obbligatorio per Web NFC** | `NDEFReader` funziona solo su HTTPS (o localhost) | Certbot / Caddy automatic HTTPS |
| **Web NFC solo Android Chrome** | Non è un blocker di deploy ma di UX. Documentare per gli utenti iOS | UI fallback (già presente: URL copy) |
| **MongoDB backup** | Nessun backup automatico se self-hosted | Cron con `mongodump` o replica set con oplog |
| **Rotazione log** | Nessuna config. `console.log` va in stdout | logrotate + journald |
| **Rate limit in-memory** | OK single-instance. Multi-container serve Redis | Redis su stessa rete Docker |
| **Node 20 richiesto** (host attuale 20.20.2) | Nessun `engines` in package.json → deploy potrebbe usare Node vecchio | Aggiungere `"engines": { "node": ">=20" }` |

### 🔴 Nessun blocker vero

**Verdetto self-hosted:** ✅ Deploy in **~1 giornata** con VPS €5/mese + Caddy + MongoDB. Consigliato per costi minimi.

---

## 14. 📋 Riepilogo compatibilità piattaforme

| Piattaforma | Sforzo | Costo/mese | Consigliato per |
|---|---|---|---|
| **Railway** | 🟢 1 ora | ~$5-20 | 🥇 MVP + growth iniziale — miglior rapporto sforzo/velocità |
| **Vercel + Atlas + Upstash** | 🟡 1 giorno | ~$65 (con Supabase-alt) o ~$125 | Scale + edge globale; richiede modifiche a rate-limit e possibile migrazione a S3 |
| **Self-hosted (VPS)** | 🟡 1 giorno | ~$5-15 | Costo minimo + controllo totale; richiede DevOps |
| **Docker Swarm / K8s** | 🔴 2-3 giorni | Variabile | Team con esperienza containers; multi-region |

---

# ✅ MotoDNA Exit Plan

Checklist ordinata dei passaggi per uscire completamente da Emergent.

## 🎯 Fase 0 — Preparazione (giornata 0, 1-2 ore)

- [ ] **Backup completo del DB**
  ```bash
  mongodump --uri="mongodb://localhost:27017/motodna" --out=/backup/motodna-$(date +%F)
  tar czf motodna-backup.tar.gz /backup/motodna-*
  # Scaricare il file dal preview via IDE Emergent o scp
  ```
- [ ] **Backup del codice sorgente**
  - Usa "Save to GitHub" dall'interfaccia Emergent (chat input) per un repo dedicato
  - Verifica che `.git/` sia stato pusheato correttamente
- [ ] **Snapshot delle env vars sensibili**
  - Salva `JWT_SECRET` da `/app/.env` in un **secrets manager** (1Password, Bitwarden, Doppler)
  - **NON committare** su GitHub
- [ ] **Documenta gli utenti admin attuali**
  ```bash
  mongosh mongodb://localhost:27017/motodna --eval "db.users.find({is_admin:true},{email:1,_id:0}).toArray()"
  ```

## 🎯 Fase 1 — Scelta piattaforma (giornata 0, 30 min)

**Raccomandazione forte per MotoDNA:** 🥇 **Railway + MongoDB Atlas** — best balance sforzo/costo/scalabilità.

- [ ] Decidere: Vercel · Railway · VPS · Docker/K8s
- [ ] Comprare dominio custom **prima di stampare tag NFC** (i tag saranno immutabili una volta scritti):
  - Suggeriti: `motodna.app`, `motodna.io`, `moto-dna.com`
  - ~€15/anno su Namecheap / Cloudflare Registrar

## 🎯 Fase 2 — MongoDB in produzione (giornata 1, 1-2 ore)

- [ ] Creare cluster **MongoDB Atlas M0** (free) o **M10** ($57/mo dedicated)
  - Regione **vicina** al deploy dell'app
  - Enable IP allowlist o VPC peering
  - Creare utente DB con ruolo `readWrite` su `motodna`
- [ ] **Restore del dump**
  ```bash
  mongorestore --uri="mongodb+srv://user:pw@cluster.xxx.mongodb.net/motodna" \
               /backup/motodna-latest/motodna
  ```
- [ ] Verificare indici post-restore
  ```bash
  mongosh "$MONGO_URL" --eval "db.motorcycles.getIndexes()"
  ```
  (verranno ricreati automaticamente dal primo `getDb()`)
- [ ] Enable **backup automatici** (Atlas: giornalieri gratuiti su M10+)

## 🎯 Fase 3 — Adeguamento codice pre-deploy (giornata 1, 2-3 ore)

**Modifiche minime obbligatorie** (senza cambiare comportamento):

- [ ] **Pulire `.env.example`**:
  ```env
  MONGO_URL=mongodb+srv://...
  DB_NAME=motodna
  JWT_SECRET=<32+ chars>
  ADMIN_EMAILS=admin@example.com
  CORS_ORIGINS=https://motodna.app
  NODE_ENV=production
  ```
- [ ] **Rimuovere env vars dead**:
  - `NEXT_PUBLIC_BASE_URL` (mai referenziata in codice)
- [ ] **Correggere `next.config.js`** (headers troppo permissivi Emergent-only):
  ```js
  // Prima (Emergent):
  { key: "X-Frame-Options", value: "ALLOWALL" },  // invalid HTTP value
  { key: "Content-Security-Policy", value: "frame-ancestors *;" },
  // Dopo (produzione):
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ```
- [ ] **Aggiungere `engines` a `package.json`**:
  ```json
  "engines": { "node": ">=20.0.0" }
  ```
- [ ] **Verifica build production locale**:
  ```bash
  rm -rf .next && yarn build && NODE_ENV=production yarn start
  ```
- [ ] (Opzionale ma raccomandato) Rimuovere dipendenze non usate:
  ```bash
  yarn remove @tanstack/react-query @tanstack/react-table axios lodash dayjs \
              embla-carousel-react framer-motion input-otp react-day-picker \
              react-resizable-panels vaul react-hook-form @hookform/resolvers \
              zod swr next-themes cmdk
  ```
  Risparmio: ~150 KB bundle client.

## 🎯 Fase 4 — Deploy su Railway (raccomandato) — 1 ora

- [ ] Creare account Railway + progetto
- [ ] Connettere il repo GitHub (dallo step Fase 0)
- [ ] Railway rileva Next.js → build command auto: `yarn build`, start: `yarn start`
- [ ] Settare env vars nel dashboard Railway:
  ```
  MONGO_URL   → dal cluster Atlas
  DB_NAME     → motodna
  JWT_SECRET  → openssl rand -base64 48
  ADMIN_EMAILS→ carminellolab@gmail.com
  CORS_ORIGINS→ https://motodna.app
  NODE_ENV    → production
  ```
- [ ] Verificare boot log — deve stampare "Starting..." e **NON** "JWT_SECRET is missing"
- [ ] Testare `/api/auth/me` → `{user:null}`
- [ ] Collegare **dominio custom** (motodna.app) dal dashboard Railway
  - Aggiungere CNAME al DNS del registrar
  - Railway emette SSL Let's Encrypt automaticamente
- [ ] Verificare HTTPS attivo → obbligatorio per Web NFC

### Alternativa: **Vercel**
- [ ] Import repo su Vercel
- [ ] Env vars nel dashboard (idem sopra)
- [ ] Framework preset: **Next.js** (auto-detect)
- [ ] Aggiungere **Upstash Redis** per rate limit distribuito
- [ ] Adattare `lib/rateLimit.js` a Upstash (API sostanzialmente identica)
- [ ] Verificare che `/api/uploads` non timeout (10s Hobby, 60s Pro)

### Alternativa: **VPS self-hosted**
- [ ] Ordinare VPS Ubuntu 22.04 (~€5/mo Hetzner / Contabo)
- [ ] Installare Node 20, yarn, MongoDB (o usa Atlas remoto)
- [ ] Installare **Caddy** (HTTPS automatico)
- [ ] Configurare `systemd` service per l'app
  ```ini
  [Unit]
  Description=MotoDNA
  After=network.target mongod.service
  [Service]
  WorkingDirectory=/opt/motodna
  ExecStart=/usr/bin/yarn start
  EnvironmentFile=/opt/motodna/.env
  Restart=on-failure
  [Install]
  WantedBy=multi-user.target
  ```
- [ ] Deploy via `git pull && yarn install --production && yarn build && systemctl restart motodna`

## 🎯 Fase 5 — Verifica funzionale post-deploy (2 ore)

Test end-to-end sul nuovo dominio:
- [ ] Register + login → auto-admin funziona per `carminellolab@gmail.com`
- [ ] Register + login → utente normale
- [ ] Rate limit login: 6 tentativi errati → 429
- [ ] Upload foto pubblica → GET senza cookie funziona
- [ ] Upload foto privata → GET senza cookie **401**, altro utente **403**, owner 200
- [ ] Crea moto → public_id generato corretto
- [ ] Transfer moto → codice a 8 char
- [ ] Associa tag NFC (mobile Android Chrome + HTTPS)
- [ ] Scansiona NFC → apre profilo pubblico
- [ ] Post-it guestbook + rate limit
- [ ] Community + messaggi
- [ ] Admin: broadcast + user delete + moto delete cascade + GridFS cleanup

## 🎯 Fase 6 — Migrazione dati utenti (se pod Emergent viene spento)

- [ ] **Freeze scritture** sull'istanza Emergent (annuncio agli utenti)
- [ ] **Dump finale**:
  ```bash
  mongodump --uri="mongodb://localhost:27017/motodna" --out=/backup/final
  ```
- [ ] **Restore su Atlas** production
- [ ] **DNS switchover**: puntare motodna.app al nuovo IP/dominio Railway
- [ ] Verificare che **i tag NFC fisici** già distribuiti puntino al dominio finale (se hanno il vecchio `preview.emergentagent.com`, sono **da riscrivere** — verifica il valore del tag prima)
- [ ] **Rotazione JWT_SECRET** in produzione → tutte le sessioni utente si resettano (una tantum)
- [ ] Comunicare agli utenti reset di sessione + nuova URL

## 🎯 Fase 7 — Post-migrazione (settimana 1)

- [ ] Configurare **backup automatici** MongoDB (Atlas OK; self → cron `mongodump` giornaliero)
- [ ] Configurare **monitoring**: Sentry per errori (starter €24/mo)
- [ ] Configurare **uptime check** (UptimeRobot free)
- [ ] Configurare **log aggregation** (Better Stack, Papertrail, o solo journald)
- [ ] Se cresci: **CDN Cloudflare** davanti al dominio (SSL, cache, DDoS)
- [ ] Rimuovere il pod Emergent per fermare la fatturazione

---

## 📊 TL;DR Uscita Emergent

| Elemento | Livello di lock-in | Sforzo di uscita |
|---|---|---|
| **Codice sorgente** | 🟢 Zero | Copiare via GitHub |
| **Database MongoDB** | 🟢 Zero | `mongodump`/`mongorestore` |
| **File GridFS** | 🟢 Zero | Viaggiano con il DB dump |
| **Autenticazione** | 🟢 Zero | Ruota solo `JWT_SECRET` |
| **Config supervisor** | 🟡 Ricrea | 1h su nuovo host |
| **Dominio preview** | 🔴 Perdi | Serve dominio custom PRIMA di stampare tag NFC |
| **Tag NFC fisici** | 🔴 Immutabili una volta scritti | Verificare che puntino a dominio custom, non a `*.preview.emergentagent.com` |

**Sforzo complessivo stimato**:
- ✅ **1 giornata** su Railway o VPS (raccomandato)
- ✅ **1-2 giornate** su Vercel (richiede Upstash + eventuale S3)
- ✅ **2-3 giornate** su Docker/K8s cluster

**Costo fisso extra post-uscita** (rispetto a preview Emergent):
- Dominio: ~€1/mese
- MongoDB Atlas M0: gratis (o M10 $57/mo per production seria)
- Hosting Railway/Vercel: ~€20/mo
- **Totale: ~€22-90/mese** in scenario MVP → identico o inferiore alle stime del report cost precedente.

---

*Fine report — nessuna modifica è stata effettuata al codice, al database o alla configurazione.*
