import { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, Activity, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useNow } from '../hooks/useNow';
import StatusBadge from '../components/StatusBadge.jsx';

function relTime(d, now) {
  if (!d) return 'never';
  const s = Math.floor((now - new Date(d).getTime()) / 1000);
  if (s < 5)   return 'just now';
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, unknown: 0 });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const now = useNow(1000); // ticks every second → relTime updates live

  async function load() {
    try {
      const [c, s] = await Promise.all([api.get('/clients'), api.get('/system/stats')]);
      setClients(c.data.clients);
      setStats(s.data);
    } catch (_) { /* update may be in progress */ }
  }
  useEffect(() => { load(); }, []);

  // Light refresh every 10s as a safety net even if sockets are unhealthy
  useEffect(() => {
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  useSocket((ev, payload) => {
    if (ev === 'client:update') {
      setClients(prev => prev.map(c => c.id === payload.id ? { ...c, ...payload } : c));
      api.get('/system/stats').then(r => setStats(r.data)).catch(() => {});
    } else if (ev === 'reconnect') {
      load();
    }
  });

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (filter !== 'all' && c.status.toLowerCase() !== filter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return c.name.toLowerCase().includes(s) ||
             (c.hostname || '').toLowerCase().includes(s) ||
             (c.group || '').toLowerCase().includes(s) ||
             (c.tags || []).some(t => t.toLowerCase().includes(s));
    });
  }, [clients, q, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-slate-400 text-sm">Live status of your Home Assistant instances</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="dot dot-online"></span>
          <span>Live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total"   value={stats.total}   icon={<Activity className="text-slate-300"/>} />
        <StatCard label="Online"  value={stats.online}  icon={<CheckCircle2 className="text-emerald-400"/>} />
        <StatCard label="Offline" value={stats.offline} icon={<XCircle className="text-red-400"/>} />
        <StatCard label="Unknown" value={stats.unknown} icon={<HelpCircle className="text-slate-400"/>} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
          <input className="input pl-9" placeholder="Search clients, tags, hostnames…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-bg-card border border-line rounded-lg p-1">
          {['all', 'online', 'offline', 'unknown'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize ${filter === f ? 'bg-brand text-white' : 'text-slate-300 hover:bg-bg-soft'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(c => (
          <a key={c.id} href={c.url} target="_blank" rel="noreferrer"
             className="card p-4 hover:border-brand/50 transition group">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-slate-500 truncate">{c.url}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div><div className="text-slate-500">HA Version</div><div className="text-slate-200">{c.haVersion || '—'}</div></div>
              <div><div className="text-slate-500">Last seen</div><div className="text-slate-200">{relTime(c.lastSeenAt, now)}</div></div>
            </div>
            {c.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {c.tags.map(t => <span key={t} className="text-[10px] bg-bg-soft border border-line px-2 py-0.5 rounded">{t}</span>)}
              </div>
            )}
            <div className="mt-3 text-xs text-brand flex items-center gap-1 opacity-0 group-hover:opacity-100">
              Open <ExternalLink size={12}/>
            </div>
          </a>
        ))}
        {filtered.length === 0 && <div className="text-slate-500 text-sm col-span-full text-center py-10">No clients match.</div>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-bg-soft grid place-items-center">{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}
