import { useState } from 'react';
import { Download, KeyRound } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  async function changePw(e) {
    e.preventDefault(); setMsg(''); setErr('');
    if (pw.newPassword.length < 8) return setErr('Min 8 chars');
    if (pw.newPassword !== pw.confirm) return setErr('Passwords do not match');
    try {
      await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' }); setMsg('Password changed');
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }

  async function exportData() {
    const res = await api.get('/system/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `ha-hub-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-slate-400 text-sm">Account & system</p></div>

      <div className="card p-5">
        <h2 className="font-medium mb-3 flex items-center gap-2"><KeyRound size={16}/>Change password</h2>
        {msg && <div className="text-sm text-emerald-400 mb-2">{msg}</div>}
        {err && <div className="text-sm text-red-400 mb-2">{err}</div>}
        <form onSubmit={changePw} className="space-y-3">
          <div><label className="label">Current password</label><input className="input" type="password" required value={pw.currentPassword} onChange={e=>setPw({...pw, currentPassword:e.target.value})}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">New password</label><input className="input" type="password" required minLength={8} value={pw.newPassword} onChange={e=>setPw({...pw, newPassword:e.target.value})}/></div>
            <div><label className="label">Confirm</label><input className="input" type="password" required value={pw.confirm} onChange={e=>setPw({...pw, confirm:e.target.value})}/></div>
          </div>
          <div className="flex justify-end"><button className="btn-primary">Update password</button></div>
        </form>
      </div>

      {user?.role === 'ADMIN' && (
        <div className="card p-5">
          <h2 className="font-medium mb-3 flex items-center gap-2"><Download size={16}/>Backup / export</h2>
          <p className="text-sm text-slate-400 mb-3">Export users, clients and permissions as a JSON file. API tokens are included — store securely.</p>
          <button className="btn-secondary" onClick={exportData}><Download size={14}/>Download export</button>
        </div>
      )}

      <div className="card p-5 text-sm text-slate-400">
        <div className="text-slate-300 font-medium mb-2">About</div>
        <div>HA-Hub v1.0.0</div>
        <div>Logged in as <span className="text-slate-200">{user?.username}</span> ({user?.role})</div>
        <a className="text-brand hover:underline" href="/api/docs" target="_blank" rel="noreferrer">API documentation →</a>
      </div>
    </div>
  );
}
