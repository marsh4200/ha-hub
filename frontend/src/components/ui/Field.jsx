import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import cn from '../../lib/cn';

const CONTROL =
  'w-full bg-ink/70 border rounded-lg text-sm text-fg placeholder:text-fg-ghost ' +
  'transition-colors duration-150 hover:border-line-strong ' +
  'focus:outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20 ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-line';

const SIZES = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3 py-2.5' };

/**
 * Label + control + hint + error, wired together.
 *
 * The wrapper owns the id and the aria-describedby chain so that every form in
 * the product announces its hint and its error without each page having to
 * remember to do it.
 */
export function Field({ label, hint, error, required, htmlFor, className, children, labelSuffix }) {
  const autoId = useId();
  const id = htmlFor || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-fg-faint">
          {label}
          {required && <span className="text-down" aria-hidden="true">*</span>}
          {labelSuffix && (
            <span className="font-normal normal-case tracking-normal text-fg-ghost">{labelSuffix}</span>
          )}
        </label>
      )}

      {typeof children === 'function'
        ? children({ id, 'aria-describedby': cn(hintId, errId) || undefined, 'aria-invalid': !!error || undefined })
        : children}

      {error && (
        <p id={errId} className="mt-1.5 flex items-start gap-1.5 text-xs text-down">
          <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-fg-faint">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ size = 'md', invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(CONTROL, SIZES[size], invalid ? 'border-down/50' : 'border-line', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ size = 'md', invalid, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL, SIZES[size], 'resize-y leading-relaxed', invalid ? 'border-down/50' : 'border-line', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select({ size = 'md', invalid, className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        CONTROL,
        SIZES[size],
        'appearance-none cursor-pointer pr-9 bg-no-repeat',
        invalid ? 'border-down/50' : 'border-line',
        className
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7C92' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.65rem center',
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

/** Password box with a reveal toggle — required on both Login and Setup. */
export const PasswordInput = forwardRef(function PasswordInput({ className, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={shown ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="focus-ring absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-fg-faint transition-colors hover:bg-raised hover:text-fg"
      >
        {shown ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      </button>
    </div>
  );
});

export function Checkbox({ label, description, className, ...rest }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised',
        className
      )}
    >
      <input
        type="checkbox"
        className="focus-ring mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line bg-ink"
        {...rest}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">{label}</span>
        {description && <span className="block truncate text-2xs text-fg-faint">{description}</span>}
      </span>
    </label>
  );
}

/** Grouped fieldset used for the multi-column blocks inside dialogs. */
export function FieldRow({ className, ...rest }) {
  return <div className={cn('grid gap-3 sm:grid-cols-2', className)} {...rest} />;
}

export default Field;
