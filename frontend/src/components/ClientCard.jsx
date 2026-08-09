import { ExternalLink, Download, RefreshCw, KeyRound, Boxes, Puzzle, Zap, Gauge } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import VersionChip from './VersionChip.jsx';
import { Badge } from './ui/Badge';
import { IconButton } from './ui/Button';
import { relTime, num, hostOf, triage, RAIL, faults } from '../lib/format';
import cn from '../lib/cn';

/**
 * One Home Assistant site.
 *
 * Reading order is deliberate and fixed, because the point of this card is that
 * you can scan forty of them:
 *
 *   1. name + reachability   — is it up?
 *   2. address               — which one is it?
 *   3. version + faults      — what is it running, what is wrong?
 *   4. metrics               — how big is it?
 *   5. footer                — when did we last hear from it, what can I do?
 *
 * The site name is the link rather than the whole card. Making the entire card
 * an anchor meant every secondary control had to fight it with preventDefault,
 * a keyboard user got one enormous tab stop, and text could not be selected.
 */
export default function ClientCard({ client: c, now, onDownloadBackup, onRefresh, canRefresh, busy }) {
  const t = triage(c);
  const linked = c.hasHaToken;
  const problems = faults(c).filter((f) => f !== 'Offline');

  const haState = (c.haState || '').toUpperCase();
  const starting = haState === 'STARTING';

  return (
    <article
      className={cn(
        'rail group relative flex flex-col rounded-xl border border-line bg-panel shadow-e1',
        'transition-colors duration-150 hover:border-line-strong',
        RAIL[t]
      )}
    >
      <div className="flex-1 p-4 pl-[18px]">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-tight">
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex max-w-full items-center gap-1.5 rounded text-fg transition-colors hover:text-brand"
              >
                <span className="truncate">{c.name}</span>
                <ExternalLink
                  size={12}
                  aria-hidden="true"
                  className="shrink-0 text-fg-ghost transition-colors group-hover:text-brand"
                />
                <span className="sr-only">(opens Home Assistant in a new tab)</span>
              </a>
            </h3>
            <p className="mt-1 truncate font-mono text-2xs text-fg-faint">
              {c.locationName && c.locationName !== c.name ? (
                <>
                  <span className="text-fg-muted">{c.locationName}</span>
                  <span className="text-fg-ghost"> · </span>
                  {hostOf(c.url)}
                </>
              ) : (
                hostOf(c.url)
              )}
            </p>
          </div>
          <StatusBadge status={c.status} />
        </div>

        {/* ── Version and genuine faults ───────────────────────────────
            Unavailable entities are deliberately absent. Every real
            installation carries a few — a bulb off at the wall, a phone that
            left the property, an integration whose cloud service shut down —
            and putting that on the card trains you to ignore the card. The
            count still lives in the site's detail panel for when it matters. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <VersionChip client={c} />
          {starting && <Badge tone="brand">Starting up</Badge>}
          {problems.map((p) => (
            <Badge key={p} tone="warn" icon={p.includes('Token') ? KeyRound : undefined}>
              {p}
            </Badge>
          ))}
        </div>

        {/* ── Metrics ──────────────────────────────────────────────── */}
        {linked && c.entityCount != null ? (
          <dl className="mt-3.5 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-lg border border-line bg-ink/40">
            <Metric icon={Boxes} label="Entities" value={num(c.entityCount)} />
            <Metric icon={Puzzle} label="Integrations" value={num(c.integrationCount)} />
            <Metric icon={Zap} label="Automations" value={num(c.automationCount)} />
          </dl>
        ) : !linked ? (
          <p className="mt-3.5 flex items-start gap-2 rounded-lg border border-dashed border-line bg-ink/40 px-2.5 py-2 text-2xs leading-relaxed text-fg-faint">
            <KeyRound size={12} className="mt-px shrink-0" aria-hidden="true" />
            Add an access token to read version, entity and update data.
          </p>
        ) : c.status === 'ONLINE' ? (
          /* Linked and up, but the detail sweep hasn't landed yet. */
          <div className="mt-3.5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[50px] rounded-none" />
            ))}
          </div>
        ) : (
          /* Offline or never checked — a shimmer here would imply data is on
             its way, which it isn't. Say what's actually true instead. */
          <p className="mt-3.5 rounded-lg border border-dashed border-line bg-ink/40 px-2.5 py-2 text-2xs leading-relaxed text-fg-faint">
            No readings — the last check could not reach this site.
          </p>
        )}

        {/* ── Tags ─────────────────────────────────────────────────── */}
        {c.tags?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1">
            {c.tags.slice(0, 4).map((tag) => (
              <li key={tag} className="rounded border border-line bg-ink/60 px-1.5 py-0.5 text-3xs text-fg-faint">
                {tag}
              </li>
            ))}
            {c.tags.length > 4 && (
              <li className="px-1 py-0.5 text-3xs text-fg-ghost">+{c.tags.length - 4}</li>
            )}
          </ul>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 pl-[18px]">
        <p className="min-w-0 truncate text-2xs tnum text-fg-faint">
          {c.status === 'ONLINE' && c.latencyMs != null ? (
            <span className="inline-flex items-center gap-1.5">
              <Gauge size={11} aria-hidden="true" className="text-fg-ghost" />
              Responded in <span className="text-fg-muted">{c.latencyMs} ms</span>
            </span>
          ) : (
            <>Last seen {relTime(c.lastSeenAt, now)}</>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-0.5">
          {c.backupFilename && (
            <IconButton
              icon={Download}
              size="sm"
              label={`Download backup — ${c.backupFilename}`}
              onClick={() => onDownloadBackup?.(c)}
            />
          )}
          {canRefresh && (
            <IconButton
              icon={RefreshCw}
              size="sm"
              label={`Check ${c.name} now`}
              loading={busy}
              onClick={() => onRefresh?.(c)}
            />
          )}
        </div>
      </footer>
    </article>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 px-2.5 py-2">
      <dt className="flex items-center gap-1 text-3xs uppercase tracking-wide text-fg-ghost">
        <Icon size={10} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-0.5 font-mono text-sm font-medium tnum text-fg">{value}</dd>
    </div>
  );
}
