# Portfolio API - Cloudflare Worker

Backend API voor de portfolio website, gebouwd met Cloudflare Workers en R2 Storage.

## Setup

### 1. Installeer dependencies

```bash
cd worker
npm install
```

### 2. Maak een R2 bucket aan

1. Ga naar [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigeer naar R2
3. Maak een bucket genaamd `portfolio-media`

### 3. Genereer je wachtwoord hash

```bash
# Kies een sterk admin wachtwoord en genereer de hash
node scripts/hash-password.js JouwSterkeWachtwoord123!
```

Noteer de gegenereerde hash en je gekozen JWT_SECRET.

### 4. Stel secrets in

```bash
# Stel de wachtwoord hash in
wrangler secret put ADMIN_PASSWORD_HASH
# Plak de hash wanneer gevraagd

# Stel de JWT secret in
wrangler secret put JWT_SECRET
# Voer een willekeurige string in (minstens 32 karakters)
```

### 5. Lokaal testen

```bash
npm run dev
```

De API draait nu op `http://localhost:8787`

### 6. Deployen

```bash
npm run deploy
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login met wachtwoord
- `GET /api/auth/verify` - Verifieer token
- `POST /api/auth/logout` - Logout

### Portfolio
- `GET /api/portfolio` - Alle portfolio items (publiek)
- `GET /api/portfolio/:id` - Enkel item (publiek)
- `POST /api/portfolio` - Nieuw item (auth vereist)
- `PUT /api/portfolio/:id` - Update item (auth vereist)
- `DELETE /api/portfolio/:id` - Verwijder item (auth vereist)

### File Upload
- `POST /api/upload` - Upload bestand naar R2 (auth vereist)
- `DELETE /api/upload/:key` - Verwijder bestand (auth vereist)
- `GET /api/media/:key` - Serveer bestand (publiek)

### Health Check
- `GET /api/health` - API status

## Environment Variables

### Secrets (via `wrangler secret put`)
- `ADMIN_PASSWORD_HASH` - SHA-256 hash van het admin wachtwoord
- `JWT_SECRET` - Geheime sleutel voor JWT tokens

### Variables (in wrangler.toml)
- `CORS_ORIGIN` - Toegestane origin voor CORS

## Beveiliging

- Wachtwoorden worden gehashed met SHA-256 + salt
- JWT tokens verlopen na 24 uur
- CORS is beperkt tot gespecificeerde origins
- File uploads worden gevalideerd op type en grootte
