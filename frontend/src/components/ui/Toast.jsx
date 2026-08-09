import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import cn from '../../lib/cn';

/**
 * Toasts.
 *
 * These exist to replace window.alert(), which blocks the page, cannot be
 * styled, and is the single loudest signal that something is a developer tool
 * rather than a product. Errors get a longer life than successes because you
 * usually need to read an error twice.
 */
const ToastContext = createContext(null);

const KINDS = {
  success: { icon: CheckCircle2,   ring: 'border-live/30',  accent: 'text-live',  bar: 'bg-live'  },
  error:   { icon: XCircle,        ring: 'border-down/35',  accent: 'text-down',  bar: 'bg-down'  },
  warning: { icon: AlertTriangle,  ring: 'border-warn/30',  accent: 'text-warn',  bar: 'bg-warn'  },
  info:    { icon: Info,           ring: 'border-brand/30', accent: 'text-brand', bar: 'bg-brand' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind, message, opts = {}) => {
      if (!message) return null;
      const id = ++seq.current;
      const ttl = opts.duration ?? (kind === 'error' ? 7000 : 4000);
      setItems((prev) => [...prev.slice(-3), { id, kind, message, title: opts.title }]);
      if (ttl > 0) window.setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error:   (m, o) => push('error', m, o),
      warning: (m, o) => push('warning', m, o),
      info:    (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+5rem))] sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:items-end sm:pb-4"
          role="region"
          aria-label="Notifications"
        >
          {items.map((t) => {
            const k = KINDS[t.kind] || KINDS.info;
            const Icon = k.icon;
            return (
              <div
                key={t.id}
                role="status"
                aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
                className={cn(
                  'pointer-events-auto relative flex w-full max-w-sm items-start gap-2.5 overflow-hidden rounded-xl border bg-float px-3.5 py-3 shadow-e3 animate-riseIn',
                  k.ring
                )}
              >
                <span className={cn('absolute inset-y-0 left-0 w-[3px]', k.bar)} aria-hidden="true" />
                <Icon size={16} className={cn('mt-px shrink-0', k.accent)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  {t.title && <div className="text-sm font-semibold leading-tight text-fg">{t.title}</div>}
                  <div className={cn('text-[13px] leading-snug', t.title ? 'mt-0.5 text-fg-muted' : 'text-fg')}>
                    {t.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="focus-ring -mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-fg-faint transition-colors hover:bg-raised hover:text-fg"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export default ToastProvider;
