export function relTime(d, now = Date.now()) {
  if (!d) return 'never';
  const s = Math.floor((now - new Date(d).getTime()) / 1000);
  if (s < 0) return 'just now';
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function num(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-ZA');
}

export function bytes(b) {
  if (b === null || b === undefined) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = Number(b);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function hostOf(url) {
  try { return new URL(url).host; } catch { return url; }
}

/**
 * Triage. This drives both the card rail colour and the dashboard ordering,
 * so the fleet sorts itself by what actually needs a person.
 *
 *   down   — offline. Nothing else matters until this is fixed.
 *   warn   — online but something is wrong or waiting: token rejected,
 *            updates pending, or entities sitting unavailable.
 *   live   — online and clean.
 *   idle   — never yet checked.
 */
export function triage(c) {
  if (c.status === 'OFFLINE') return 'down';
  if (c.status === 'UNKNOWN' || !c.status) return 'idle';

  const reasons = [];
  if (c.haTokenStatus === 'UNAUTHORIZED') reasons.push('Token rejected');
  if (c.haTokenStatus === 'DECRYPT_FAILED') reasons.push('Token unreadable');
  if (c.updateAvailable) {
    reasons.push(c.pendingUpdates > 1 ? `${c.pendingUpdates} updates` : '1 update');
  }
  if (c.unavailableCount > 0) {
    reasons.push(`${c.unavailableCount} unavailable`);
  }
  if (c.haState && c.haState !== 'RUNNING') reasons.push(c.haState.toLowerCase());

  return reasons.length ? 'warn' : 'live';
}

export function triageReasons(c) {
  const reasons = [];
  if (c.status === 'OFFLINE') { reasons.push('Offline'); return reasons; }
  if (c.haTokenStatus === 'UNAUTHORIZED') reasons.push('Token rejected');
  if (c.haTokenStatus === 'DECRYPT_FAILED') reasons.push('Token unreadable');
  if (c.updateAvailable) reasons.push(c.pendingUpdates > 1 ? `${c.pendingUpdates} updates pending` : '1 update pending');
  if (c.unavailableCount > 0) reasons.push(`${c.unavailableCount} entities unavailable`);
  if (c.haState && c.haState !== 'RUNNING') reasons.push(`HA is ${c.haState.toLowerCase()}`);
  return reasons;
}

export const RAIL = { live: 'rail-live', down: 'rail-down', warn: 'rail-warn', idle: 'rail-idle' };
