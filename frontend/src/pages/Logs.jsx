import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollText, ChevronLeft, ChevronRight, RefreshCw, Pause, Play, Trash2,
  Info, AlertTriangle, XCircle, ShieldCheck, SearchX,
} from 'lucide-react';
import api from '../services/api';
import {
  Button, IconButton, Badge, EmptyState, PageHeader, SearchInput, FilterChip,
  Select, Skeleton, useToast, useConfirm,
} from '../components/ui';
import { clockTime, dayLabel, absTime, relTime, num, plural } from '../lib/format';
import cn from '../lib/cn';

/**
 * Activity.
 *
 * An operational log is read in two very different ways: scanning for the one
 * red line in a thousand, and reading a single entry closely. The old table
 * served neither — every row had identical visual weight and the timestamp was
 * the widest, loudest column despite being the least interesting part.
 *
 * So: severity gets a coloured rail and drives the only colour on the row, the
 * message is the largest text, and the timestamp shrinks to a monospace clock
 * with the date lifted out into day separators. Monospace is used for times and
 * identifiers only — making the whole page a terminal would undo the hierarchy
 * this is trying to create.
 */
const LEVELS = {
  INFO:  { tone: 'neutral', icon: Info,        rail: 'bg-line-strong', label: 'Info'  },
  WARN:  { tone: 'warn',    icon: AlertTriangle, rail: 'bg-warn',      label: 'Warn'  },
  ERROR: { tone: 'down',    icon: XCircle,     rail: 'bg-down',        label: 'Error' },
  AUDIT: { tone: 'brand',   icon: ShieldCheck, rail: 'bg-brand',       label: 'Audit' },
};

const CATEGORIES = ['auth', 'client', 'user', 'system'];
const PAGE_SIZE = 50;

export default function Logs() {
  const toast = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [q, setQ] = useState('');
  const [live, setLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pageRef = useRef(1);

  const load = useCallback(
    async (page = pageRef.current, { silent = false } = {}) => {
      if (!silent) setLoading(true);
      pageRef.current = page;
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (category) params.set('category', category);
      if (level) params.set('level', level);
      try {
        const res = await api.get(`/logs?${params}`);
        setData(res.data);
      } catch (e) {
        if (!silent) toast.error(e.response?.data?.error || 'The activity log could not be loaded.');
      } finally {
        setLoading(false);
      }
    },
    [category, level, toast]
  );

  useEffect(() => { load(1); }, [category, level, load]);

  // Tail the log while the operator is watching it, but only on page one —
  // silently repaginating under someone reading page four would be hostile.
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => {
      if (pageRef.current === 1) load(1, { silent: true });
    }, 10_000);
    return () => clearInterval(id);
  }, [live, load]);

  async function manualRefresh() {
    setRefreshing(true);
    await load(pageRef.current, { silent: true });
    setRefreshing(false);
  }

  async function purge() {
    const ok = await confirm({
      title: 'Clear old activity?',
      tone: 'danger',
      message: 'Entries older than 30 days are permanently deleted. Anything more recent is kept.',
      confirmLabel: 'Delete old entries',
    });
    if (!ok) return;
    try {
      const { data: res } = await api.delete('/logs?olderThanDays=30');
      toast.success(
        res.deleted > 0
          ? `${num(res.deleted)} ${plural(res.deleted, 'entry', 'entries')} deleted.`
          : 'Nothing was old enough to delete.'
      );
      load(1);
    } catch (e) {
      toast.error(e.response?.data?.error || 'The log could not be cleared.');
    }
  }

  /* Free-text filtering is client-side over the current page. The API has no
     search parameter, and adding one is a backend change this redesign does
     not need — narrowing 50 visible rows is what the box is actually for. */
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data.items;
    return data.items.filter(
      (l) =>
        (l.message || '').toLowerCase().includes(t) ||
        (l.category || '').toLowerCase().includes(t) ||
        (l.user?.username || '').toLowerCase().includes(t)
    );
  }, [data.items, q]);

  // Group by day so the timestamp column can drop the date entirely.
  const groups = useMemo(() => {
    const out = [];
    for (const item of visible) {
      const label = dayLabel(item.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [visible]);

  const pages = Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE)));
  const filtering = !!q.trim() || !!category || !!level;

  function clearFilters() {
    setQ('');
    setCategory('');
    setLevel('');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Monitor"
        title="Activity"
        description="Every authentication, site change and system event recorded by the hub."
        meta={
          <span className="text-2xs tnum text-fg-faint">
            {num(data.total)} {plural(data.total, 'entry', 'entries')} recorded
          </span>
        }
        actions={
          <>
            <Button
              variant={live ? 'outline' : 'secondary'}
              icon={live ? Pause : Play}
              aria-label={live ? 'Pause automatic refresh' : 'Resume automatic refresh'}
              onClick={() => setLive((v) => !v)}
              title={live ? 'Stop refreshing automatically' : 'Refresh automatically every 10 seconds'}
            >
              <span className="hidden sm:inline">{live ? 'Live' : 'Paused'}</span>
            </Button>
            <IconButton icon={RefreshCw} label="Refresh now" loading={refreshing} onClick={manualRefresh} />
            <Button variant="danger" icon={Trash2} aria-label="Delete entries older than 30 days" onClick={purge}>
              <span className="hidden sm:inline">Clear old</span>
            </Button>
          </>
        }
      />

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Filter this page by message, category or user"
            resultCount={visible.length}
            totalCount={data.items.length}
            className="min-w-[220px]"
          />
          <Select
            size="sm"
            aria-label="Filter by category"
            className="h-9 w-auto min-w-[9rem]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
            ))}
          </Select>
          {filtering && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip label="All levels" active={level === ''} onClick={() => setLevel('')} />
          {Object.entries(LEVELS).map(([key, meta]) => (
            <FilterChip
              key={key}
              label={meta.label}
              active={level === key}
              onClick={() => setLevel(level === key ? '' : key)}
              dot={key === 'INFO' ? '#64748B' : key === 'WARN' ? '#FBBF24' : key === 'ERROR' ? '#FB7185' : '#38BDF8'}
            />
          ))}
        </div>
      </div>

      {/* ── Stream ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={filtering ? SearchX : ScrollText}
          compact
          title={filtering ? 'Nothing matches those filters' : 'Nothing recorded yet'}
          description={
            filtering
              ? 'Try a broader level or category, or move to another page.'
              : 'Activity appears here as soon as someone signs in or a site changes state.'
          }
          action={filtering ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : null}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 flex items-center gap-2.5">
                <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-fg-muted">{g.label}</span>
                <span className="h-px flex-1 bg-line" aria-hidden="true" />
                <span className="font-mono text-3xs tnum text-fg-ghost">
                  {g.items.length} {plural(g.items.length, 'entry', 'entries')}
                </span>
              </h2>

              <ul className="overflow-hidden rounded-xl border border-line bg-panel shadow-e1">
                {g.items.map((l, i) => {
                  const meta = LEVELS[l.level] || LEVELS.INFO;
                  const Icon = meta.icon;
                  return (
                    <li
                      key={l.id}
                      className={cn(
                        'relative flex items-start gap-3 py-2.5 pl-4 pr-3 transition-colors hover:bg-raised/40',
                        i > 0 && 'border-t border-line'
                      )}
                    >
                      <span className={cn('absolute inset-y-0 left-0 w-[3px]', meta.rail)} aria-hidden="true" />

                      <time
                        dateTime={l.createdAt}
                        title={absTime(l.createdAt)}
                        className="mt-px w-[68px] shrink-0 font-mono text-2xs tnum text-fg-faint"
                      >
                        {clockTime(l.createdAt)}
                      </time>

                      <Icon
                        size={14}
                        aria-hidden="true"
                        className={cn(
                          'mt-px shrink-0',
                          l.level === 'ERROR' ? 'text-down'
                            : l.level === 'WARN' ? 'text-warn'
                            : l.level === 'AUDIT' ? 'text-brand'
                            : 'text-fg-ghost'
                        )}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug text-fg">{l.message}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-3xs text-fg-faint">
                          <span className="sr-only">Level: {meta.label}.</span>
                          <span className="font-mono uppercase tracking-wide text-fg-ghost">{l.category}</span>
                          {l.user?.username && (
                            <>
                              <span className="text-fg-ghost" aria-hidden="true">·</span>
                              <span>by {l.user.username}</span>
                            </>
                          )}
                          <span className="text-fg-ghost" aria-hidden="true">·</span>
                          <span className="tnum">{relTime(l.createdAt)}</span>
                        </div>
                      </div>

                      <Badge tone={meta.tone} size="sm" className="mt-px hidden shrink-0 sm:inline-flex">
                        {meta.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Activity pages">
          <p className="text-2xs tnum text-fg-faint">
            Page {data.page} of {pages} · {num(data.total)} {plural(data.total, 'entry', 'entries')}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={data.page <= 1}
              onClick={() => load(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconRight={ChevronRight}
              disabled={data.page >= pages}
              onClick={() => load(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
