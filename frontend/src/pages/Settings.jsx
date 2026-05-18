import { useEffect, useState } from 'react';
import { Download, KeyRound, RefreshCw, GitBranch, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUpdate } from '../context/UpdateContext.jsx';

export default function Settings() {
  const { user } = useAuth();
  const { state: updateState, updating, refresh: refreshUpdate, setUpdating } = useUpdate();

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const [info, setInfo] = useState(null); // { local, remote, repo }
  const [checking, setChecking] = useState(false);
  const [requestErr, setRequestErr] = useState('');

  async function loadInfo() {
    try {
      const { data } = await api.get('/system/update/status');
      setInfo({ local: data.local, repo: data.repo, remote: info?.remote || null });
    } catch (_) {}
  }
  useEffect(() => { if (user?.role === 'ADMIN') loadInfo(); /* eslint-disable-next-line */ }, [user]);

  async function checkUpdates() {
    setChecking(true); setRequestErr('');
    try {
      const { data } = await api.get('/system/update/check');
      setInfo(prev => ({ ...(prev||{}), local: data.local, remote: data.remote, repo: data.repo }));
    } catch (e) {
      setRequestErr(e.response?.data?.error || 'Check failed');
    } finally { setChecking(false); }
  }

  async function runUpdate() {
    if (!confirm('Update HA-Hub from GitHub now?\n\nThe portal will briefly disconnect while it rebuilds. You will stay logged in and the page will reload automatically when done.')) return;
    setRequestErr('');
    setUpdating(true);            // tell api.js: don't kick out on 401/network
    try {
      await api.post('/system/update');
      await refreshUpdate();      // immediately pull the state file
    } catch (e) {
      setRequestErr(e.response?.data?.error || 'Update request failed');
      setUpdating(false);
    }
  }

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

  const s = updateState || {};
  const isRunning = s.status === 'running' || s.status === 'requested';
  const progress = s.progress ?? 0;

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
          <h2 className="font-medium mb-3 flex items-center gap-2"><GitBranch size={16}/>Updates</h2>
          {info ? (
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">Installed version</span><span className="font-mono text-slate-200">{info.local?.version || 'unknown'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Repository</span><a className="text-brand hover:underline text-xs truncate max-w-xs" href={info.repo?.replace('.git','')} target="_blank" rel="noreferrer">{info.repo}</a></div>
                {info.remote && !info.remote.error && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Latest commit</span><span className="font-mono text-slate-200">{info.remote.sha}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Message</span><span className="text-slate-300 text-xs truncate max-w-xs">{info.remote.message}</span></div>
                  </>
                )}
                {info.remote?.error && (
                  <div className="text-amber-400 text-xs flex items-center gap-1 mt-2"><AlertCircle size={12}/>{info.remote.error}</div>
                )}
              </div>

              {(isRunning || s.status === 'success' || s.status === 'error') && (
                <div className="space-y-2 border-t border-line pt-3">
                  <div className="flex items-center gap-2 text-xs">
                    {isRunning && <Loader2 size={14} className="animate-spin text-brand"/>}
                    {s.status === 'success' && <CheckCircle2 size={14} className="text-emerald-400"/>}
                    {s.status === 'error' && <AlertCircle size={14} className="text-red-400"/>}
                    <span className="text-slate-300">{s.message || s.step || s.status}</span>
                    <span className="ml-auto text-slate-500 font-mono">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-bg-soft rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ${
                        s.status === 'error' ? 'bg-red-500' :
                        s.status === 'success' ? 'bg-emerald-500' : 'bg-brand'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {s.status === 'success' && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin"/> Reloading the page to load the new version…
                    </p>
                  )}
                  {isRunning && (
                    <p className="text-xs text-slate-500">You'll stay logged in. The page will reload automatically when finished.</p>
                  )}
                </div>
              )}

              {requestErr && <div className="text-sm rounded-lg p-2 bg-red-500/10 text-red-400">{requestErr}</div>}

              <div className="flex gap-2 justify-end">
                <button className="btn-secondary" onClick={checkUpdates} disabled={checking || updating}>
                  <RefreshCw size={14} className={checking ? 'animate-spin' : ''}/>{checking ? 'Checking…' : 'Check for updates'}
                </button>
                <button className="btn-primary" onClick={runUpdate} disabled={updating}>
                  {updating ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                  {updating ? 'Updating…' : 'Update now'}
                </button>
              </div>
              <p className="text-xs text-slate-500">Pulls the latest code from GitHub and rebuilds the containers. Takes ~1–2 minutes.</p>
            </div>
          ) : <div className="text-slate-500 text-sm">Loading…</div>}
        </div>
      )}

      {user?.role === 'ADMIN' && (
        <div className="card p-5">
          <h2 className="font-medium mb-3 flex items-center gap-2"><Download size={16}/>Backup / export</h2>
          <p className="text-sm text-slate-400 mb-3">Export users, clients and permissions as a JSON file.</p>
          <button className="btn-secondary" onClick={exportData}><Download size={14}/>Download export</button>
        </div>
      )}

      <div className="card p-5 text-sm text-slate-400">
        <div className="text-slate-300 font-medium mb-2">About</div>
        <div>HA-Hub v{info?.local?.version || '1.4.0'}</div>
        <div>Logged in as <span className="text-slate-200">{user?.username}</span> ({user?.role})</div>
        <a className="text-brand hover:underline" href="/api/docs" target="_blank" rel="noreferrer">API documentation →</a>
      </div>
    </div>
  );
}
