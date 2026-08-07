import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, LogIn, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reason') === 'idle') {
      setNotice('You were signed out due to inactivity.');
    }
  }, [location.search]);

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
          <div className="w-10 h-10 rounded-lg bg-brand/12 border border-brand/25 grid place-items-center"><House className="text-brand" size={20} /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">HA-Hub</h1>
            <p className="text-sm text-slate-400">Sign in to continue</p>
          </div>
        </div>
        {notice && (
          <div className="mb-4 text-sm bg-warn/10 text-warn border border-warn/25 rounded-lg p-3 flex items-center gap-2">
            <Clock size={14}/> {notice}
          </div>
        )}
        {err && <div className="mb-4 text-sm bg-down/10 text-down border border-down/25 rounded-lg p-3">{err}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Username</label><input className="input" required value={u} onChange={e => setU(e.target.value)} autoFocus/></div>
          <div><label className="label">Password</label><input className="input" type="password" required value={p} onChange={e => setP(e.target.value)} /></div>
          <button className="btn-primary w-full justify-center mt-2" disabled={busy}><LogIn size={16}/>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
