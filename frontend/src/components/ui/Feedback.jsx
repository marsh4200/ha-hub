import { Loader2, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import cn from '../../lib/cn';

/**
 * Empty states are instructions, not apologies.
 *
 * Every one carries the reason the screen is blank and, wherever an action
 * exists, the way out of it. "Nothing here" on its own is a dead end.
 */
export function EmptyState({ icon: Icon, title, description, action, secondaryAction, className, compact = false }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-panel/40 text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className
      )}
    >
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-raised text-fg-ghost">
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-muted">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className, ...rest }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...rest} />;
}

export function Spinner({ size = 16, className, label = 'Loading' }) {
  return (
    <Loader2
      size={size}
      role="status"
      aria-label={label}
      className={cn('animate-spin text-brand', className)}
    />
  );
}

/** Full-panel loading state used while a route boots. */
export function LoadingPanel({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-20 text-fg-faint', className)}>
      <Spinner size={22} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

const ALERT_TONES = {
  info:    { cls: 'border-brand/25 bg-brand/[0.07] text-brand', icon: Info },
  success: { cls: 'border-live/25  bg-live/[0.07]  text-live',  icon: CheckCircle2 },
  warning: { cls: 'border-warn/25  bg-warn/[0.07]  text-warn',  icon: AlertTriangle },
  error:   { cls: 'border-down/25  bg-down/[0.07]  text-down',  icon: XCircle },
};

/** Inline message tied to a form or a panel — not a floating notification. */
export function Alert({ tone = 'info', title, icon, children, className, action }) {
  const t = ALERT_TONES[tone] || ALERT_TONES.info;
  const Icon = icon || t.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm', t.cls, className)}
    >
      <Icon size={15} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title && 'mt-0.5', 'text-fg-muted')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

const BAR_TONES = { brand: 'bg-brand', live: 'bg-live', warn: 'bg-warn', down: 'bg-down' };

export function ProgressBar({ value = 0, tone = 'brand', label, className, showValue = false }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-fg-muted">{label}</span>
          {showValue && <span className="shrink-0 font-mono tnum text-fg-faint">{pct}%</span>}
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === 'string' ? label : 'Progress'}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-snap', BAR_TONES[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default EmptyState;
