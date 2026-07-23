# React access/refresh token auth demo

A self-contained React + Vite app demonstrating the access-token/refresh-token
pattern, with a **mocked backend** (no server needed — everything runs in the
browser). Access tokens expire after **5 minutes**.

## Open in StackBlitz

1. Go to https://stackblitz.com and choose "Create new project" → "Vite" (or
   just "Import from GitHub" if you push this folder to a repo).
2. Copy every file in this folder into the StackBlitz project, keeping the
   same paths (`src/mockApi/...`, `src/auth/...`, `src/api/...`).
3. It installs and runs automatically. Sign in with the pre-filled demo
   credentials (`demo@example.com` / `password123`).

Or run locally:
```
npm install
npm run dev
```

## Pages

- **Dashboard** — 5 widgets fetched in parallel (`Promise.allSettled`), each hitting its
  own mock endpoint (`getWidget('revenue', token)`, `getWidget('users', token)`, etc).
  Every endpoint independently validates the access token it's given. If the token has
  expired, all 5 can fail with 401 in the same instant — but the shared, deduped refresh
  in `authClient.js` means only **one** real refresh call reaches the server; all 5
  requests then retry with the new token. The page shows exactly how many refresh calls
  fired on each load.
- **Report** — a single request through the same `getReport()` endpoint, taking the exact
  same 401 → refresh → retry path, just with one call instead of five.

Switch between them with the tabs at the top of the dashboard shell (no router needed for
just two tabs — plain component state).

## What it demonstrates

- **Access token**: short-lived (5 min), kept only in React state (memory) —
  never written to storage, so it can't be lifted by reading localStorage.
- **Refresh token**: longer-lived, used to silently mint a new access token.
  Rotated on every use — the old refresh token is invalidated the moment a
  new one is issued, and reusing a spent refresh token revokes the whole
  token family (a standard theft-detection technique).
- **Proactive refresh**: a timer refreshes the access token ~15s before it
  expires, so an active session never gets interrupted.
- **Reactive refresh**: `authorizedRequest()` in `src/api/authClient.js`
  wraps any call to the mock API — if a request comes back 401 (expired
  token), it refreshes once and retries automatically. Concurrent 401s
  dedupe into a single refresh call instead of firing one each.
- **Session restore**: a valid refresh token surviving a page reload
  (persisted to `localStorage` in this demo only, see note in
  `AuthContext.jsx`) is used to re-establish a session without a re-login.

## File map

```
src/
  mockApi/
    tokens.js     — encode/decode/expiry helpers for the mock tokens
    server.js     — mock backend: login, refresh (rotating), widgets, report
  api/
    authClient.js — attaches token, retries once after a deduped refresh
  auth/
    AuthContext.jsx — auth state (token, user, log) built on the hooks below
  hooks/
    useSessionRestore.js            — on mount, exchanges a stored refresh
                                       token for a new access token so a
                                       page reload keeps the user logged in
    useRefreshScheduler.js          — arms a timer to silently refresh just
                                       before the access token expires
    useTokenCountdown.js            — live mm:ss to expiry, for the UI
    useProtectedRequest.js          — one protected API call, with
                                       loading/error/data + refetch
    useParallelProtectedRequests.js — N protected API calls in parallel,
                                       all sharing one deduped refresh
  pages/
    DashboardPage.jsx — 5 widgets via useParallelProtectedRequests
    ReportPage.jsx     — 1 request via useProtectedRequest
  App.jsx — login form + shell with tabs, countdown, event log
```

Every API call in the app — both pages, no exceptions — goes through
`callProtected` (via one of the two request hooks above), so nothing ever
fires with an unchecked or stale token.

## Staying logged in across a reload

The access token only ever lives in React state — reload the tab and it's
gone, by design. What survives is the refresh token in `localStorage`.
`useSessionRestore` runs once on mount, finds that stored refresh token, and
exchanges it for a new access token before the login form ever renders — so
a page reload keeps you signed in, the same as it would against a real
backend with an httpOnly refresh cookie.

## Production notes

This demo intentionally simplifies two things that matter in a real app:

- **Refresh tokens belong in an httpOnly, Secure, SameSite cookie** set by
  the server — never in `localStorage` or JS-readable storage, since that's
  directly exposed to XSS. This demo uses `localStorage` only because there
  is no real server to set a cookie.
- **Tokens here are just base64 JSON, not signed JWTs.** A real backend
  issues signed (and often encrypted) tokens and verifies the signature
  server-side on every request.
