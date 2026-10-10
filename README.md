# Split Daily

Shared-expense app: Expo (iOS / Android / web) + a standalone Node API server (Express + tRPC + Postgres).
Sign-in is Google only.

**What the app does**
- Groups with members: add people by email (they join automatically when they sign in with that Google email), from your other groups, or with a shareable invite code / link (`ledgerly://join/CODE`). Owners/admins can remove members; anyone can leave once settled up.
- Expenses in 38 currencies, split equally, by exact amounts, percentages or shares, with any member as the payer. Only the person who added an expense can edit or delete it; everyone involved is notified of changes.
- Balances per currency (nothing is silently converted): overall, per person and per group, with "who owes whom" suggestions and one-tap Settle up.
- Settings: display name, default currency, light/dark/system theme, notification preferences, and account deletion.
 There is no Manus dependency anywhere.

```
splitwise/
├─ app/, components/, hooks/, lib/, constants/   Expo app
├─ shared/                                       Code used by both (validation schemas, split engine)
└─ server/                                       API server — its own package.json, deploy on any Node 20+ host
   ├─ src/index.ts, app.ts   entry point + Express wiring
   ├─ src/config/            environment settings
   ├─ src/database/          Postgres connection + migrations runner
   ├─ src/models/            tables, one file per area (user, group, expense, settlement…)
   ├─ src/views/             what responses look like (public user JSON, HTML error page)
   ├─ src/controllers/       request handlers per area (auth, groups, expenses, …)
   ├─ src/routes/            URL → controller mapping (/api/auth REST, /api/trpc app API)
   ├─ src/middleware/        CORS, auth (tRPC context / protected procedures)
   ├─ src/services/          business logic (balances, splits, invites, Google sign-in)
   ├─ src/utils/             small helpers (redirect allow-list, OAuth cookie)
   ├─ scripts/build-cpanel.mjs  builds server/deploy-cpanel/ for cPanel hosting
   └─ drizzle/            SQL migrations
```

## 1. Google Cloud Console (one time)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**: set app name, support email, add scopes `openid`, `email`, `profile`. While in "Testing", add your Google account under *Test users*.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs** add (exactly, no trailing slash):
   - `http://localhost:3000/api/auth/google/callback` (local)
   - `https://YOUR-API-DOMAIN/api/auth/google/callback` (production)
   No "Authorized JavaScript origins" are needed — the exchange happens on the server.
4. Put the client ID and secret in `server/.env`.

The server prints the exact redirect URI it uses on startup.

## 2. Run locally

```bash
# once
node scripts/remove-legacy-files.mjs   # deletes the old Manus files (safe to re-run)
npm install
npm --prefix server install

# every time — starts the API on :3000 and Expo web on :8081
npm run dev
```

`server/.env` holds the server config (copy from `server/.env.example`). With `RUN_MIGRATIONS=true` the server creates/updates the database tables on start; or run `npm run db:migrate`.

Open http://localhost:8081 → **Continue with Google**.

### Phones: in-app Google sign-in (no browser)

On iOS/Android the app uses Google's **native** sign-in sheet (`@react-native-google-signin/google-signin`).
The app gets a Google ID token, sends it to `POST /api/auth/google/native`, and the server verifies it.
There's no browser and no redirect, so nothing ever points at `localhost:3000`.

**Google Cloud Console → Credentials** (same project as the Web client):

| Client | Type | Settings |
|---|---|---|
| Web (already exists) | Web application | its ID goes in `GOOGLE_CLIENT_ID` **and** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| Android | Android | package `com.amir.splitdaily` + SHA-1 of the signing key (one client per key: debug, EAS/upload, Play App Signing) |
| iOS | iOS | bundle id `com.amir.splitdaily`; its ID goes in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (root `.env`) and `GOOGLE_IOS_CLIENT_ID` (`server/.env`) |

SHA-1 of the local debug key: `cd android && ./gradlew signingReport` (after `npx expo prebuild`), or `eas credentials` for EAS builds.

Root `.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000    # your PC's LAN IP in dev, https://api.example.com in prod
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=yyyy.apps.googleusercontent.com
```

The native sign-in code isn't in Expo Go, so use a **development build**:

```bash
npx expo run:android          # or: eas build --profile development --platform android
npx expo run:ios              # macOS only
```

In Expo Go the app falls back to the browser flow. That flow only works if `API_PUBLIC_URL` is a public `https://` URL, because Google won't redirect a phone to `http://localhost:3000`.

## 3. Deploy the API server (any Node 20+ host)

The server needs the `server/` and `shared/` folders (deploy the whole repo).

```bash
cd server
npm ci
npm run build          # → dist/index.js
npm start              # node dist/index.js
```

Production environment variables (see `server/.env.example` for all of them):

| Variable | Example |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | provided by host, default `3000` |
| `DATABASE_URL` | Neon / any Postgres URL |
| `JWT_SECRET` | 48+ random chars: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `API_PUBLIC_URL` | `https://api.example.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 1 |
| `WEB_APP_ORIGINS` | `https://app.example.com` |
| `TRUST_PROXY` | `true` on Render / Railway / Heroku / behind Nginx |
| `RUN_MIGRATIONS` | `true` (or run `npm run db:migrate` during deploy) |

Typical setups:
- **Render / Railway**: root directory `server`, build `npm ci && npm run build`, start `npm start`.
- **VPS**: `npm ci && npm run build`, then `pm2 start dist/index.js --name ledgerly-api` behind Nginx with HTTPS.

Health check: `GET /api/health`.

### Web app hosting

```bash
npm run build:web      # → dist-web/
```

Either upload `dist-web/` to any static host (with "rewrite all routes to index.html") and set `EXPO_PUBLIC_API_BASE_URL` before building, **or** let the API serve it: set `WEB_DIST_DIR=../dist-web` and the whole thing runs from one Node process on one domain.

## How sign-in works

1. App opens `GET /api/auth/google/start?returnTo=<app callback>` (web: full-page redirect; iOS/Android: secure auth browser session).
2. The server stores state + PKCE verifier + nonce in a short-lived httpOnly cookie and redirects to Google.
3. Google redirects to `/api/auth/google/callback`. The server checks state, exchanges the code (with PKCE + client secret), verifies the ID token signature/audience/nonce, then finds or creates the user (linked by Google account ID, or by verified email).
4. A server-side session is created and the browser is sent back to `returnTo?ticket=…` (a 2-minute single-purpose token).
5. The app posts the ticket to `/api/auth/exchange` and receives a session token, stored in SecureStore (native) or localStorage (web) and sent as `Authorization: Bearer`.
6. **Sign out** revokes the session row, so the token stops working immediately.

**iOS/Android builds** skip steps 1–5: Google's native sheet returns an ID token, the app posts it to `/api/auth/google/native`, and the server checks the signature, issuer, expiry and that the audience is one of your client IDs before returning a session token. Signing out also clears the Google account on the device, so the account picker appears next time.

`returnTo` must be one of `WEB_APP_ORIGINS`, an `APP_SCHEMES` deep link, or (dev only) Expo Go.

## Checks

```bash
npm run check        # TypeScript: app + server
npm test             # server tests; set TEST_DATABASE_URL to also run the full sign-in flow against Postgres
```

## Colors

All tokens live in `theme.config.js`, are exposed as Tailwind classes (`bg-primary`, `text-on-primary`, `bg-hero`, …) and through `useColors()`. Every text/background pair meets WCAG AA in light and dark mode. Use `text-on-primary` on lime surfaces, never `text-foreground`.
