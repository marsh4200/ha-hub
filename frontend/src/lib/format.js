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
 * Triage — health only.
 *
 * A band is about whether someone has to *do* something, not about whether
 * anything at all is noteworthy. A site running perfectly with a pending core
 * update is still a site running perfectly, and a handful of unavailable
 * entities is normal on any real installation — a Zigbee bulb switched off at
 * the wall, a phone that left the property, an integration whose cloud service
 * retired. None of that is a fault, so none of it colours the rail.
 *
 *   down   — offline. Nothing else matters until this is fixed.
 *   warn   — reachable but genuinely broken: token rejected, token unreadable,
 *            or HA itself stopping / not running.
 *   info   — healthy, with something worth knowing: an update is available.
 *   live   — healthy and quiet.
 *   idle   — never yet checked.
 */
export function triage(c) {
  if (c.status === 'OFFLINE') return 'down';
  if (c.status === 'UNKNOWN' || !c.status) return 'idle';
  if (faults(c).length) return 'warn';
  if (notes(c).length) return 'info';
  return 'live';
}

/** Bands that mean a person has to intervene. Drives the "Needs attention" section. */
export const NEEDS_ACTION = ['down', 'warn'];

export function needsAction(c) {
  return NEEDS_ACTION.includes(triage(c));
}

/**
 * Real problems. Something is wrong and HA-Hub cannot fix it by waiting.
 * `haState` of STARTING is deliberately excluded — that resolves itself.
 */
export function faults(c) {
  const out = [];
  if (c.status === 'OFFLINE') { out.push('Offline'); return out; }
  if (c.haTokenStatus === 'UNAUTHORIZED') out.push('Token rejected');
  if (c.haTokenStatus === 'DECRYPT_FAILED') out.push('Token unreadable');

  const state = (c.haState || '').toUpperCase();
  if (state && state !== 'RUNNING' && state !== 'STARTING') {
    out.push(`HA is ${state.toLowerCase().replace(/_/g, ' ')}`);
  }
  return out;
}

/**
 * Worth knowing, but not a fault. These never change the band above `info`,
 * never turn a rail amber and never pull a site into "Needs attention".
 */
export function notes(c) {
  const out = [];
  if (c.status !== 'ONLINE') return out;

  if (c.updateAvailable) {
    out.push(c.pendingUpdates > 1 ? `${c.pendingUpdates} updates available` : 'Update available');
  }
  if ((c.haState || '').toUpperCase() === 'STARTING') out.push('Starting up');
  return out;
}

/**
 * Kept for anything still asking for a single flat list. Faults first so the
 * important line reads first regardless of where it is rendered.
 */
export function triageReasons(c) {
  return [...faults(c), ...notes(c)];
}

export const RAIL = {
  live: 'rail-live',
  down: 'rail-down',
  warn: 'rail-warn',
  info: 'rail-info',
  idle: 'rail-idle',
};
