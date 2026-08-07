import { ArrowUpRight } from 'lucide-react';

/**
 * Home Assistant version. When an update is pending the chip turns amber and
 * shows the jump — this is the whole payoff of storing the access token, so it
 * gets the loudest treatment on the card.
 */
export default function VersionChip({ client }) {
  const { haVersion, latestVersion, updateAvailable, pendingUpdates } = client;

  if (!haVersion) {
    return <span className="chip-neutral font-mono">version unknown</span>;
  }

  if (updateAvailable && latestVersion && latestVersion !== haVersion) {
    return (
      <span className="chip-warn font-mono" title={`${pendingUpdates || 1} update(s) pending`}>
        <span className="text-warn/60">{haVersion}</span>
        <ArrowUpRight size={11} className="shrink-0" />
        <span className="font-semibold">{latestVersion}</span>
      </span>
    );
  }

  if (updateAvailable) {
    return (
      <span className="chip-warn font-mono">
        <span>{haVersion}</span>
        <span className="text-warn/70">· {pendingUpdates || 1} pending</span>
      </span>
    );
  }

  return <span className="chip-neutral font-mono">{haVersion}</span>;
}
