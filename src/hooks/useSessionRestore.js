import { useEffect, useRef, useState } from 'react';

/**
 * Runs once on mount. If `getStoredToken()` returns a refresh token left
 * over from a previous visit, calls `restore(token)` to exchange it for a
 * fresh access token — the standard "stay logged in across a page refresh"
 * flow, since the access token itself only ever lived in memory and is
 * gone the instant the tab reloads.
 *
 * Returns `true` while the restore attempt is in flight so the UI can show
 * a loading state instead of flashing the login form first.
 */
export function useSessionRestore(getStoredToken, restore) {
  const [restoring, setRestoring] = useState(true);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // StrictMode double-invoke guard
    ranRef.current = true;

    const token = getStoredToken();
    if (!token) {
      setRestoring(false);
      return;
    }
    restore(token).finally(() => setRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return restoring;
}
