import cn from '../../lib/cn';

/**
 * Badges.
 *
 * Tone is meaning, fixed across the whole product:
 *   live  green  — healthy / online / enabled
 *   down  red    — offline / rejected / failed
 *   warn  amber  — someone has to act
 *   brand cyan   — informational; an update, a version, a fact
 *   neutral grey — inactive, unknown, or simply a label
 *
 * A badge never picks a colour to look nice. If two badges on a screen are the
 * same colour they mean the same kind of thing.
 */
const TONES = {
  neutral: 'bg-raised      border-line          text-fg-muted',
  live:    'bg-live/10     border-live/25       text-live',
  down:    'bg-down/10     border-down/25       text-down',
  warn:    'bg-warn/10     border-warn/25       text-warn',
  brand:   'bg-brand/10    border-brand/25      text-brand',
  idle:    'bg-idle/10     border-idle/25       text-fg-faint',
  outline: 'bg-transparent border-line-strong   text-fg-muted',
};

const SIZES = {
  sm: 'px-1.5 py-0.5 text-3xs gap-1',
  md: 'px-2   py-0.5 text-2xs gap-1.5',
};

export function Badge({ tone = 'neutral', size = 'md', icon: Icon, mono = false, className, children, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium tnum whitespace-nowrap',
        TONES[tone],
        SIZES[size],
        mono && 'font-mono',
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 10 : 11} className="shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

const DOT_TONES = {
  live:    'dot-online',
  down:    'dot-offline',
  warn:    'dot-warn',
  idle:    'dot-unknown',
  unknown: 'dot-unknown',
};

/**
 * Bare status dot. The online dot pulses so a glance confirms the page is
 * actually receiving data rather than showing a frozen snapshot.
 */
export function StatusDot({ tone = 'idle', pulse = false, className }) {
  return (
    <span
      className={cn('dot', DOT_TONES[tone] || DOT_TONES.idle, pulse && tone === 'live' && 'dot-pulse', className)}
      aria-hidden="true"
    />
  );
}

/** Dot + word. The standard way a site's reachability is stated. */
export function StatusPill({ status, compact = false, size = 'md' }) {
  const s = (status || 'UNKNOWN').toUpperCase();
  const map = {
    ONLINE:  { tone: 'live',    dot: 'live', text: 'Online',      pulse: true },
    OFFLINE: { tone: 'down',    dot: 'down', text: 'Offline',     pulse: false },
    UNKNOWN: { tone: 'neutral', dot: 'idle', text: 'Not checked', pulse: false },
  };
  const m = map[s] || map.UNKNOWN;

  return (
    <Badge tone={m.tone} size={size} aria-label={`Status: ${m.text}`}>
      <StatusDot tone={m.dot} pulse={m.pulse} />
      {!compact && m.text}
    </Badge>
  );
}

export default Badge;
