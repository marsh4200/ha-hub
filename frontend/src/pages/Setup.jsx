import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout.jsx';
import { Button, Field, Input, PasswordInput, Alert } from '../components/ui';
import cn from '../lib/cn';

/**
 * First run.
 *
 * This account cannot be recovered if its password is lost — there is no email
 * to reset against — so the strength meter is not decoration here. It exists to
 * push the one irreplaceable credential in the system away from something
 * guessable.
 */
function strengthOf(pw) {
  if (!pw) return { score: 0, label: 'Enter a password', tone: 'bg-line' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^\w\s]/.test(pw)) score++;

  if (pw.length < 8) return { score: 1, label: 'Too short — 8 characters minimum', tone: 'bg-down' };
  if (score <= 2) return { score: 2, label: 'Weak', tone: 'bg-down' };
  if (score === 3) return { score: 3, label: 'Reasonable', tone: 'bg-warn' };
  if (score === 4) return { score: 4, label: 'Strong', tone: 'bg-live' };
  return { score: 5, label: 'Very strong', tone: 'bg-live' };
}

export default function Setup({ onDone }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => strengthOf(form.password), [form.password]);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (form.password.length < 8) return setErr('The password must be at least 8 characters.');
    if (form.password !== form.confirm) return setErr('The two passwords do not match.');

    setBusy(true);
    try {
      await api.post('/auth/setup', {
        username: form.username.trim(),
        email: form.email || null,
        password: form.password,
      });
      onDone?.();
      navigate('/login');
    } catch (e2) {
      setErr(e2.response?.data?.error || 'The administrator account could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <header className="mb-7">
        <span className="eyebrow">First run</span>
        <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-fg">
          Create your administrator
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          This account has full control of HA-Hub. You can add more people once you are inside.
        </p>
      </header>

      {err && <Alert tone="error" className="mb-4">{err}</Alert>}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Username" required>
          {(a) => (
            <Input
              {...a}
              required
              autoFocus
              minLength={3}
              maxLength={32}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          )}
        </Field>

        <Field label="Email" labelSuffix="— optional" hint="Only used to identify the account. HA-Hub does not send mail.">
          {(a) => (
            <Input
              {...a}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
        </Field>

        <Field label="Password" required>
          {(a) => (
            <>
              <PasswordInput
                {...a}
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <div className="mt-2 flex items-center gap-2.5">
                <div className="flex h-1 flex-1 gap-1" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        'flex-1 rounded-full transition-colors duration-200',
                        i <= strength.score ? strength.tone : 'bg-line'
                      )}
                    />
                  ))}
                </div>
                <span className="shrink-0 text-2xs text-fg-faint">{strength.label}</span>
              </div>
            </>
          )}
        </Field>

        <Field label="Confirm password" required error={mismatch ? 'The passwords do not match.' : undefined}>
          {(a) => (
            <PasswordInput
              {...a}
              required
              autoComplete="new-password"
              invalid={mismatch}
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          )}
        </Field>

        <Alert tone="warning" icon={ShieldCheck}>
          There is no password reset. Store this somewhere you will still have access to in a year.
        </Alert>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          fullWidth
          loading={busy}
          disabled={mismatch}
        >
          {busy ? 'Creating account…' : 'Create administrator'}
        </Button>
      </form>
    </AuthLayout>
  );
}
