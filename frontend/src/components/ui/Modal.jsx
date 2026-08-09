import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import cn from '../../lib/cn';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * The dialog for the whole product.
 *
 * Everything an accessible dialog owes the user is handled once, here, rather
 * than being re-implemented (and forgotten) on each page: Escape closes, focus
 * moves in and is trapped, focus returns to whatever opened it, the background
 * stops scrolling, and the surface is labelled for assistive tech.
 *
 * On phones it docks to the bottom as a sheet, because a centred box with a
 * keyboard open is unusable — the fields end up behind the keyboard.
 */
export function Modal({
  open = true,
  onClose,
  title,
  description,
  icon: Icon,
  size = 'md',
  footer,
  children,
  closeOnBackdrop = true,
  tone = 'default', // 'default' | 'danger'
  // Confirmations are routinely raised *from* an open dialog, so the stacking
  // order has to be settable rather than baked in.
  layer = 'z-[100]',
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    document.body.classList.add('overflow-hidden');
    document.addEventListener('keydown', handleKey, true);

    // Focus the first meaningful control, skipping the close button so the
    // dialog opens on its content rather than on "dismiss".
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (n) => !n.hasAttribute('data-modal-dismiss')
      );
      (nodes[0] || panel).focus({ preventScroll: true });
    }, 40);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', handleKey, true);
      document.body.classList.remove('overflow-hidden');
      const el = restoreRef.current;
      if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
    };
  }, [open, handleKey]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-end justify-center overflow-y-auto bg-black/70 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-6',
        layer
      )}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-float border-line-strong shadow-e3 outline-none',
          'max-h-[92vh] overflow-y-auto rounded-t-2xl border-x border-t animate-sheetUp',
          'sm:my-auto sm:max-h-[86vh] sm:rounded-2xl sm:border sm:animate-scaleIn',
          WIDTHS[size]
        )}
      >
        {(title || onClose) && (
          <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-float/95 px-4 py-3.5 backdrop-blur sm:px-5">
            {Icon && (
              <span
                className={cn(
                  'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                  tone === 'danger'
                    ? 'border-down/30 bg-down/10 text-down'
                    : 'border-line bg-raised text-brand'
                )}
              >
                <Icon size={15} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold leading-tight text-fg">{title}</h2>
              {description && (
                <p id="modal-description" className="mt-1 text-xs leading-relaxed text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            {onClose && (
              <IconButton
                icon={X}
                label="Close dialog"
                size="sm"
                onClick={onClose}
                data-modal-dismiss=""
                className="-mr-1 shrink-0"
              />
            )}
          </div>
        )}

        <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>

        {footer && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-float/95 px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5 sm:pb-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
