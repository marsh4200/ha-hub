import { ExternalLink, Download, RefreshCw, KeyRound } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import VersionChip from './VersionChip.jsx';
import { Badge } from './ui/Badge';
import { IconButton } from './ui/Button';
import { relTime, hostOf, triage, RAIL, faults, num } from '../lib/format';
import cn from '../lib/cn';

/**
 * A site as one dense line.
 *
 * Cards are for browsing a handful; once a fleet passes roughly twenty sites
 * the card grid stops being scannable and starts being scrolling. This is the
 * same information at about a third of the height, with the status rail kept
 * so the two views read identically down the left edge.
 */
export default function SiteRow({ client: c, now, onDownloadBackup, onRefresh, canRefresh, busy }) {
  const t = triage(c);
  const problems = faults(c).filter((f) => f !== 'Offline');

  return (
    <article
      className={cn(
        'rail group flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2.5 pl-4',
        'transition-colors duration-150 hover:border-line-strong hover:bg-raised/40',
        RAIL[t]
      )}
    >
      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex min-w-0 items-center gap-1.5 rounded text-sm font-medium text-fg transition-colors hover:text-brand"
          >
            <span className="truncate">{c.name}</span>
            <ExternalLink size={11} aria-hidden="true" className="shrink-0 text-fg-ghost group-hover:text-brand" />
          </a>
          {!c.hasHaToken && (
            <KeyRound size={11} className="shrink-0 text-fg-ghost" aria-label="No access token linked" />
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-3xs text-fg-faint">{hostOf(c.url)}</p>
      </div>

      {/* Faults — only shown when there are any, so the row stays quiet */}
      {problems.length > 0 && (
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          {problems.slice(0, 2).map((p) => (
            <Badge key={p} tone="warn" size="sm">{p}</Badge>
          ))}
        </div>
      )}

      {/* Entities — a rough sense of scale, only when known */}
      {c.entityCount != null && (
        <span className="hidden w-20 shrink-0 text-right font-mono text-2xs tnum text-fg-faint xl:block">
          {num(c.entityCount)} ent.
        </span>
      )}

      {/* Version */}
      <div className="hidden shrink-0 sm:block">
        <VersionChip client={c} size="sm" />
      </div>

      {/* Freshness */}
      <span className="hidden w-24 shrink-0 text-right font-mono text-2xs tnum text-fg-faint md:block">
        {c.status === 'ONLINE' && c.latencyMs != null ? `${c.latencyMs} ms` : relTime(c.lastSeenAt, now)}
      </span>

      {/* Reachability */}
      <div className="shrink-0">
        <StatusBadge status={c.status} size="sm" compact />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        {c.backupFilename && (
          <IconButton
            icon={Download}
            size="xs"
            label={`Download backup — ${c.backupFilename}`}
            onClick={() => onDownloadBackup?.(c)}
          />
        )}
        {canRefresh && (
          <IconButton
            icon={RefreshCw}
            size="xs"
            label={`Check ${c.name} now`}
            loading={busy}
            onClick={() => onRefresh?.(c)}
          />
        )}
      </div>
    </article>
  );
}
