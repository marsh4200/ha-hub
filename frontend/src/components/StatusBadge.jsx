import { StatusPill } from './ui/Badge';

/**
 * Reachability of a site, as a pill.
 *
 * Kept as a named module so every screen imports the same thing; the rendering
 * itself now lives in the UI kit alongside the other badges.
 */
export default function StatusBadge({ status, compact = false, size = 'md' }) {
  return <StatusPill status={status} compact={compact} size={size} />;
}
