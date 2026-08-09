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

/* ── Presentation helpers ─────────────────────────────────────────────────
   Added with the v2 interface. The triage logic above is unchanged — these
   only describe how a band is drawn, so the rules and the rendering stay in
   one file and cannot drift apart. */

/** Absolute timestamp, for tables and audit trails where "3h ago" is not enough. */
export function absTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

/** Clock time only — the date is usually implied by the group heading. */
export function clockTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function dayLabel(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const today = new Date();
  const yday = new Date(today);
  yday.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(dt, today)) return 'Today';
  if (same(dt, yday)) return 'Yesterday';
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export function plural(n, one, many) {
  return Number(n) === 1 ? one : (many || `${one}s`);
}

/**
 * How each triage band is presented. One definition, used by the card, the
 * table row, the dashboard sections and the filter chips, so a band can never
 * be green in one place and grey in another.
 */
export const TRIAGE_META = {
  down: { label: 'Offline',       tone: 'down',    rail: 'rail-down', color: '#FB7185', order: 0 },
  warn: { label: 'Action needed', tone: 'warn',    rail: 'rail-warn', color: '#FBBF24', order: 1 },
  info: { label: 'Update ready',  tone: 'brand',   rail: 'rail-info', color: '#38BDF8', order: 2 },
  idle: { label: 'Not checked',   tone: 'neutral', rail: 'rail-idle', color: '#64748B', order: 3 },
  live: { label: 'Healthy',       tone: 'live',    rail: 'rail-live', color: '#34D399', order: 4 },
};

/** Shared free-text match so search behaves identically on every screen. */
export function matchesSite(c, term) {
  const t = (term || '').trim().toLowerCase();
  if (!t) return true;
  return (
    (c.name || '').toLowerCase().includes(t) ||
    (c.locationName || '').toLowerCase().includes(t) ||
    (c.url || '').toLowerCase().includes(t) ||
    (c.hostname || '').toLowerCase().includes(t) ||
    (c.group || '').toLowerCase().includes(t) ||
    (c.haVersion || '').toLowerCase().includes(t) ||
    (c.notes || '').toLowerCase().includes(t) ||
    (c.tags || []).some((x) => (x || '').toLowerCase().includes(t))
  );
}
