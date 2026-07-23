// Lightweight stand-in for a signed JWT so the whole demo can run in the
// browser with no real backend. It is NOT cryptographically signed — do not
// model production token handling on this file, only the *flow* around it.

export function encodeToken(payload) {
  return btoa(JSON.stringify(payload));
}

export function decodeToken(token) {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

export function isExpired(token) {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp;
}

export function msUntilExpiry(token) {
  const payload = decodeToken(token);
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp - Date.now());
}
