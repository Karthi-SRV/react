import * as server from '../mockApi/server';

// Deduping in-flight refresh calls the same way you'd dedupe any other
// expensive shared request: if five components hit a 401 at once, they
// should trigger exactly one refresh call, not five.
let pendingRefresh = null;

function doRefresh(refreshToken, onTokens, onRefreshTriggered) {
  if (!pendingRefresh) {
    // This is the moment a NEW refresh call actually starts. If 5 requests
    // all land here within the same tick, only the first one gets past
    // `!pendingRefresh` — the other 4 just await the same promise below.
    onRefreshTriggered?.();
    pendingRefresh = server
      .refresh(refreshToken)
      .then((tokens) => {
        onTokens(tokens);
        return tokens.accessToken;
      })
      .finally(() => {
        pendingRefresh = null;
      });
  }
  return pendingRefresh;
}

/**
 * Runs `requestFn(accessToken)` against the mock API. If it fails with a
 * 401, refreshes once (deduped) and retries exactly one time. On a failed
 * refresh, calls `onAuthFailure` (typically: force logout).
 */
export async function authorizedRequest({
  requestFn,
  getAccessToken,
  getRefreshToken,
  onTokens,
  onAuthFailure,
  onRefreshTriggered,
  _isRetry = false,
}) {
  try {
    return await requestFn(getAccessToken());
  } catch (err) {
    const isAuthError = err.status === 401;
    if (!isAuthError || _isRetry) throw err;

    try {
      const newAccessToken = await doRefresh(getRefreshToken(), onTokens, onRefreshTriggered);
      return await requestFn(newAccessToken);
    } catch (refreshErr) {
      onAuthFailure();
      throw refreshErr;
    }
  }
}
