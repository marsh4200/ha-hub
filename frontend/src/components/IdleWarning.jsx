import { Clock } from 'lucide-react';
import { useIdleLogout } from '../hooks/useIdleLogout';
import { Modal, Button } from './ui';

/**
 * Inactivity warning.
 *
 * Presentational only — the hook owns all the timing. The countdown is the
 * loudest thing in the dialog because it is the only part that changes, and
 * the whole overlay stays dismissible by moving the mouse, which is what most
 * people will do instinctively before reading anything.
 */
export default function IdleWarning() {
  const { warningSecondsLeft, stayLoggedIn } = useIdleLogout();
  if (warningSecondsLeft == null) return null;

  return (
    <Modal
      open
      size="sm"
      layer="z-[160]"
      icon={Clock}
      tone="danger"
      title="You're about to be signed out"
      onClose={stayLoggedIn}
      footer={
        <Button variant="primary" fullWidth onClick={stayLoggedIn}>
          Stay signed in
        </Button>
      }
    >
      <div className="text-center">
        <p
          className="font-display text-5xl font-semibold leading-none tnum text-warn"
          role="timer"
          aria-live="assertive"
        >
          {warningSecondsLeft}
          <span className="text-2xl text-fg-faint">s</span>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          HA-Hub signs you out automatically after a period of inactivity. Move the mouse, press a
          key or use the button below to stay signed in.
        </p>
      </div>
    </Modal>
  );
}
