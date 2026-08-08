import { ArrowUpRight } from 'lucide-react';

/**
 * Home Assistant version.
 *
 * When an update is pending the chip turns cyan and shows the jump. Cyan, not
 * amber: an available update is news, not a fault. The site is still online and
 * still working — it just has somewhere to go next.
 */
export default function VersionChip({ client }) {
  const { haVersion, latestVersion, updateAvailable, pendingUpdates } = client;

  if (!haVersion) {
    return <span className="chip-neutral font-mono">version unknown</span>;
  }

  if (updateAvailable && latestVersion && latestVersion !== haVersion) {
    return (
      <span
        className="chip-info font-mono"
        title={pendingUpdates > 1 ? `${pendingUpdates} updates available` : 'Update available'}
      >
        <span className="text-brand/60">{haVersion}</span>
        <ArrowUpRight size={11} className="shrink-0" />
        <span className="font-semibold">{latestVersion}</span>
      </span>
    );
  }

  if (updateAvailable) {
    return (
      <span className="chip-info font-mono" title="Update available">
        <span>{haVersion}</span>
        <span className="text-brand/70">
          · {pendingUpdates > 1 ? `${pendingUpdates} available` : 'update available'}
        </span>
      </span>
    );
  }

  return <span className="chip-neutral font-mono">{haVersion}</span>;
}
