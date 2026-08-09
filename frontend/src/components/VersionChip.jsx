import { ArrowRight } from 'lucide-react';
import { Badge } from './ui/Badge';

/**
 * Home Assistant version.
 *
 * When an update is pending the chip turns cyan and shows the jump. Cyan, not
 * amber: an available update is news, not a fault. The site is still online and
 * still working — it just has somewhere to go next.
 */
export default function VersionChip({ client, size = 'md' }) {
  const { haVersion, latestVersion, updateAvailable, pendingUpdates } = client || {};

  if (!haVersion) {
    return <Badge tone="neutral" size={size} mono>no version</Badge>;
  }

  const many = pendingUpdates > 1;

  if (updateAvailable && latestVersion && latestVersion !== haVersion) {
    return (
      <Badge
        tone="brand"
        size={size}
        mono
        title={many ? `${pendingUpdates} updates available` : `Update available: ${haVersion} → ${latestVersion}`}
      >
        <span className="text-brand/60">{haVersion}</span>
        <ArrowRight size={10} className="shrink-0 text-brand/50" aria-hidden="true" />
        <span className="font-semibold">{latestVersion}</span>
      </Badge>
    );
  }

  if (updateAvailable) {
    return (
      <Badge tone="brand" size={size} mono title={many ? `${pendingUpdates} updates available` : 'Update available'}>
        {haVersion}
        <span className="text-brand/70">· {many ? `${pendingUpdates} updates` : 'update'}</span>
      </Badge>
    );
  }

  return <Badge tone="neutral" size={size} mono>{haVersion}</Badge>;
}
