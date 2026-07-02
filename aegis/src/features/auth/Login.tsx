import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { backendMode } from '../../lib/config';
import { api } from '../../api';
import { resetDemoData } from '../../api/demo/store';
import { ROLE_LABEL } from '../../components/Layout';
import type { Profile } from '../../lib/types';

export default function Login() {
  const { profile, loading, signIn, signInDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [personas, setPersonas] = useState<Profile[]>([]);

  useEffect(() => {
    if (backendMode === 'demo') {
      void api()
        .listDemoPersonas()
        .then(setPersonas);
    }
  }, []);

  if (!loading && profile) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setBusy(false);
  }

  async function pick(id: string) {
    setBusy(true);
    setError('');
    const { error } = await signInDemo(id);
    if (error) setError(error);
    setBusy(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="mark" aria-hidden="true">
            A
          </div>
          <div>
            <div className="name" style={{ color: 'var(--ink)' }}>
              Aegis
            </div>
            <div className="tag" style={{ color: 'var(--ink-faint)' }}>
              safeguarding first
            </div>
          </div>
        </div>

        {backendMode === 'demo' ? (
          <>
            <h1>Try Aegis</h1>
            <p className="auth-sub">
              You&apos;re in <b>demo mode</b> — one sample operator, stored only in this browser.
              Pick a role: the backend returns only what that role is allowed to see, exactly as
              the database policies would in production.
            </p>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            {personas.map((p) => (
              <button key={p.id} className="persona" onClick={() => void pick(p.id)} disabled={busy}>
                <span className="avatar" aria-hidden="true">
                  {p.fullName
                    .split(' ')
                    .map((x) => x[0])
                    .join('')}
                </span>
                <span>
                  <span className="persona-name">{p.fullName}</span>
                  <br />
                  <span className="persona-role">{ROLE_LABEL[p.role]}</span>
                </span>
                <span className="persona-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
            <p className="demo-note">
              Made changes you want to undo?{' '}
              <button
                className="linklike"
                onClick={() => {
                  resetDemoData();
                  window.location.reload();
                }}
              >
                Reset the demo data
              </button>
              <br />
              To connect a real backend, fill in <code>.env</code> — see the README.
            </p>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p className="auth-sub">
              Your view is set by your role — the database only returns what your role is allowed
              to see.
            </p>
            <form onSubmit={(e) => void submit(e)}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}
              <button className="btn-primary" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
