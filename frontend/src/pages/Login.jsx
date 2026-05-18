import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(u, p); navigate('/'); }
    catch (e) { setErr(e.response?.data?.error || 'Login failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-brand/15 grid place-items-center"><Home className="text-brand" /></div>
          <div>
            <h1 className="text-xl font-semibold">HA-Hub</h1>
            <p className="text-sm text-slate-400">Sign in to continue</p>
          </div>
        </div>
        {err && <div className="mb-4 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg p-3">{err}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Username</label><input className="input" required value={u} onChange={e => setU(e.target.value)} /></div>
          <div><label className="label">Password</label><input className="input" type="password" required value={p} onChange={e => setP(e.target.value)} /></div>
          <button className="btn-primary w-full justify-center mt-2" disabled={busy}><LogIn size={16}/>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
