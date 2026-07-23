import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as server from '../mockApi/server';
import { msUntilExpiry } from '../mockApi/tokens';
import { authorizedRequest } from '../api/authClient';

const AuthContext = createContext(null);

// NOTE on storage choice for this demo:
// - accessToken lives only in React state (memory) — never persisted. If the
//   tab is closed, it's gone, which is what you want for a short-lived token.
// - refreshToken is persisted to localStorage purely so a page refresh
//   doesn't log you out in this sandbox. In a real app the refresh token
//   should live in an httpOnly, Secure, SameSite cookie set by the server,
//   so client-side JS (and any XSS payload) can never read it at all.
const REFRESH_STORAGE_KEY = 'demo_refresh_token';

// Refresh a little before actual expiry so an in-flight request never races
// against the clock.
const REFRESH_SKEW_MS = 15_000;

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | authenticated | error
  const [log, setLog] = useState([]);
  const refreshTimerRef = useRef(null);

  const addLog = useCallback((message) => {
    setLog((prev) => [{ time: new Date().toLocaleTimeString(), message }, ...prev].slice(0, 12));
  }, []);

  const getRefreshToken = () => localStorage.getItem(REFRESH_STORAGE_KEY);

  const clearSession = useCallback((reason) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    setAccessToken(null);
    setUser(null);
    setStatus('idle');
    if (reason) addLog(reason);
  }, [addLog]);

  const applyTokens = useCallback((tokens, nextUser) => {
    setAccessToken(tokens.accessToken);
    localStorage.setItem(REFRESH_STORAGE_KEY, tokens.refreshToken);
    if (nextUser) setUser(nextUser);
    scheduleRefresh(tokens.accessToken);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleRefresh = useCallback((token) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(0, msUntilExpiry(token) - REFRESH_SKEW_MS);
    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, delay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const silentRefresh = useCallback(async () => {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) return;
    try {
      const tokens = await server.refresh(currentRefreshToken);
      addLog('Access token silently refreshed (5-min TTL renewed)');
      applyTokens(tokens, tokens.user);
    } catch {
      clearSession('Silent refresh failed — session ended');
    }
  }, [addLog, applyTokens, clearSession]);

  // On mount: if a refresh token survived a page reload, use it to get a
  // fresh access token instead of forcing the user to log in again.
  useEffect(() => {
    const existing = getRefreshToken();
    if (!existing) return;
    setStatus('loading');
    server
      .refresh(existing)
      .then((tokens) => {
        applyTokens(tokens, tokens.user);
        setStatus('authenticated');
        addLog('Restored session from stored refresh token');
      })
      .catch(() => clearSession());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => refreshTimerRef.current && clearTimeout(refreshTimerRef.current), []);

  const login = useCallback(async (email, password) => {
    setStatus('loading');
    try {
      const result = await server.login(email, password);
      applyTokens(result, result.user);
      setStatus('authenticated');
      addLog(`Logged in as ${result.user.email} (access token valid 5 min)`);
    } catch (err) {
      setStatus('error');
      throw err;
    }
  }, [applyTokens, addLog]);

  const logout = useCallback(async () => {
    const token = getRefreshToken();
    if (token) await server.logout(token).catch(() => {});
    clearSession('Logged out');
  }, [clearSession]);

  // Any protected call in the app should go through this so a 401 (expired
  // access token) transparently triggers a refresh-and-retry.
  const callProtected = useCallback((requestFn) =>
    authorizedRequest({
      requestFn,
      getAccessToken: () => accessToken,
      getRefreshToken,
      onTokens: (tokens) => applyTokens(tokens, tokens.user),
      onAuthFailure: () => clearSession('Session expired — please log in again'),
    }), [accessToken, applyTokens, clearSession]);

  const value = {
    accessToken,
    user,
    status,
    log,
    login,
    logout,
    callProtected,
    forceExpireAccessToken: () => {
      // Demo-only affordance: jump the access token to an already-expired
      // one so you can watch the 401 -> refresh -> retry path fire live.
      setAccessToken((current) => {
        if (!current) return current;
        const payload = JSON.parse(atob(current));
        return btoa(JSON.stringify({ ...payload, exp: Date.now() - 1000 }));
      });
      addLog('Manually expired the access token (demo)');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
