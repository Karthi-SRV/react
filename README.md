
# React access/refresh token auth demo

A self-contained React + Vite app demonstrating the access-token/refresh-token
pattern, with a **mocked backend** (no server needed — everything runs in the
browser). Access tokens expire after **5 minutes**.

run locally:
```
npm install
npm run dev
```

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
    server.js     — mock backend: login, refresh (rotating), getProfile
  api/
    authClient.js — attaches token, retries once after a deduped refresh
  auth/
    AuthContext.jsx — React context: state, timers, login/logout
  App.jsx          — login form + dashboard UI
```

## Production notes

This demo intentionally simplifies two things that matter in a real app:

- **Refresh tokens belong in an httpOnly, Secure, SameSite cookie** set by
  the server — never in `localStorage` or JS-readable storage, since that's
  directly exposed to XSS. This demo uses `localStorage` only because there
  is no real server to set a cookie.
- **Tokens here are just base64 JSON, not signed JWTs.** A real backend
  issues signed (and often encrypted) tokens and verifies the signature
  server-side on every request.

