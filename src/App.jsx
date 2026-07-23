import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useTokenCountdown } from './hooks/useTokenCountdown';
import DashboardPage from './pages/DashboardPage';
import ReportPage from './pages/ReportPage';

function LoginForm() {
  const { login, status } = useAuth();
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>Sign in</h1>
      <p className="muted">Demo credentials are pre-filled.</p>

      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      </label>

      <label>
        Password
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function TokenCountdown() {
  const { accessToken } = useAuth();
  const { label, isExpired, isHot } = useTokenCountdown(accessToken);

  return (
    <span className={`countdown ${isHot ? 'countdown-hot' : ''}`}>
      {isExpired ? 'access token expired' : `${label} until access token expires`}
    </span>
  );
}

function Shell() {
  const { user, logout, forceExpireAccessToken, log } = useAuth();
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="card wide">
      <div className="row between">
        <div>
          <h1>Welcome, {user?.name}</h1>
          <p className="muted">{user?.email}</p>
        </div>
        <button className="secondary" onClick={logout}>Log out</button>
      </div>

      <TokenCountdown />

      <div className="tabs">
        <button className={`tab ${tab === 'dashboard' ? 'tab-active' : ''}`} onClick={() => setTab('dashboard')}>
          Dashboard
        </button>
        <button className={`tab ${tab === 'report' ? 'tab-active' : ''}`} onClick={() => setTab('report')}>
          Report
        </button>
        <button className="secondary force-expire" onClick={forceExpireAccessToken}>
          Force-expire access token
        </button>
      </div>

      {tab === 'dashboard' ? <DashboardPage /> : <ReportPage />}

      <h2>Event log</h2>
      <ul className="log">
        {log.map((entry, i) => (
          <li key={i}><span className="muted">{entry.time}</span> — {entry.message}</li>
        ))}
      </ul>

      <p className="hint">
        Try "Force-expire access token" then switch tabs (or hit reload) — the Dashboard's
        5 parallel calls all 401 together but trigger exactly one refresh; the Report's
        single call takes the same path with just one. Reload the whole page and you'll
        stay logged in too — the refresh token restores the session automatically. Or
        just wait 5 minutes and watch the silent refresh fire on its own.
      </p>
    </div>
  );
}

function Screen() {
  const { accessToken, restoring } = useAuth();

  if (restoring) {
    return <div className="card"><p>Restoring session…</p></div>;
  }
  return accessToken ? <Shell /> : <LoginForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="page">
        <Screen />
      </div>
    </AuthProvider>
  );
}
