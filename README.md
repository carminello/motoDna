# 🏁 MotoDNA

**Il passaporto digitale della tua moto.**

MotoDNA lega una motocicletta fisica a un'identità digitale tramite un piccolo tag NFC personalizzato (es. `MDNA-84-VF4-7A92K`). Scansionando il tag si apre un profilo pubblico "café-racer" con la storia completa della moto: manutenzione, timeline eventi, modifiche, foto, documenti privati e post-it della community — tutto senza scaricare un'app.

---

## ✨ Feature principali

- 🔐 **Registrazione e login** con JWT httpOnly cookie e password bcrypt
- 🏍️ **Gestione moto**: manutenzione, timeline, modifiche, galleria, documenti privati, reminders
- 📱 **Web NFC**: associa un tag NFC fisico alla moto in <30 secondi (Android Chrome + HTTPS)
- 🌐 **Profilo pubblico** (`/m/<public_id>`) con hero, stats, tabs e guestbook a post-it
- 🔁 **Trasferimento proprietà** tramite codice a 8 caratteri con scadenza
- 👥 **Community**: directory utenti + messaggistica 1:1
- 📊 **Console admin**: statistiche, broadcast, gestione utenti
- 🖼️ **Storage integrato**: upload immagini e documenti su MongoDB GridFS (public / private con ownership check)
- 🇮🇹 **Interfaccia in italiano**, design café-racer dark

---

## 🧱 Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 18 + Tailwind CSS + shadcn/ui + lucide-react |
| Database | MongoDB 6.x |
| Storage file | MongoDB GridFS (bucket `uploads`) |
| Auth | JWT custom (`jsonwebtoken`) + bcrypt |
| Charts | Recharts |
| Runtime | Node.js 20+ |
| Package manager | Yarn 1.22.22 |

---

## 📋 Requisiti

- **Node.js ≥ 20.0.0**
- **Yarn 1.22.x**
- **MongoDB ≥ 6.0** (locale, Atlas o compatibile)
- Un browser moderno per l'app; **Android Chrome** per la scrittura/lettura NFC
- **HTTPS obbligatorio in produzione** (Web NFC + cookie `secure: true`)

---

## 🚀 Installazione

```bash
git clone https://github.com/<your-org>/motodna.git
cd motodna
yarn install
```

## 🔧 Configurazione environment

Copia il template ed edita i valori:

```bash
cp .env.example .env
```

Genera un `JWT_SECRET` crittograficamente sicuro:

```bash
openssl rand -base64 48
```

Contenuto minimo di `.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=motodna
JWT_SECRET=<value from openssl>
```

Variabili opzionali disponibili in `.env.example`:
- `ADMIN_EMAILS` — email auto-promosse a admin (comma-separated)
- `CORS_ORIGINS` — origini CORS (default `*`)
- `NODE_ENV` — `production` per il boot ottimizzato

> ⚠️ Il processo Node fallisce all'avvio se `JWT_SECRET` è assente o inferiore a 32 caratteri. È una safety intenzionale.

---

## 💻 Avvio locale (development)

Assicurati che MongoDB sia in ascolto sulla `MONGO_URL` configurata, poi:

```bash
yarn dev
```

L'app è disponibile su [http://localhost:3000](http://localhost:3000).

- Hot reload attivo
- Il primo `getDb()` crea automaticamente 23 indici MongoDB (idempotente)
- La registrazione crea una **moto demo** con foto, tagliandi, timeline (via `lib/seedDemo.js`)

---

## 🏗️ Build produzione

```bash
yarn build
yarn start
```

`yarn build` esegue `next build` producendo `.next/standalone/` grazie a `output: 'standalone'` in `next.config.js` — utile per Docker minimal image.

Esempio di avvio production con env:

```bash
NODE_ENV=production \
MONGO_URL=mongodb+srv://user:pw@cluster.xxx.mongodb.net \
DB_NAME=motodna \
JWT_SECRET=$(openssl rand -base64 48) \
yarn start
```

Ascolta di default su `0.0.0.0:3000`. Sovrascrivi con `PORT=8080 HOST=127.0.0.1 yarn start`.

---

## 🚀 Deploy

### Railway (consigliato)

1. Fai il fork del repo su GitHub e connettilo a Railway.
2. Railway rileva Next.js e usa `yarn build` / `yarn start` automaticamente.
3. Aggiungi le env vars nel dashboard (`MONGO_URL` da un plugin MongoDB o Atlas).
4. Collega un dominio custom → SSL Let's Encrypt automatico.

### Vercel

1. Import repo su Vercel (Framework preset: Next.js).
2. Env vars nel dashboard.
3. Per rate limit distribuito raccomandato **Upstash Redis** (l'attuale `lib/rateLimit.js` è in-memory e va sostituito o mantenuto per traffico basso).
4. **MongoDB Atlas** nella stessa regione del deploy per minimizzare la latenza upload GridFS.

### Docker / VPS self-hosted

Esempio `Dockerfile` (basato su standalone build):

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Reverse proxy suggerito: **Caddy** (HTTPS automatico) o Nginx + certbot.

> ℹ️ Web NFC (NDEFReader) richiede **HTTPS** anche in staging.

---

## 🗂️ Struttura del progetto

```
app/
├── api/[[...path]]/route.js   # API monolitica (auth, CRUD, upload, admin)
├── admin/                     # Console admin (auth + is_admin)
├── community/                 # Directory utenti
├── dashboard/                 # Home privata
├── m/[public_id]/             # Profilo pubblico moto
├── messages/                  # Inbox + chat 1:1
├── moto/[id]/                 # Gestione moto (owner-only)
├── transfer/[code]/           # Accettazione trasferimento
├── u/[userId]/                # Profilo pubblico utente
├── layout.js
└── page.js                    # Landing + auth
components/                    # ImageUploader, NfcAssociator, skeletons, ui/*
lib/                           # auth, mongodb, initIndexes, rateLimit, publicId, ...
public/                        # Static assets
```

---

## 🔐 Note di sicurezza

- **JWT**: cookie `motodna_token`, `httpOnly`, `secure: true`, `sameSite: lax`, TTL 30 giorni.
- **Rate limiting**: 5 tentativi/60s su `/api/auth/login` per chiave `IP + email`. Implementazione in-memory — richiede Redis in multi-istanza.
- **File privati**: `metadata.visibility === 'private'` sul GridFS + ownership check (`uploaded_by === auth.sub`).
- **Password**: bcrypt cost 10.
- **Random**: tutti i token e codici usano `crypto.randomInt` (CSPRNG), mai `Math.random`.
- **CORS**: valore da `CORS_ORIGINS` (default `*`, da restringere in produzione).

---

## 🧑‍💻 Script utili

- `yarn dev` — avvia in modalità sviluppo con hot reload
- `yarn build` — build production ottimizzato
- `yarn start` — avvia il server production

Script Node manuali in `/scripts` (usa `node scripts/<name>.js`):
- `list_users.js` — dump utenti registrati
- `promote_admin.js <email>` — promuove manualmente un utente ad admin

> ℹ️ In alternativa, l'auto-promozione via env `ADMIN_EMAILS` è preferibile per evitare accessi diretti al DB in produzione.

---

## 🌍 Localizzazione

L'interfaccia è in **italiano**. I messaggi di errore delle API sono già localizzati. Per aggiungere altre lingue si può integrare `next-intl` (non ancora incluso).

---

## 📄 Licenza

Da definire (`MIT` / `AGPL` / proprietaria). Il file `LICENSE` non è ancora incluso — aggiungerlo prima della pubblicazione.

---

## 🙋 Supporto

Per bug, feature request o contributi, aprire una issue nel repository GitHub.
