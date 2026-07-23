import { useEffect, useRef } from 'react';
import { msUntilExpiry } from '../mockApi/tokens';

// Refresh a little before actual expiry so an in-flight request never races
// against the clock.
const REFRESH_SKEW_MS = 15_000;

/**
 * Calls `onDue` once, shortly before `accessToken` expires. Re-arms itself
 * automatically whenever `accessToken` changes (e.g. after a refresh swaps
 * in a new one). Returns nothing — it's a side-effect-only hook.
 */
export function useRefreshScheduler(accessToken, onDue) {
  const timerRef = useRef(null);
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue; // always call the latest callback, no stale closures

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!accessToken) return undefined;

    const delay = Math.max(0, msUntilExpiry(accessToken) - REFRESH_SKEW_MS);
    timerRef.current = setTimeout(() => onDueRef.current(), delay);

    return () => clearTimeout(timerRef.current);
  }, [accessToken]);
}
