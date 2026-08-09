import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { Button } from './Button';
import { Input } from './Field';

/**
 * Confirmation dialogs.
 *
 * Replaces window.confirm(). Beyond looking like the rest of the product, this
 * buys three things the native dialog cannot: the consequence can be spelled
 * out in full instead of squeezed into one line, the confirm button can be
 * named after the actual action ("Delete site", not "OK"), and genuinely
 * irreversible operations can require the object's name to be typed.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete site?', tone: 'danger' }))) return;
 */
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef(null);

  const confirm = useCallback((opts = {}) => {
    setTyped('');
    setRequest({
      title: 'Are you sure?',
      message: null,
      details: null,
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      tone: 'default', // 'default' | 'danger'
      requireText: null, // string the user must type to enable confirm
      ...opts,
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
    setTyped('');
  }, []);

  const r = request;
  const danger = r?.tone === 'danger';
  const gateOk = !r?.requireText || typed.trim() === r.requireText;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {r && (
        <Modal
          open
          layer="z-[150]"
          size="sm"
          tone={danger ? 'danger' : 'default'}
          icon={danger ? (r.requireText ? Trash2 : AlertTriangle) : HelpCircle}
          title={r.title}
          onClose={() => settle(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => settle(false)}>
                {r.cancelLabel}
              </Button>
              <Button
                variant={danger ? 'danger' : 'primary'}
                disabled={!gateOk}
                onClick={() => settle(true)}
              >
                {r.confirmLabel}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {r.message && (
              <p className="text-sm leading-relaxed text-fg-muted">{r.message}</p>
            )}

            {r.details && (
              <div className="rounded-lg border border-line bg-ink/50 px-3 py-2.5 text-xs leading-relaxed text-fg-muted">
                {r.details}
              </div>
            )}

            {r.requireText && (
              <div>
                <label htmlFor="confirm-gate" className="mb-1.5 block text-xs text-fg-muted">
                  Type <span className="font-mono font-semibold text-fg">{r.requireText}</span> to confirm
                </label>
                <Input
                  id="confirm-gate"
                  value={typed}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && gateOk) settle(true);
                  }}
                  className="font-mono"
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

export default ConfirmProvider;
