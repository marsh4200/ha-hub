// Auto-logout after user inactivity, with a warning popup before logout.
// "Activity" = mousemove, mousedown, keydown, touchstart, scroll, wheel.
// Background API calls and socket events do NOT count.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isUpdatingNow } from '../context/UpdateContext.jsx';

const IDLE_MS    = 4 * 60 * 1000;  // 4 minutes total
const WARN_MS    = 30 * 1000;      // 30 sec warning before logout
const CHECK_MS   = 1000;           // tick every second so countdown is smooth

export function useIdleLogout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastActivity = useRef(Date.now());
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(null);

  // Reset timer on any user activity
  useEffect(() => {
    if (!user) return;
    const reset = () => { lastActivity.current = Date.now(); };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, reset));
  }, [user]);

  // Tick: every second, decide whether to show warning or logout
  useEffect(() => {
    if (!user) return;
    // Don't log out on the login/setup pages
    if (location.pathname === '/login' || location.pathname === '/setup') return;

    const interval = setInterval(() => {
      // If an update is in progress, the API will be down — don't surprise-logout
      if (isUpdatingNow()) {
        lastActivity.current = Date.now();
        setWarningSecondsLeft(null);
        return;
      }

      const idle = Date.now() - lastActivity.current;

      if (idle >= IDLE_MS) {
        // Time's up — logout
        setWarningSecondsLeft(null);
        (async () => {
          try { await logout(); } catch (_) {}
          navigate('/login?reason=idle', { replace: true });
        })();
      } else if (idle >= IDLE_MS - WARN_MS) {
        // Show the warning with countdown
        const remaining = Math.ceil((IDLE_MS - idle) / 1000);
        setWarningSecondsLeft(remaining);
      } else {
        // Activity recent — make sure popup is hidden
        setWarningSecondsLeft(null);
      }
    }, CHECK_MS);
    return () => clearInterval(interval);
  }, [user, logout, navigate, location.pathname]);

  // Manually dismiss the warning (clicking "Stay logged in")
  function stayLoggedIn() {
    lastActivity.current = Date.now();
    setWarningSecondsLeft(null);
  }

  return { warningSecondsLeft, stayLoggedIn };
}
