import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { msUntilExpiry } from './mockApi/tokens';
import * as server from './mockApi/server';

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
  const [remaining, setRemaining] = useState(msUntilExpiry(accessToken));

  useEffect(() => {
    setRemaining(msUntilExpiry(accessToken));
    const id = setInterval(() => setRemaining(msUntilExpiry(accessToken)), 1000);
    return () => clearInterval(id);
  }, [accessToken]);

  const seconds = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <span className={`countdown ${seconds <= 15 ? 'countdown-hot' : ''}`}>
      {seconds > 0 ? `${mm}:${ss} until access token expires` : 'access token expired'}
    </span>
  );
}

function Dashboard() {
  const { user, logout, callProtected, forceExpireAccessToken, log } = useAuth();
  const [profile, setProfile] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  async function loadProfile() {
    setFetching(true);
    setError(null);
    try {
      const data = await callProtected((accessToken) => server.getProfile(accessToken));
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <div className="row">
        <button onClick={loadProfile} disabled={fetching}>
          {fetching ? 'Calling protected endpoint…' : 'Call protected endpoint'}
        </button>
        <button className="secondary" onClick={forceExpireAccessToken}>
          Force-expire access token
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {profile && (
        <pre className="profile">{JSON.stringify(profile, null, 2)}</pre>
      )}

      <h2>Event log</h2>
      <ul className="log">
        {log.map((entry, i) => (
          <li key={i}><span className="muted">{entry.time}</span> — {entry.message}</li>
        ))}
      </ul>

      <p className="hint">
        Try "Force-expire access token", then "Call protected endpoint" — you'll see the
        request fail with 401, refresh silently, and retry automatically. Or just wait
        5 minutes and watch the silent refresh fire on its own.
      </p>
    </div>
  );
}

function Screen() {
  const { status, accessToken } = useAuth();

  if (status === 'loading' && !accessToken) {
    return <div className="card"><p>Restoring session…</p></div>;
  }
  return accessToken ? <Dashboard /> : <LoginForm />;
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
