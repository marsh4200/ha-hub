import cn from '../lib/cn';

/**
 * The mark: a roof over a grid of sites.
 *
 * Home Assistant's own identity is the house; what HA-Hub adds is that there
 * are many of them under one roof. The grid squares light up in sequence at a
 * glance-able size, which is exactly what the product does.
 */
export function BrandMark({ size = 20, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Roof */}
      <path
        d="M2.6 10.4 12 3l9.4 7.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Fleet grid beneath it — four managed sites */}
      <rect x="6.4"  y="12.5" width="4.2" height="4.2" rx="1.1" fill="currentColor" opacity="0.95" />
      <rect x="13.4" y="12.5" width="4.2" height="4.2" rx="1.1" fill="currentColor" opacity="0.55" />
      <rect x="6.4"  y="18.1" width="4.2" height="2.8" rx="1.1" fill="currentColor" opacity="0.35" />
      <rect x="13.4" y="18.1" width="4.2" height="2.8" rx="1.1" fill="currentColor" opacity="0.7"  />
    </svg>
  );
}

/** Mark in its tile, optionally with the wordmark beside it. */
export function BrandLockup({ compact = false, tagline = 'Home Assistant fleet', size = 'md', className }) {
  const tile = size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl';
  const glyph = size === 'sm' ? 15 : 19;

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center border border-brand/25 bg-brand/10 text-brand',
          tile
        )}
      >
        <BrandMark size={glyph} />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-semibold leading-none tracking-tight text-fg">
            HA<span className="text-brand">·</span>Hub
          </span>
          {tagline && (
            <span className="mt-1 block truncate text-3xs uppercase tracking-[0.14em] text-fg-faint">
              {tagline}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export default BrandMark;
