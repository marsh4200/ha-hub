import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import cn from '../../lib/cn';

/**
 * The one button in the product.
 *
 * Variants encode intent, not decoration:
 *   primary   — the single most likely action on the screen. At most one.
 *   secondary — everything else that is safe.
 *   ghost     — tertiary / in-place actions inside dense rows.
 *   danger    — destructive. Never the default focus target.
 *   subtle    — quiet toolbar toggles that must not compete with content.
 *
 * Only `primary` gets a solid fill. On a dark UI a filled control is loud, so
 * spending it more than once per screen is what makes admin panels feel noisy.
 */
const VARIANTS = {
  primary:
    'bg-brand-dark text-ink font-semibold shadow-e1 hover:bg-brand ' +
    'active:bg-brand-dim disabled:hover:bg-brand-dark',
  secondary:
    'bg-raised text-fg border border-line hover:bg-float hover:border-line-strong',
  ghost:
    'text-fg-muted hover:text-fg hover:bg-raised',
  subtle:
    'bg-transparent text-fg-muted border border-transparent hover:bg-raised hover:text-fg',
  danger:
    'bg-down/12 text-down border border-down/30 hover:bg-down/20 hover:border-down/45',
  outline:
    'bg-transparent text-brand border border-brand/35 hover:bg-brand/10 hover:border-brand/55',
};

const SIZES = {
  xs: 'h-7  px-2   text-2xs gap-1.5 rounded-md',
  sm: 'h-8  px-2.5 text-xs  gap-1.5 rounded-lg',
  md: 'h-9  px-3.5 text-sm  gap-2   rounded-lg',
  lg: 'h-11 px-5   text-sm  gap-2   rounded-lg',
};

const ICON_SIZES = {
  xs: 'h-7  w-7  rounded-md',
  sm: 'h-8  w-8  rounded-lg',
  md: 'h-9  w-9  rounded-lg',
  lg: 'h-11 w-11 rounded-lg',
};

const BASE =
  'inline-flex items-center justify-center font-medium whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,transform] duration-150 ease-snap ' +
  'focus-ring active:scale-[0.985] ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100';

export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const glyph = size === 'lg' ? 16 : size === 'xs' ? 13 : 14;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? (
        <Loader2 size={glyph} className="animate-spin shrink-0" aria-hidden="true" />
      ) : (
        Icon && <Icon size={glyph} className="shrink-0" aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={glyph} className="shrink-0" aria-hidden="true" />}
    </button>
  );
});

/**
 * Square, icon-only button. `label` is mandatory — an icon-only control with
 * no accessible name is invisible to a screen reader and ambiguous to everyone
 * else, so the API refuses to let you forget it.
 */
export const IconButton = forwardRef(function IconButton(
  { variant = 'ghost', size = 'md', icon: Icon, label, loading = false, className, disabled, ...rest },
  ref
) {
  const glyph = size === 'lg' ? 18 : size === 'xs' ? 13 : size === 'sm' ? 14 : 16;
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], ICON_SIZES[size], className)}
      {...rest}
    >
      {loading ? (
        <Loader2 size={glyph} className="animate-spin" aria-hidden="true" />
      ) : (
        <Icon size={glyph} aria-hidden="true" />
      )}
    </button>
  );
});

/** Anchor styled as a button, for links that leave the app. */
export function LinkButton({ variant = 'secondary', size = 'md', icon: Icon, className, children, ...rest }) {
  const glyph = size === 'lg' ? 16 : size === 'xs' ? 13 : 14;
  return (
    <a className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {Icon && <Icon size={glyph} className="shrink-0" aria-hidden="true" />}
      {children}
    </a>
  );
}

export default Button;
