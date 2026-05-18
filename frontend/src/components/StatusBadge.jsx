export default function StatusBadge({ status }) {
  const s = (status || 'UNKNOWN').toLowerCase();
  const cls = s === 'online' ? 'badge-online' : s === 'offline' ? 'badge-offline' : 'badge-unknown';
  const dot = s === 'online' ? 'dot-online' : s === 'offline' ? 'dot-offline' : 'dot-unknown';
  return <span className={cls}><span className={`dot ${dot}`}/>{s}</span>;
}
