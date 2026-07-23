import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

/**
 * Runs `requestFn(accessToken)` through the shared protected-request path
 * (attaches the current token, and on a 401 transparently refreshes once
 * and retries). Fires automatically on mount and whenever `deps` change;
 * also returns a manual `refetch`.
 *
 * Every API call in this app should go through this hook (or
 * `useParallelProtectedRequests` below) rather than calling the mock API
 * directly — that's what guarantees no request is ever made with a stale
 * token unchecked.
 */
export function useProtectedRequest(requestFn, deps = []) {
  const { callProtected } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestFnRef = useRef(requestFn);
  requestFnRef.current = requestFn;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callProtected((accessToken) => requestFnRef.current(accessToken));
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callProtected, ...deps]);

  useEffect(() => {
    refetch().catch(() => {}); // error is already captured in state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  return { data, loading, error, refetch };
}
