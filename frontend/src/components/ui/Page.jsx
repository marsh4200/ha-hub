import cn from '../../lib/cn';

/**
 * Page header.
 *
 * Every screen opens the same way: a short kicker naming the area, the page
 * title, one line explaining what the screen is for, then actions on the right.
 * Consistency here is most of what makes a multi-page app feel like one product
 * rather than a set of screens built at different times.
 */
export function PageHeader({ kicker, title, description, actions, meta, className }) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        {kicker && <div className="eyebrow mb-1.5">{kicker}</div>}
        <h1 className="font-display text-[26px] font-semibold leading-none tracking-tight text-fg sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{description}</p>
        )}
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Section header with a rule that runs to the edge.
 *
 * The rule is what makes banded lists (attention / updates / healthy) read as
 * genuinely separate groups rather than as one long list with subtitles.
 */
export function SectionHeader({ icon, label, count, note, actions, className }) {
  return (
    <div className={cn('mb-3 flex items-center gap-2.5', className)}>
      {icon && <span className="grid shrink-0 place-items-center">{icon}</span>}
      <h2 className="text-2xs font-semibold uppercase tracking-[0.12em] text-fg-muted">{label}</h2>
      {count != null && (
        <span className="rounded border border-line bg-raised px-1.5 py-px font-mono text-3xs tnum text-fg-faint">
          {count}
        </span>
      )}
      {note && <span className="hidden truncate text-2xs text-fg-faint sm:inline">{note}</span>}
      <span className="h-px min-w-4 flex-1 bg-line" aria-hidden="true" />
      {actions}
    </div>
  );
}

/** Sticky-ish row that groups search, filters and view controls. */
export function Toolbar({ className, children }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-2 shadow-e1',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Segmented control — a small set of mutually exclusive choices where all the
 * options are worth showing. Used for view density and log level, where a
 * dropdown would hide the very thing the user is trying to compare.
 */
export function SegmentedControl({ value, onChange, options, size = 'md', label, className }) {
  const pad = size === 'sm' ? 'h-7 px-2 text-2xs' : 'h-8 px-2.5 text-xs';
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-lg border border-line bg-ink/50 p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title || o.label}
            aria-label={o.title || o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              'focus-ring inline-flex items-center gap-1.5 rounded-md font-medium transition-colors duration-150',
              pad,
              active
                ? 'bg-raised text-fg shadow-e1'
                : 'text-fg-faint hover:text-fg-muted'
            )}
          >
            {Icon && <Icon size={13} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filter chip. Carries its own count so the toolbar states the shape of the
 * fleet even before you click anything.
 */
export function FilterChip({ active, onClick, label, count, dot, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-150',
        active
          ? 'border-brand/45 bg-brand/12 text-brand'
          : 'border-line bg-transparent text-fg-muted hover:border-line-strong hover:text-fg',
        className
      )}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: dot }}
          aria-hidden="true"
        />
      )}
      {label}
      {count != null && (
        <span className={cn('font-mono tnum', active ? 'text-brand/70' : 'text-fg-ghost')}>{count}</span>
      )}
    </button>
  );
}

export default PageHeader;
