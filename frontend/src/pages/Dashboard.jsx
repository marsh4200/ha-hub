import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, AlertTriangle, RefreshCw, Inbox, ArrowUpCircle } from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useNow } from '../hooks/useNow';
import { useAuth } from '../context/AuthContext.jsx';
import ClientCard from '../components/ClientCard.jsx';
import FleetBar from '../components/FleetBar.jsx';
import { triage, needsAction } from '../lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, unknown: 0, updatesAvailable: 0, linked: 0 });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(null);
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([api.get('/clients'), api.get('/system/stats')]);
      setClients(c.data.clients);
      setStats(s.data);
    } catch (_) {
      /* transient — the poller will bring us back */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  useSocket((ev, payload) => {
    if (ev === 'client:update') {
      setClients(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
      api.get('/system/stats').then(r => setStats(r.data)).catch(() => {});
    } else if (ev === 'reconnect') {
      load();
    }
  });

  // Two independent counts. "Attention" means broken; "updates" means there is
  // a newer version waiting. A site can be neither, either, or both.
  const attentionCount = useMemo(() => clients.filter(needsAction).length, [clients]);
  const updateCount = useMemo(
    () => clients.filter(c => triage(c) === 'info' && c.updateAvailable).length,
    [clients]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients.filter(c => {
      if (filter === 'attention') {
        if (!needsAction(c)) return false;
      } else if (filter === 'updates') {
        if (!(c.updateAvailable && !needsAction(c))) return false;
      } else if (filter !== 'all' && (c.status || '').toLowerCase() !== filter) {
        return false;
      }
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.locationName || '').toLowerCase().includes(term) ||
        (c.url || '').toLowerCase().includes(term) ||
        (c.hostname || '').toLowerCase().includes(term) ||
        (c.group || '').toLowerCase().includes(term) ||
        (c.haVersion || '').toLowerCase().includes(term) ||
        (c.tags || []).some(t => t.toLowerCase().includes(term))
      );
    });
  }, [clients, q, filter]);

  // Three bands, top to bottom: broken, then online-with-news, then quiet.
  // Within a band, alphabetical so a site keeps a stable position between polls.
  const { needsAttention, updatable, healthy } = useMemo(() => {
    const rank = { down: 0, warn: 1, info: 2, idle: 3, live: 4 };
    const sorted = [...filtered].sort((a, b) => {
      const d = rank[triage(a)] - rank[triage(b)];
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
    return {
      needsAttention: sorted.filter(c => needsAction(c)),
      updatable: sorted.filter(c => !needsAction(c) && triage(c) === 'info'),
      healthy: sorted.filter(c => !needsAction(c) && triage(c) !== 'info'),
    };
  }, [filtered]);

  async function downloadBackup(client) {
    try {
      const meta = await api.get(`/clients/${client.id}/backup`);
      if (!meta.data?.backup) return alert('No backup stored for this site.');
      const res = await api.get(`/clients/${client.id}/backup/download`, { responseType: 'blob', timeout: 0 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.data.backup.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      alert(err.response?.data?.error || 'Download failed.');
    }
  }

  async function refreshOne(client) {
    setRefreshing(client.id);
    try {
      const { data } = await api.post(`/clients/${client.id}/refresh`);
      setClients(prev => prev.map(c => (c.id === client.id ? { ...c, ...data.client } : c)));
      api.get('/system/stats').then(r => setStats(r.data)).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.error || 'Could not reach that site.');
    } finally {
      setRefreshing(null);
    }
  }

  const cardProps = {
    now,
    onDownloadBackup: downloadBackup,
    onRefresh: refreshOne,
    canRefresh: isAdmin,
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Fleet</div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
        </div>
        <button
          onClick={load}
          className="btn-ghost !px-2.5 !py-2 text-xs"
          title="Reload"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Reload</span>
        </button>
      </header>

      <FleetBar
        stats={stats}
        attention={attentionCount}
        updates={updateCount}
        filter={filter}
        onFilter={setFilter}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" size={16} />
        <input
          className="input pl-9"
          placeholder="Search by name, version, tag or address"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-[190px] rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasClients={clients.length > 0} isAdmin={isAdmin} onClear={() => { setQ(''); setFilter('all'); }} />
      ) : (
        <div className="space-y-6">
          {needsAttention.length > 0 && (
            <section>
              <SectionHead
                icon={<AlertTriangle size={13} className="text-warn" />}
                label="Needs attention"
                count={needsAttention.length}
              />
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {needsAttention.map(c => <ClientCard key={c.id} client={c} {...cardProps} />)}
              </div>
            </section>
          )}

          {updatable.length > 0 && (
            <section>
              <SectionHead
                icon={<ArrowUpCircle size={13} className="text-brand" />}
                label="Update available"
                count={updatable.length}
                note="online and healthy"
              />
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {updatable.map(c => <ClientCard key={c.id} client={c} {...cardProps} />)}
              </div>
            </section>
          )}

          {healthy.length > 0 && (
            <section>
              {(needsAttention.length > 0 || updatable.length > 0) && (
                <SectionHead
                  icon={<span className="dot dot-online" />}
                  label="All good"
                  count={healthy.length}
                />
              )}
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {healthy.map(c => <ClientCard key={c.id} client={c} {...cardProps} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHead({ icon, label, count, note }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      {icon}
      <span className="eyebrow">{label}</span>
      <span className="text-2xs text-slate-600 tnum">{count}</span>
      {note && <span className="text-2xs text-slate-600 hidden sm:inline">· {note}</span>}
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

function EmptyState({ hasClients, isAdmin, onClear }) {
  return (
    <div className="card p-12 text-center">
      <Inbox className="mx-auto text-slate-700 mb-3" size={28} />
      {hasClients ? (
        <>
          <p className="text-slate-400 text-sm">Nothing matches that search.</p>
          <button className="btn-secondary mt-4" onClick={onClear}>Clear filters</button>
        </>
      ) : (
        <>
          <p className="text-slate-300 font-medium">No sites yet</p>
          <p className="text-slate-500 text-sm mt-1">
            {isAdmin
              ? 'Add your first Home Assistant site from the Sites page.'
              : 'You have not been given access to any sites yet.'}
          </p>
        </>
      )}
    </div>
  );
}
