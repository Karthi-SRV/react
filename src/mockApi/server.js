import { encodeToken, decodeToken, isExpired } from './tokens';

// ----- "database" -------------------------------------------------------

const USERS = [
  { id: 1, email: 'demo@example.com', password: 'password123', name: 'Demo User' },
];

// refreshToken -> { userId, familyId, usedAt }
// familyId lets us revoke every descendant token if a reused (stolen) token
// is ever presented — a standard refresh-rotation defense.
const refreshStore = new Map();

const ACCESS_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes, as requested
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const networkJitter = () => 300 + Math.random() * 400;

function issueTokenPair(userId, familyId = crypto.randomUUID()) {
  const accessToken = encodeToken({
    sub: userId,
    type: 'access',
    iat: Date.now(),
    exp: Date.now() + ACCESS_TOKEN_TTL_MS,
  });

  const refreshToken = encodeToken({
    sub: userId,
    type: 'refresh',
    familyId,
    iat: Date.now(),
    exp: Date.now() + REFRESH_TOKEN_TTL_MS,
  });

  refreshStore.set(refreshToken, { userId, familyId, usedAt: null });
  return { accessToken, refreshToken };
}

function revokeFamily(familyId) {
  for (const [token, record] of refreshStore.entries()) {
    if (record.familyId === familyId) refreshStore.delete(token);
  }
}

// ----- "endpoints" --------------------------------------------------------

export async function login(email, password) {
  await delay(networkJitter());

  const user = USERS.find((u) => u.email === email && u.password === password);
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const { accessToken, refreshToken } = issueTokenPair(user.id);
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function refresh(refreshToken) {
  await delay(networkJitter());

  const record = refreshStore.get(refreshToken);

  if (!record) {
    // Token not found — either it never existed, or (more interestingly)
    // it was already rotated away. Since we deleted used tokens below,
    // reaching here with a token that decodes fine is a reuse signal.
    const payload = decodeToken(refreshToken);
    if (payload?.familyId) revokeFamily(payload.familyId); // kill the whole chain
    const err = new Error('Refresh token invalid or already used');
    err.status = 401;
    throw err;
  }

  if (isExpired(refreshToken)) {
    refreshStore.delete(refreshToken);
    const err = new Error('Refresh token expired');
    err.status = 401;
    throw err;
  }

  // Rotate: this refresh token is now spent, a new pair takes its place.
  refreshStore.delete(refreshToken);
  const { accessToken, refreshToken: newRefreshToken } = issueTokenPair(
    record.userId,
    record.familyId
  );

  const user = USERS.find((u) => u.id === record.userId);
  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function logout(refreshToken) {
  await delay(150);
  const record = refreshStore.get(refreshToken);
  if (record) revokeFamily(record.familyId);
}

// A protected resource that only responds to a valid, unexpired access token.
export async function getProfile(accessToken) {
  await delay(networkJitter());

  const payload = decodeToken(accessToken);
  if (!payload || payload.type !== 'access' || isExpired(accessToken)) {
    const err = new Error('Access token invalid or expired');
    err.status = 401;
    throw err;
  }

  const user = USERS.find((u) => u.id === payload.sub);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    serverTime: new Date().toISOString(),
  };
}
