import * as server from '../mockApi/server';
import { useParallelProtectedRequests } from '../hooks/useParallelProtectedRequests';

export default function DashboardPage() {
  const { results, loading, refreshesFired, refetch } = useParallelProtectedRequests(
    server.WIDGET_IDS,
    server.getWidget
  );

  return (
    <div>
      <div className="row between">
        <h2>Dashboard</h2>
        <button className="secondary" onClick={refetch} disabled={loading}>
          {loading ? 'Loading 5 requests…' : 'Reload all 5'}
        </button>
      </div>

      <p className="muted">
        5 widgets, 5 independent endpoints, fired in parallel. Each validates its own
        access token — if it's expired, all 5 can 401 in the same instant, but only one
        refresh call actually reaches the server.
        {refreshesFired !== null && (
          <> This run triggered <strong>{refreshesFired}</strong> refresh call{refreshesFired === 1 ? '' : 's'}.</>
        )}
      </p>

      <div className="grid">
        {server.WIDGET_IDS.map((id) => {
          const w = results[id];
          return (
            <div className="widget" key={id}>
              {!w && <p className="muted">Loading…</p>}
              {w?.error && <p className="error">{w.error}</p>}
              {w && !w.error && (
                <>
                  <p className="widget-label">{w.label}</p>
                  <p className="widget-value">{w.value}</p>
                  <p className="widget-time muted">as of {w.fetchedAt}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
