import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getRefreshCallCount } from '../mockApi/server';

/**
 * Fires `requestFactory(id, accessToken)` for every id in `ids`, all at
 * once, each independently protected. If the access token is expired, all
 * of them can 401 in the same instant — but they share the single deduped
 * refresh call from `authClient.js`, so only one refresh ever actually
 * reaches the server no matter how many of the N calls needed it.
 *
 * `refreshesFired` reports how many refresh calls the most recent run
 * triggered, so the dedup is visible rather than just asserted.
 */
export function useParallelProtectedRequests(ids, requestFactory) {
  const { callProtected } = useAuth();
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshesFired, setRefreshesFired] = useState(null);
  const requestFactoryRef = useRef(requestFactory);
  requestFactoryRef.current = requestFactory;

  const refetch = useCallback(async () => {
    setLoading(true);
    const callsBefore = getRefreshCallCount();

    const settled = await Promise.allSettled(
      ids.map((id) =>
        callProtected((accessToken) => requestFactoryRef.current(id, accessToken))
      )
    );

    const next = {};
    settled.forEach((result, i) => {
      const id = ids[i];
      next[id] = result.status === 'fulfilled'
        ? { ...result.value, error: null }
        : { error: result.reason.message };
    });

    setResults(next);
    setRefreshesFired(getRefreshCallCount() - callsBefore);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callProtected, ids.join(',')]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  return { results, loading, refreshesFired, refetch };
}
