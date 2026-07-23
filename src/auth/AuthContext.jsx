import { createContext, useCallback, useContext, useState } from 'react';
import * as server from '../mockApi/server';
import { authorizedRequest } from '../api/authClient';
import { useRefreshScheduler } from '../hooks/useRefreshScheduler';
import { useSessionRestore } from '../hooks/useSessionRestore';

const AuthContext = createContext(null);

// NOTE on storage choice for this demo:
// - accessToken lives only in React state (memory) — never persisted. If the
//   tab is closed, it's gone, which is what you want for a short-lived token.
// - refreshToken is persisted to localStorage purely so a page refresh
//   doesn't log you out in this sandbox. In a real app the refresh token
//   should live in an httpOnly, Secure, SameSite cookie set by the server,
//   so client-side JS (and any XSS payload) can never read it at all.
const REFRESH_STORAGE_KEY = 'demo_refresh_token';
const getStoredRefreshToken = () => localStorage.getItem(REFRESH_STORAGE_KEY);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | authenticated | error
  const [log, setLog] = useState([]);

  const addLog = useCallback((message) => {
    setLog((prev) => [{ time: new Date().toLocaleTimeString(), message }, ...prev].slice(0, 12));
  }, []);

  const clearSession = useCallback((reason) => {
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
  }, []);

  const silentRefresh = useCallback(async () => {
    const currentRefreshToken = getStoredRefreshToken();
    if (!currentRefreshToken) return;
    try {
      const tokens = await server.refresh(currentRefreshToken);
      addLog('Access token silently refreshed (5-min TTL renewed)');
      applyTokens(tokens, tokens.user);
    } catch {
      clearSession('Silent refresh failed — session ended');
    }
  }, [addLog, applyTokens, clearSession]);

  // Re-arms itself on every accessToken change (login, refresh, retry) —
  // this is the "stay logged in" heartbeat while the tab stays open.
  useRefreshScheduler(accessToken, silentRefresh);

  // Runs once on mount. If a refresh token survived a page reload, this
  // exchanges it for a fresh access token so reloading the page never logs
  // the user out — the access token itself doesn't survive a reload (it
  // only ever lived in memory), only the refresh token does.
  const restoring = useSessionRestore(getStoredRefreshToken, async (token) => {
    try {
      const tokens = await server.refresh(token);
      applyTokens(tokens, tokens.user);
      setStatus('authenticated');
      addLog('Restored session from stored refresh token');
    } catch {
      clearSession();
    }
  });

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
    const token = getStoredRefreshToken();
    if (token) await server.logout(token).catch(() => {});
    clearSession('Logged out');
  }, [clearSession]);

  // The single choke point every protected API call must go through: it
  // attaches the current access token, and on a 401 transparently
  // refreshes once (deduped across concurrent callers) and retries.
  const callProtected = useCallback((requestFn) =>
    authorizedRequest({
      requestFn,
      getAccessToken: () => accessToken,
      getRefreshToken: getStoredRefreshToken,
      onTokens: (tokens) => applyTokens(tokens, tokens.user),
      onAuthFailure: () => clearSession('Session expired — please log in again'),
      onRefreshTriggered: () => addLog('401 received → refreshing token (deduped for concurrent calls)'),
    }), [accessToken, applyTokens, clearSession, addLog]);

  const value = {
    accessToken,
    user,
    status,
    restoring,
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
