# Mining Ledger — Frontend

React + Vite frontend for the Mining ledger. Talks to the Express backend.

## Backend

Production API (hardcoded fallback in `src/lib/api.js`):

```
https://mining-backend-69lu.onrender.com/api
```

Local dev override via `.env`:

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

Production builds use `.env.production`:

```env
VITE_API_BASE_URL=https://mining-backend-69lu.onrender.com/api
```

On Vercel, also set `VITE_API_BASE_URL=https://mining-backend-69lu.onrender.com/api`
in Project → Settings → Environment Variables.

## Auth

- `/login` — sign in with email + password
- `/register` — create account (name, email, min 6-char password)
- All app routes are protected; unauthenticated visits redirect to `/login`.
- Token is stored in `localStorage` and sent as `Authorization: Bearer <token>`.
- Backend endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.

## Dev

```bash
npm install
npm run dev
npm run build
```
