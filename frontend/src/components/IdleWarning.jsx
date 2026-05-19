import { useIdleLogout } from '../hooks/useIdleLogout';
import { Clock } from 'lucide-react';

// Global popup that shows the inactivity warning + countdown.
// Pure presentational — hook handles the timing logic.
export default function IdleWarning() {
  const { warningSecondsLeft, stayLoggedIn } = useIdleLogout();
  if (warningSecondsLeft == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4 animate-fadein"
      onClick={stayLoggedIn}
    >
      <div
        className="card p-6 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/15 grid place-items-center">
          <Clock className="text-amber-400" size={22}/>
        </div>
        <h3 className="font-semibold mb-1">You're about to be logged out</h3>
        <p className="text-sm text-slate-400 mb-4">
          Due to inactivity, you'll be signed out in
          {' '}<span className="font-mono text-amber-400 text-lg">{warningSecondsLeft}s</span>
        </p>
        <button className="btn-primary w-full justify-center" onClick={stayLoggedIn}>
          Stay logged in
        </button>
        <p className="text-xs text-slate-500 mt-3">Click anywhere or move your mouse to stay.</p>
      </div>
    </div>
  );
}
