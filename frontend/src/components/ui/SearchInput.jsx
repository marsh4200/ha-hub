import { forwardRef, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import cn from '../../lib/cn';

/**
 * Fleet search.
 *
 * Three things a plain <input> does not do and this does: it can be reached
 * from anywhere with "/", it can be abandoned with Escape without touching the
 * mouse, and it reports how many rows survived the filter. On a page listing
 * dozens of sites, the count is the part that tells you whether your search
 * term was any good.
 */
export const SearchInput = forwardRef(function SearchInput(
  {
    value,
    onChange,
    placeholder = 'Search…',
    resultCount,
    totalCount,
    shortcut = true,
    className,
    'aria-label': ariaLabel = 'Search',
    ...rest
  },
  forwardedRef
) {
  const innerRef = useRef(null);
  const ref = forwardedRef || innerRef;

  useEffect(() => {
    if (!shortcut) return undefined;
    function onKey(e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.activeElement?.isContentEditable) return;
      e.preventDefault();
      ref.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut, ref]);

  const showing = value && resultCount != null;

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <Search
        size={15}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-ghost"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
        className={cn(
          'h-9 w-full rounded-lg border border-line bg-ink/70 pl-9 text-sm text-fg placeholder:text-fg-ghost',
          'transition-colors duration-150 hover:border-line-strong',
          'focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20',
          '[&::-webkit-search-cancel-button]:appearance-none',
          value ? 'pr-9' : 'pr-16'
        )}
        {...rest}
      />

      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="focus-ring absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-fg-faint transition-colors hover:bg-raised hover:text-fg"
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : (
        shortcut && (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-3xs text-fg-ghost sm:block">
            /
          </kbd>
        )
      )}

      {showing && (
        <span className="sr-only" role="status" aria-live="polite">
          {resultCount} of {totalCount} results
        </span>
      )}
    </div>
  );
});

export default SearchInput;
