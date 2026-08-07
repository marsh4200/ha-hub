/**
 * Live / Offline / Unknown pill. The online dot pulses so a glance tells you
 * the page is actually receiving data, not showing a frozen snapshot.
 */
export default function StatusBadge({ status, compact = false }) {
  const s = (status || 'UNKNOWN').toUpperCase();
  const map = {
    ONLINE:  { cls: 'chip-live',    dot: 'dot-online dot-pulse', text: 'Live' },
    OFFLINE: { cls: 'chip-down',    dot: 'dot-offline',          text: 'Offline' },
    UNKNOWN: { cls: 'chip-neutral', dot: 'dot-unknown',          text: 'Not checked' },
  };
  const m = map[s] || map.UNKNOWN;
  return (
    <span className={m.cls}>
      <span className={`dot ${m.dot}`} />
      {!compact && m.text}
    </span>
  );
}
