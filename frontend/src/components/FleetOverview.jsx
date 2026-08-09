import { AlertTriangle, ArrowUpCircle, CircleSlash, KeyRound, Wifi, HelpCircle } from 'lucide-react';
import { StatTile } from './ui/Card';
import { num, plural } from '../lib/format';
import cn from '../lib/cn';

/**
 * The answer to "how is my fleet doing?", in one panel.
 *
 * The old FleetBar put a bar, a set of counts and six filter buttons in one
 * box, which meant nothing in it was dominant and the eye had nowhere to land.
 * This splits the job in two:
 *
 *   left  — the verdict. One sentence and one proportion, readable across a
 *           room, answering the question without any counting.
 *   right — the ledger. Six numbers, each also the filter for its own group,
 *           so reading a number and acting on it is the same gesture.
 *
 * Reachability (online / offline / unchecked) and workload (attention /
 * updates) are kept as separate rows because they are separate questions. A
 * site with a pending update is not a site with a problem, and merging the two
 * makes the attention number meaningless within a week of running a real fleet.
 */
export default function FleetOverview({ stats, attention, updates, filter, onFilter, loading }) {
  const total = stats.total || 0;
  const online = stats.online || 0;
  const offline = stats.offline || 0;
  const unknown = stats.unknown || 0;
  const linked = stats.linked || 0;
  const pct = total ? Math.round((online / total) * 100) : 0;

  const segments = [
    { key: 'online',  label: 'Online',      value: online,  color: '#34D399' },
    { key: 'offline', label: 'Offline',     value: offline, color: '#FB7185' },
    { key: 'unknown', label: 'Not checked', value: unknown, color: '#475569' },
  ];

  const verdict = (() => {
    if (total === 0) return { text: 'No sites registered yet.', tone: 'text-fg-muted' };
    if (offline > 0) return {
      text: `${num(offline)} ${plural(offline, 'site is', 'sites are')} unreachable.`,
      tone: 'text-down',
    };
    if (attention > 0) return {
      text: `${num(attention)} ${plural(attention, 'site needs', 'sites need')} attention.`,
      tone: 'text-warn',
    };
    if (updates > 0) return {
      text: `Everything is up. ${num(updates)} ${plural(updates, 'update is', 'updates are')} ready to install.`,
      tone: 'text-brand',
    };
    return { text: 'Every site is online and up to date.', tone: 'text-live' };
  })();

  const toggle = (key) => onFilter(filter === key ? 'all' : key);

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-e1"
      aria-label="Fleet overview"
    >
      <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* ── Verdict ─────────────────────────────────────────────── */}
        <div className="bg-panel p-4 sm:p-5">
          <p className="eyebrow">Fleet health</p>

          {loading && total === 0 ? (
            <div className="mt-3 space-y-3">
              <div className="skeleton h-10 w-40" />
              <div className="skeleton h-2 w-full" />
              <div className="skeleton h-4 w-56" />
            </div>
          ) : (
            <>
              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-display text-[40px] font-semibold leading-none tnum text-fg">
                  {num(online)}
                </span>
                <span className="font-display text-lg leading-none text-fg-ghost">/</span>
                <span className="font-display text-lg leading-none tnum text-fg-muted">{num(total)}</span>
                <span className="text-xs uppercase tracking-wider text-fg-faint">
                  {plural(total, 'site', 'sites')} online
                </span>
                {total > 0 && (
                  <span className="ml-auto font-mono text-sm tnum text-fg-muted">{pct}%</span>
                )}
              </div>

              {/* Proportional bar. You read "mostly green with a red sliver"
                  before you read a single number. */}
              <div className="mt-3.5 flex h-2.5 gap-px overflow-hidden rounded-full bg-ink">
                {total > 0 ? (
                  segments
                    .filter((s) => s.value > 0)
                    .map((s) => (
                      <span
                        key={s.key}
                        title={`${s.label}: ${s.value}`}
                        className="transition-[width] duration-500 ease-snap"
                        style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                      />
                    ))
                ) : (
                  <span className="w-full bg-line" />
                )}
              </div>

              <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {segments.map((s) => (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: s.color }}
                      aria-hidden="true"
                    />
                    <dt className="text-2xs text-fg-faint">{s.label}</dt>
                    <dd className="font-mono text-2xs tnum text-fg-muted">{num(s.value)}</dd>
                  </div>
                ))}
              </dl>

              <p className={cn('mt-4 border-t border-line pt-3.5 text-sm font-medium', verdict.tone)}>
                {verdict.text}
              </p>
            </>
          )}
        </div>

        {/* ── Ledger ──────────────────────────────────────────────── */}
        <div className="bg-panel p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">Breakdown</p>
            {filter !== 'all' && (
              <button
                type="button"
                onClick={() => onFilter('all')}
                className="focus-ring rounded text-2xs font-medium text-brand transition-colors hover:text-brand-dark"
              >
                Show all sites
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile
              label="Online" value={num(online)} tone="live" icon={Wifi}
              active={filter === 'online'} onClick={() => toggle('online')}
            />
            <StatTile
              label="Offline" value={num(offline)} tone={offline > 0 ? 'down' : 'idle'} icon={CircleSlash}
              active={filter === 'offline'} onClick={() => toggle('offline')}
            />
            <StatTile
              label="Not checked" value={num(unknown)} tone="idle" icon={HelpCircle}
              active={filter === 'unknown'} onClick={() => toggle('unknown')}
            />
            <StatTile
              label="Needs action" value={num(attention)} tone={attention > 0 ? 'warn' : 'idle'} icon={AlertTriangle}
              active={filter === 'attention'} onClick={() => toggle('attention')}
              hint={attention > 0 ? 'Offline or faulted' : 'Nothing to do'}
            />
            <StatTile
              label="Updates" value={num(updates)} tone={updates > 0 ? 'brand' : 'idle'} icon={ArrowUpCircle}
              active={filter === 'updates'} onClick={() => toggle('updates')}
              hint={updates > 0 ? 'Healthy, upgrade ready' : 'All current'}
            />
            <StatTile
              label="Linked" value={num(linked)} tone={linked === total && total > 0 ? 'live' : 'idle'} icon={KeyRound}
              active={filter === 'unlinked'} onClick={() => toggle('unlinked')}
              hint={total - linked > 0 ? `${num(total - linked)} without a token` : 'Token on every site'}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
