import { useEffect, useState, useRef } from 'react';
import { Download, KeyRound, RefreshCw, GitBranch, CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUpdate } from '../context/UpdateContext.jsx';

const VERSION_BEFORE_KEY = 'ha-hub-version-before-update';
const JUST_UPDATED_KEY   = 'ha-hub-just-updated';

export default function Settings() {
  const { user } = useAuth();
  const { state: updateState, updating, refresh: refreshUpdate, setUpdating } = useUpdate();

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [requestErr, setRequestErr] = useState('');
  const [upToDateMsg, setUpToDateMsg] = useState('');
  const [justUpdated, setJustUpdated] = useState(null); // { from, to }
  const fadeTimer = useRef(null);

  async function loadInfo() {
    try {
      const { data } = await api.get('/system/update/status');
      setInfo(prev => ({ ...(prev || {}), local: data.local, repo: data.repo, remote: prev?.remote || null }));
      return data.local?.version || null;
    } catch (_) { return null; }
  }
  useEffect(() => { if (user?.role === 'ADMIN') loadInfo(); /* eslint-disable-next-line */ }, [user]);

  // On mount: check if we just came back from an update reload
  useEffect(() => {
    const beforeRaw = localStorage.getItem(VERSION_BEFORE_KEY);
    if (!beforeRaw) return;

    let before;
    try { before = JSON.parse(beforeRaw); } catch { localStorage.removeItem(VERSION_BEFORE_KEY); return; }

    // If the stash is stale (>10 min old), drop it — must've been an aborted update
    if (Date.now() - before.at > 10 * 60 * 1000) {
      localStorage.removeItem(VERSION_BEFORE_KEY);
      return;
    }

    // Fetch the current (post-reload) version and compare
    (async () => {
      const currentVersion = await loadInfo();
      if (!currentVersion) return;

      if (currentVersion !== before.version) {
        // Real update happened — show banner
        setJustUpdated({ from: before.version, to: currentVersion });
        fadeTimer.current = setTimeout(() => {
          setJustUpdated(null);
        }, 5_000);
      }
      // Either way — clear the stash so it doesn't fire again on next visit
      localStorage.removeItem(VERSION_BEFORE_KEY);
    })();

    return () => fadeTimer.current && clearTimeout(fadeTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkUpdates() {
    setChecking(true); setRequestErr(''); setUpToDateMsg('');
    try {
      const { data } = await api.get('/system/update/check');
      if (data.error) {
        setRequestErr(data.error);
      } else {
        setInfo(prev => ({
          ...(prev || {}),
          local: { version: data.localVersion },
          remote: { version: data.remoteVersion, sha: data.commit?.sha, message: data.commit?.message },
          repo: data.repo,
          upToDate: data.upToDate,
        }));
        if (data.upToDate) {
          setUpToDateMsg(`Already up to date — version ${data.localVersion}`);
          setTimeout(() => setUpToDateMsg(''), 5_000);
        }
      }
    } catch (e) {
      setRequestErr(e.response?.data?.error || 'Check failed');
    } finally { setChecking(false); }
  }

  async function runUpdate() {
    if (!confirm('Update HA-Hub from GitHub now?\n\nYou will stay logged in and the page will reload automatically when done.')) return;
    setRequestErr(''); setUpToDateMsg('');

    // Stash the current version BEFORE starting — survives the reload
    if (info?.local?.version) {
      localStorage.setItem(VERSION_BEFORE_KEY, JSON.stringify({
        version: info.local.version,
        at: Date.now(),
      }));
    }

    setUpdating(true);
    try {
      const { data } = await api.post('/system/update');
      if (data?.upToDate) {
        setUpToDateMsg(data.message || 'Already up to date');
        setUpdating(false);
        localStorage.removeItem(VERSION_BEFORE_KEY); // not actually updating, drop the stash
        setTimeout(() => setUpToDateMsg(''), 5_000);
        return;
      }
      await refreshUpdate();
    } catch (e) {
      setRequestErr(e.response?.data?.error || 'Update request failed');
      setUpdating(false);
      localStorage.removeItem(VERSION_BEFORE_KEY); // request failed, drop the stash
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

      {/* "Just updated" banner — only shows after a real version change */}
      {justUpdated && (
        <div className="rounded-lg p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2 animate-fadein">
          <Sparkles size={16}/>
          <span className="flex items-center gap-1 flex-wrap">
            Update complete —
            <span className="font-mono text-slate-400">v{justUpdated.from}</span>
            <ArrowRight size={12} className="text-slate-500"/>
            <span className="font-mono text-emerald-300 font-semibold">v{justUpdated.to}</span>
          </span>
        </div>
      )}

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
                {info.remote?.version && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latest version</span>
                    <span className="font-mono text-slate-200">
                      {info.remote.version}
                      {info.upToDate && <span className="ml-2 text-emerald-400 text-xs">✓ up to date</span>}
                    </span>
                  </div>
                )}
                {info.remote?.sha && (
                  <div className="flex justify-between"><span className="text-slate-400">Latest commit</span><span className="font-mono text-slate-200">{info.remote.sha}</span></div>
                )}
              </div>

              {upToDateMsg && (
                <div className="text-sm rounded-lg p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={14}/>{upToDateMsg}
                </div>
              )}

              {isRunning && (
                <div className="space-y-2 border-t border-line pt-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Loader2 size={14} className="animate-spin text-brand"/>
                    <span className="text-slate-300">{s.message || s.step || s.status}</span>
                    <span className="ml-auto text-slate-500 font-mono">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-bg-soft rounded-full overflow-hidden">
                    <div className="h-full bg-brand transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">You'll stay logged in. The page will reload automatically when finished.</p>
                </div>
              )}

              {s.status === 'error' && !isRunning && (
                <div className="text-sm rounded-lg p-2 bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
                  <AlertCircle size={14}/>{s.message || 'Update failed'}
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
        <div>HA-Hub v{info?.local?.version || '1.7.0'}</div>
        <div>Logged in as <span className="text-slate-200">{user?.username}</span> ({user?.role})</div>
        <a className="text-brand hover:underline" href="/api/docs" target="_blank" rel="noreferrer">API documentation →</a>
      </div>
    </div>
  );
}
