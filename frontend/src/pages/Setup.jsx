import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import api from '../services/api';

export default function Setup({ onDone }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (form.password.length < 8) return setErr('Password must be at least 8 characters');
    if (form.password !== form.confirm) return setErr('Passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/setup', { username: form.username, email: form.email || null, password: form.password });
      onDone?.();
      navigate('/login');
    } catch (e) {
      setErr(e.response?.data?.error || 'Setup failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-brand/15 grid place-items-center"><Home className="text-brand" /></div>
          <div>
            <h1 className="text-xl font-semibold">Welcome to HA-Hub</h1>
            <p className="text-sm text-slate-400">Create your first administrator</p>
          </div>
        </div>
        {err && <div className="mb-4 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg p-3">{err}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Username</label>
            <input className="input" required minLength={3} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
          <div><label className="label">Email (optional)</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Password</label>
            <input className="input" type="password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="label">Confirm password</label>
            <input className="input" type="password" required value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} /></div>
          <button className="btn-primary w-full justify-center mt-2" disabled={busy}>{busy ? 'Creating…' : 'Create admin'}</button>
        </form>
      </div>
    </div>
  );
}
