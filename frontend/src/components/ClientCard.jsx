import { ExternalLink, Download, RefreshCw, AlertTriangle, KeyRound, Boxes, Cpu, Zap } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import VersionChip from './VersionChip.jsx';
import { relTime, num, hostOf, triage, RAIL } from '../lib/format';

/**
 * One Home Assistant site.
 *
 * The whole card is the link to the site — that's the primary action and it
 * should be a big target on a phone. Secondary actions sit in a footer row and
 * stop propagation so they don't open the site by accident.
 */
export default function ClientCard({ client: c, now, onDownloadBackup, onRefresh, canRefresh }) {
  const t = triage(c);
  const linked = c.hasHaToken;
  const tokenBad = c.haTokenStatus === 'UNAUTHORIZED' || c.haTokenStatus === 'DECRYPT_FAILED';

  return (
    <div className={`card rail ${RAIL[t]} animate-riseIn hover:border-line-bright transition-colors group`}>
      <a
        href={c.url}
        target="_blank"
        rel="noreferrer"
        className="block p-4 pl-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate text-[15px] leading-tight">{c.name}</h3>
              <ExternalLink
                size={13}
                className="shrink-0 text-slate-600 group-hover:text-brand transition-colors"
              />
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5 font-mono">
              {c.locationName && c.locationName !== c.name
                ? <><span className="text-slate-400">{c.locationName}</span> · {hostOf(c.url)}</>
                : hostOf(c.url)}
            </div>
          </div>
          <StatusBadge status={c.status} />
        </div>

        {/* Version + attention reasons */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <VersionChip client={c} />
          {tokenBad && (
            <span className="chip-down">
              <KeyRound size={11} />
              {c.haTokenStatus === 'UNAUTHORIZED' ? 'Token rejected' : 'Token unreadable'}
            </span>
          )}
          {c.unavailableCount > 0 && (
            <span className="chip-warn">
              <AlertTriangle size={11} />
              {num(c.unavailableCount)} unavailable
            </span>
          )}
          {c.haState && c.haState !== 'RUNNING' && (
            <span className="chip-warn">{c.haState.toLowerCase()}</span>
          )}
        </div>

        {/* Metrics — only when a token is linked, otherwise there's nothing to show */}
        {linked && c.entityCount != null ? (
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            <Metric icon={<Boxes size={12} />} label="Entities" value={num(c.entityCount)} />
            <Metric icon={<Cpu size={12} />} label="Integrations" value={num(c.integrationCount)} />
            <Metric icon={<Zap size={12} />} label="Automations" value={num(c.automationCount)} />
          </div>
        ) : !linked ? (
          <div className="mt-3.5 flex items-center gap-2 text-xs text-slate-600 bg-bg/50 border border-line rounded-lg px-2.5 py-2">
            <KeyRound size={12} className="shrink-0" />
            <span>Add an access token to read version and entity data</span>
          </div>
        ) : c.status === 'ONLINE' ? (
          /* Linked and up, but the detail sweep hasn't landed yet. */
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {[0, 1, 2].map(i => <div key={i} className="h-[46px] skeleton" />)}
          </div>
        ) : (
          /* Offline or never checked — a shimmer here would imply data is on
             its way, which it isn't. Say what's actually true instead. */
          <div className="mt-3.5 text-xs text-slate-600 bg-bg/50 border border-line rounded-lg px-2.5 py-2">
            No readings yet — last check could not reach this site.
          </div>
        )}

        {/* Tags */}
        {c.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {c.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-2xs text-slate-500 bg-bg border border-line px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </a>

      {/* Footer */}
      <div className="px-4 pl-5 py-2.5 border-t border-line flex items-center justify-between gap-2">
        <div className="text-2xs text-slate-500 tnum truncate">
          {c.status === 'ONLINE' && c.latencyMs != null
            ? <>Responded in <span className="text-slate-400">{c.latencyMs} ms</span></>
            : <>Last seen {relTime(c.lastSeenAt, now)}</>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {c.backupFilename && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDownloadBackup?.(c); }}
              className="btn-ghost !px-2 !py-1 !text-2xs"
              title={`Download backup: ${c.backupFilename}`}
            >
              <Download size={12} /> Backup
            </button>
          )}
          {canRefresh && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRefresh?.(c); }}
              className="btn-ghost !px-2 !py-1"
              title="Check this site now"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="bg-bg/50 border border-line rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-1 text-slate-600 mb-0.5">
        {icon}
        <span className="text-2xs uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="text-sm font-mono font-medium tnum text-slate-200">{value}</div>
    </div>
  );
}
