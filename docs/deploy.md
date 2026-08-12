# Production deployment

Three pieces: the Oracle VM (API + worker + Postgres + Redis), Firebase
Hosting (the React SPA), and a Cloudflare Worker that terminates TLS and
forwards `CF-Connecting-IP`.

Reserved origin: `http://158.101.254.173:8000`. Stay on port **8000**
until a Worker hop has been smoke-tested against a live origin
(health, multipart POST, OPTIONS). Changing the port after DNS and
Worker config land is painful.

## 1. Oracle VM

Copy `.env` to the VM over SSH. Do not commit it. On the VM:

1. Generate a **new** Postgres password (do not reuse local `postgres`):

   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(24))"
   ```

2. Set at least:

   ```
   POSTGRES_PASSWORD=<generated>
   APP_ENV=production
   APP_DEBUG=false
   AUTH_ENABLED=true
   TRUST_PROXY_HEADER=true
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=...
   SECRET_KEY=<long random>
   FIREBASE_PROJECT_ID=...
   FIREBASE_CREDENTIALS_JSON=...
   ALLOWED_ORIGINS=https://<your-firebase-host>,https://<your-firebase-host>.firebaseapp.com
   LANGFUSE_ENABLED=true
   LANGFUSE_SECRET_KEY=...
   LANGFUSE_PUBLIC_KEY=...
   # LANGFUSE_HOST empty → https://cloud.langfuse.com in production
   DISCORD_WEBHOOK_URL=...
   ```

3. Open **TCP 8000** on the VNIC security list (Cloudflare must reach
   the raw IP). Do **not** open 5432 or 6379.

4. Bring the stack up from the repo root:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env up -d --build
   python -m app.db.setup_db --reset   # first boot only; run inside the app container
   python -m app.db.seed --with-embeddings
   ```

   First-boot example:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env exec app python -m app.db.setup_db --reset
   docker compose -f docker-compose.prod.yml --env-file .env exec app python -m app.db.seed --with-embeddings
   ```

5. Install [deploy/crontab](../deploy/crontab): a 5-minute `/health` ping
   (Oracle idle reclamation) and nightly `python -m app.tasks.cleanup`.

The **worker** service (`python -m app.worker`) is required. Without it,
uploads sit in Redis forever.

## 2. Cloudflare Worker

Source: [cloudflare/](../cloudflare/). Deploy with Wrangler:

```bash
cd cloudflare
npx wrangler deploy
```

`ORIGIN` defaults to `http://158.101.254.173:8000`. Attach a custom
hostname (e.g. `api.example.com`) to the Worker. The SPA's
`VITE_API_URL` must be that HTTPS hostname, not the raw IP.

The Worker:

- streams the request body so multipart invoice uploads survive the hop
- forwards `OPTIONS` so FastAPI CORS can answer preflight
- copies `CF-Connecting-IP` onto the origin request (`TRUST_PROXY_HEADER=true`)

### Smoke-test (run once the VM is listening)

```bash
# Direct origin
curl -sS -m 10 http://158.101.254.173:8000/health

# Through the Worker (replace with your Worker URL)
curl -sS -m 10 https://api.example.com/health

# Preflight
curl -sS -m 10 -D - -o NUL -X OPTIONS https://api.example.com/api/invoices \
  -H "Origin: https://YOUR.web.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"

# Multipart (expect 401/422 from the API, not a 1042/524 from the Worker)
curl -sS -m 30 -F "file=@frontend/public/samples/vendors-template.csv" \
  https://api.example.com/api/vendors/import
```

A timeout on the raw IP means the security list or the compose stack is
not up yet — do not switch to 8080 to "fix" that.

## 3. Firebase Hosting

`.firebaserc` ships a placeholder project id. Replace it with the real
Firebase project, then build the SPA with **build-time** Vite vars
(they are compiled in; runtime `.env` on the VM does not affect the
frontend):

```bash
cd frontend
# PowerShell
$env:VITE_API_URL="https://api.example.com"
$env:VITE_AUTH_ENABLED="true"
$env:VITE_FIREBASE_API_KEY="..."
$env:VITE_FIREBASE_AUTH_DOMAIN="....firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID="..."
$env:VITE_FIREBASE_APP_ID="..."
npm ci
npm run build
cd ..
firebase deploy --only hosting
```

`firebase.json` serves `frontend/dist` as an SPA (all paths rewrite to
`index.html`).
