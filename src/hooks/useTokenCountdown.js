import { useEffect, useState } from 'react';
import { msUntilExpiry } from '../mockApi/tokens';

/**
 * Ticks every second and returns how much time is left before `accessToken`
 * expires, formatted as mm:ss, plus an `isHot` flag for the final stretch
 * so the UI can flag it.
 */
export function useTokenCountdown(accessToken) {
  const [remainingMs, setRemainingMs] = useState(() => msUntilExpiry(accessToken));

  useEffect(() => {
    setRemainingMs(msUntilExpiry(accessToken));
    const id = setInterval(() => setRemainingMs(msUntilExpiry(accessToken)), 1000);
    return () => clearInterval(id);
  }, [accessToken]);

  const seconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return {
    seconds,
    label: seconds > 0 ? `${mm}:${ss}` : '00:00',
    isExpired: seconds <= 0,
    isHot: seconds > 0 && seconds <= 15,
  };
}
