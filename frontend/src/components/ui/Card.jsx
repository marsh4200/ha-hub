import cn from '../../lib/cn';

/**
 * Surfaces.
 *
 * `tone` selects a rung on the elevation ladder rather than a look:
 *   panel — the default resting surface for content
 *   sunken — a well *inside* a panel (metrics, code, nested lists)
 *   float — something genuinely above the page
 *
 * Nothing here glows or gradients. Separation comes from the border and one
 * step of lightness, which is what keeps a dense page from turning into a
 * field of floating rounded rectangles.
 */
const TONES = {
  panel:  'bg-panel  border border-line shadow-e1',
  sunken: 'bg-ink/50 border border-line',
  float:  'bg-float  border border-line-strong shadow-e2',
  ghost:  'bg-transparent border border-line',
};

export function Card({ tone = 'panel', interactive = false, className, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={cn(
        'rounded-xl',
        TONES[tone],
        interactive &&
          'transition-colors duration-150 hover:border-line-strong hover:bg-raised/40',
        className
      )}
      {...rest}
    />
  );
}

export function CardHeader({ title, description, icon: Icon, actions, className, children }) {
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3.5 sm:px-5 border-b border-line', className)}>
      {Icon && (
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-raised border border-line text-brand">
          <Icon size={14} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <h2 className="text-sm font-semibold text-fg leading-tight">{title}</h2>}
        {description && <p className="mt-1 text-xs text-fg-muted leading-relaxed">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }) {
  return <div className={cn('p-4 sm:p-5', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5',
        className
      )}
      {...rest}
    />
  );
}

const STAT_TONES = {
  default: { value: 'text-fg',    accent: 'text-fg-faint' },
  live:    { value: 'text-live',  accent: 'text-live' },
  down:    { value: 'text-down',  accent: 'text-down' },
  warn:    { value: 'text-warn',  accent: 'text-warn' },
  brand:   { value: 'text-brand', accent: 'text-brand' },
  idle:    { value: 'text-fg-muted', accent: 'text-fg-faint' },
};

/**
 * One number with its label. Optionally a filter button.
 *
 * The value uses the display face at a size that reads from across a desk;
 * the label stays small and quiet so the number is what you see first.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  active = false,
  onClick,
  className,
}) {
  const t = STAT_TONES[tone] || STAT_TONES.default;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'group relative rounded-xl border px-3.5 py-3 text-left transition-colors duration-150',
        active
          ? 'border-brand/45 bg-brand/[0.07]'
          : 'border-line bg-panel hover:border-line-strong',
        onClick && 'focus-ring cursor-pointer',
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} className={cn('shrink-0', t.accent)} aria-hidden="true" />}
        <span className="text-2xs font-semibold uppercase tracking-wider text-fg-faint truncate">
          {label}
        </span>
      </div>
      <div className={cn('mt-1.5 font-display text-2xl font-semibold leading-none tnum', t.value)}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-2xs text-fg-faint truncate">{hint}</div>}
    </Tag>
  );
}

export default Card;
