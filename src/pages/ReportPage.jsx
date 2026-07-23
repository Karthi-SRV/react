import * as server from '../mockApi/server';
import { useProtectedRequest } from '../hooks/useProtectedRequest';

export default function ReportPage() {
  const { data: report, loading, error, refetch } = useProtectedRequest(server.getReport);

  return (
    <div>
      <div className="row between">
        <h2>Report</h2>
        <button className="secondary" onClick={refetch} disabled={loading}>
          {loading ? 'Loading…' : 'Reload report'}
        </button>
      </div>

      <p className="muted">A single request — same 401 → refresh → retry path, just one call instead of five.</p>

      {error && <p className="error">{error}</p>}

      {report && (
        <div className="report">
          <p className="muted">Generated at {report.generatedAt}</p>
          <table>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.metric}>
                  <td>{row.metric}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
