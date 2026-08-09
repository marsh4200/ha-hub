import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, RefreshCw, Inbox, ArrowUpCircle, CheckCircle2, SearchX,
  LayoutGrid, Rows3, Plus, Server,
} from 'lucide-react';
import api from '../services/api';
import { useNow } from '../hooks/useNow';
import { useAuth } from '../context/AuthContext.jsx';
import { useFleet } from '../context/FleetContext.jsx';
import ClientCard from '../components/ClientCard.jsx';
import SiteRow from '../components/SiteRow.jsx';
import FleetOverview from '../components/FleetOverview.jsx';
import {
  Button, EmptyState, PageHeader, SectionHeader, SearchInput,
  SegmentedControl, StatusDot, Skeleton, useToast,
} from '../components/ui';
import { triage, needsAction, matchesSite, relTime, num, plural } from '../lib/format';

const DENSITY_KEY = 'ha-hub-fleet-density';

/**
 * The fleet screen.
 *
 * The whole page is arranged around one question — what needs me? — so the
 * order is fixed and never sorted by name at the top level: things that are
 * broken, then things that are healthy but have news, then everything that is
 * quiet. Within a band sites are alphabetical so a card keeps its position
 * between polls and you can build muscle memory for where a client sits.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow(1000);

  const {
    clients, stats, loading, connected, lastSyncedAt,
    attentionCount, updateCount, reload, patchClient, refreshStats,
  } = useFleet();

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [density, setDensity] = useState(() => localStorage.getItem(DENSITY_KEY) || 'comfortable');

  useEffect(() => { localStorage.setItem(DENSITY_KEY, density); }, [density]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (filter === 'attention') { if (!needsAction(c)) return false; }
      else if (filter === 'updates') { if (!(c.updateAvailable && !needsAction(c))) return false; }
      else if (filter === 'unlinked') { if (c.hasHaToken) return false; }
      else if (filter !== 'all' && (c.status || '').toLowerCase() !== filter) return false;
      return matchesSite(c, q);
    });
  }, [clients, q, filter]);

  const { needsAttention, updatable, healthy } = useMemo(() => {
    const rank = { down: 0, warn: 1, info: 2, idle: 3, live: 4 };
    const sorted = [...filtered].sort((a, b) => {
      const d = rank[triage(a)] - rank[triage(b)];
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
    return {
      needsAttention: sorted.filter((c) => needsAction(c)),
      updatable: sorted.filter((c) => !needsAction(c) && triage(c) === 'info'),
      healthy: sorted.filter((c) => !needsAction(c) && triage(c) !== 'info'),
    };
  }, [filtered]);

  async function handleReload() {
    setReloading(true);
    await reload({ silent: true });
    setReloading(false);
  }

  async function downloadBackup(client) {
    try {
      const meta = await api.get(`/clients/${client.id}/backup`);
      if (!meta.data?.backup) {
        toast.warning(`No backup is stored for ${client.name}.`);
        return;
      }
      const res = await api.get(`/clients/${client.id}/backup/download`, { responseType: 'blob', timeout: 0 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.data.backup.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success(`Downloading ${meta.data.backup.filename}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'The backup could not be downloaded.');
    }
  }

  async function refreshOne(client) {
    setBusyId(client.id);
    try {
      const { data } = await api.post(`/clients/${client.id}/refresh`);
      patchClient({ id: client.id, ...data.client });
      refreshStats();
      toast.success(`${client.name} checked.`);
    } catch (err) {
      toast.error(err.response?.data?.error || `Could not reach ${client.name}.`);
    } finally {
      setBusyId(null);
    }
  }

  const cardProps = {
    now,
    onDownloadBackup: downloadBackup,
    onRefresh: refreshOne,
    canRefresh: isAdmin,
  };

  const filtering = q.trim() !== '' || filter !== 'all';
  const Item = density === 'compact' ? SiteRow : ClientCard;
  const listClass =
    density === 'compact'
      ? 'space-y-1.5'
      : 'grid gap-3 sm:grid-cols-2 2xl:grid-cols-3';

  function clearFilters() {
    setQ('');
    setFilter('all');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Monitor"
        title="Fleet"
        description="Live health for every Home Assistant installation you manage."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 text-2xs text-fg-faint">
              <StatusDot tone={connected ? 'live' : 'warn'} pulse={connected} />
              {connected ? 'Live updates on' : 'Reconnecting…'}
            </span>
            {lastSyncedAt && (
              <span className="text-2xs tnum text-fg-faint">
                Synced {relTime(lastSyncedAt, now)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button icon={RefreshCw} aria-label="Refresh fleet status" onClick={handleReload} loading={reloading}>
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {isAdmin && (
              <Button variant="primary" icon={Plus} aria-label="Add a site" onClick={() => navigate('/clients?new=1')}>
                <span className="hidden sm:inline">Add site</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </>
        }
      />

      <FleetOverview
        stats={stats}
        attention={attentionCount}
        updates={updateCount}
        filter={filter}
        onFilter={setFilter}
        loading={loading}
      />

      {/* ── Search and view controls ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search sites by name, address, version or tag"
          resultCount={filtered.length}
          totalCount={clients.length}
          className="min-w-[220px]"
        />

        <SegmentedControl
          label="List density"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: '', icon: LayoutGrid, title: 'Card view' },
            { value: 'compact', label: '', icon: Rows3, title: 'Compact list' },
          ]}
        />

        {filtering && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {filtering && !loading && (
        <p className="-mt-2 text-2xs tnum text-fg-faint" role="status" aria-live="polite">
          Showing {num(filtered.length)} of {num(clients.length)} {plural(clients.length, 'site', 'sites')}
        </p>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {loading && clients.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[214px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        clients.length > 0 ? (
          <EmptyState
            icon={SearchX}
            title="No sites match those filters"
            description="Try a different search term, or clear the filters to see the whole fleet again."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No sites yet"
            description={
              isAdmin
                ? 'Register your first Home Assistant installation and HA-Hub will start tracking its status, version and pending updates.'
                : 'You have not been given access to any sites yet. Ask an administrator to assign some to your account.'
            }
            action={
              isAdmin ? (
                <Button variant="primary" icon={Server} onClick={() => navigate('/clients?new=1')}>
                  Add your first site
                </Button>
              ) : null
            }
          />
        )
      ) : (
        <div className="space-y-7">
          {needsAttention.length > 0 && (
            <section aria-label="Sites needing attention">
              <SectionHeader
                icon={<AlertTriangle size={13} className="text-warn" aria-hidden="true" />}
                label="Needs attention"
                count={needsAttention.length}
                note="unreachable or faulted"
              />
              <div className={`${listClass} stagger`}>
                {needsAttention.map((c) => (
                  <Item key={c.id} client={c} busy={busyId === c.id} {...cardProps} />
                ))}
              </div>
            </section>
          )}

          {updatable.length > 0 && (
            <section aria-label="Sites with updates available">
              <SectionHeader
                icon={<ArrowUpCircle size={13} className="text-brand" aria-hidden="true" />}
                label="Updates available"
                count={updatable.length}
                note="online and healthy"
              />
              <div className={listClass}>
                {updatable.map((c) => (
                  <Item key={c.id} client={c} busy={busyId === c.id} {...cardProps} />
                ))}
              </div>
            </section>
          )}

          {healthy.length > 0 && (
            <section aria-label="Healthy sites">
              {(needsAttention.length > 0 || updatable.length > 0) && (
                <SectionHeader
                  icon={<CheckCircle2 size={13} className="text-live" aria-hidden="true" />}
                  label="All good"
                  count={healthy.length}
                />
              )}
              <div className={listClass}>
                {healthy.map((c) => (
                  <Item key={c.id} client={c} busy={busyId === c.id} {...cardProps} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
