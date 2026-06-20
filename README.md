# Memona's Workspace

A premium to-do, file/link/note vault, and encrypted password manager — built to install on PC (web) and mobile (iOS/Android via Expo).

## What's in this project

```
memonas-workspace/
  backend/        Node.js + Express + PostgreSQL API
  app/            React Native (Expo) app — same codebase ships to iOS, Android, and web
```

## Status: tested and working

The backend runs on **PostgreSQL** (matches your AMC system) and has a full automated test
suite (`backend/test/e2e.test.js`) covering every endpoint — signup/login, task CRUD + filters,
file/link/note vault + search + download, encrypted password vault (create/list/update/delete
with real AES-256-GCM encrypt-decrypt round trips against a live Postgres database), recycle bin
restore/permanent-delete, and backup export. **All 39 tests pass against real PostgreSQL.**

The mobile app screens are written and syntax-verified, and follow the exact API contract the
backend tests confirm works. I could not run a live iOS/Android simulator inside this chat
environment, so the screens have **not** been visually tested on a real device yet — that's the
next step: `npx expo start` and scan the QR code with the Expo Go app on your phone.

## Deploying the backend to Railway

1. Push this `backend/` folder to a GitHub repo (or push the whole `memonas-workspace` repo —
   Railway lets you pick the subfolder as the service root).
2. On [railway.app](https://railway.app), create a **New Project → Deploy from GitHub repo**.
3. In the same project, click **+ New → Database → PostgreSQL**. Railway creates it and
   automatically injects a `DATABASE_URL` variable into your backend service — you don't need to
   copy/paste anything.
4. Open your backend service → **Variables** tab → add:
   - `JWT_SECRET` = any long random string (e.g. generate one at `openssl rand -hex 32`)
   - `NODE_ENV` = `production`
5. Click **Deploy**. Railway will run `npm install` then `node src/server.js` automatically
   (configured in `railway.json`).
6. Once deployed, Railway gives you a public URL like `https://your-app.up.railway.app`. Test it
   by visiting `https://your-app.up.railway.app/health` — you should see
   `{"ok":true,"name":"Memonas Workspace API"}`.
7. Point the app at it: when starting Expo, run
   `EXPO_PUBLIC_API_URL=https://your-app.up.railway.app npx expo start`

### Important: file uploads need persistent storage on Railway

Railway's filesystem resets on every redeploy, so uploaded PDFs/videos saved to local disk will
be lost eventually. Two options:
- **Quick fix**: add a Railway **Volume** mounted at `/app/uploads` and set `UPLOAD_DIR=/app/uploads`
- **Better long-term fix**: switch file storage to Cloudinary (same as your AMC system already
  does) — I can wire this up next if you want it before going live.

## Running the backend locally

```bash
cd backend
cp .env.example .env     # edit DATABASE_URL to point at your local Postgres
npm install
npm start                 # runs on http://localhost:4000
npm test                  # runs the full automated test suite
```

## Running the app

```bash
cd app
npm install
npx expo start
```

Scan the QR code with **Expo Go** (free app on Play Store / App Store) to see it live on your phone
immediately — no build step needed for testing.

## Publishing to the App Store / Play Store

This requires accounts only you can create (I cannot do this step for you):
1. Apple Developer Program ($99/year) — for iOS
2. Google Play Console ($25 one-time) — for Android
3. Run `npx eas build` (Expo's build service) to produce the installable binaries
4. Submit via `npx eas submit`

I can walk you through each of these steps when you're ready.

## What still needs finishing before this is store-ready

- **Google Drive backup**: the backend endpoint is built and tested, but the app-side Google
  Sign-In button is a placeholder — it needs a real OAuth Client ID from your Google Cloud
  Console (free to create, takes 5 minutes, I'll guide you).
- **File storage on Railway**: see the note above — needs a Volume or Cloudinary before relying
  on it for real files.
- **Push notification scheduling**: wired up for due-date reminders; needs testing on a real
  device since simulators don't always fire local notifications reliably.

## Security notes

- Passwords are encrypted with AES-256-GCM. The encryption key is derived from your master
  password using PBKDF2 (210,000 iterations) — your master password itself is never stored,
  only a verifier hash, so even database access alone can't decrypt your vault.
- Regular account password uses bcrypt with salt.
- Files are stored outside the web root and only ever served to the authenticated owner.

