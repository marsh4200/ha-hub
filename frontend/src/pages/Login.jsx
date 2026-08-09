import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { Button, Field, Input, PasswordInput, Alert } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reason') === 'idle') {
      setNotice('You were signed out after a period of inactivity.');
    }
  }, [location.search]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (e2) {
      setErr(e2.response?.data?.error || 'That username and password combination was not accepted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <header className="mb-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Enter your HA-Hub credentials to reach your fleet.
        </p>
      </header>

      {notice && (
        <Alert tone="warning" icon={Clock} className="mb-4">
          {notice}
        </Alert>
      )}
      {err && (
        <Alert tone="error" className="mb-4">
          {err}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Username" required>
          {(a) => (
            <Input
              {...a}
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </Field>

        <Field label="Password" required>
          {(a) => (
            <PasswordInput
              {...a}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          icon={LogIn}
          fullWidth
          loading={busy}
          className="mt-2"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
