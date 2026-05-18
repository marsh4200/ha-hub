// Tracks whether an update is in progress, globally.
// Used by api.js to avoid kicking the user out during the brief downtime
// while the container restarts.
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';

const UpdateContext = createContext({ updating: false, state: null });

// Singleton flag readable by axios interceptor (which can't use React hooks)
let _isUpdating = false;
export function isUpdatingNow() { return _isUpdating; }

export function UpdateProvider({ children }) {
  const [state, setState] = useState(null);
  const [updating, setUpdating] = useState(false);
  const pollRef = useRef(null);

  function setUpdatingFlag(v) {
    setUpdating(v);
    _isUpdating = v;
    window.__hahubUpdating = v; // also globally readable
  }

  async function fetchOnce() {
    try {
      const { data } = await api.get('/system/update/status');
      setState(data.state || null);
      const live = data.state?.status === 'running' || data.state?.status === 'requested';
      setUpdatingFlag(live);
      return data.state;
    } catch (_) {
      // API down — if we were updating, keep the flag set
      return null;
    }
  }

  // Poll every 2s while updating, every 30s otherwise (just to detect external updates)
  useEffect(() => {
    fetchOnce();
    const interval = updating ? 2000 : 30000;
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchOnce, interval);
    return () => pollRef.current && clearInterval(pollRef.current);
    // eslint-disable-next-line
  }, [updating]);

  // When state transitions to success → auto-reload after 3 seconds
  const lastStatus = useRef(null);
  useEffect(() => {
    const s = state?.status;
    if (s === 'success' && lastStatus.current && lastStatus.current !== 'success') {
      // Wait a moment so the user sees "Update complete", then reload
      setTimeout(() => window.location.reload(), 3000);
    }
    lastStatus.current = s;
  }, [state]);

  return (
    <UpdateContext.Provider value={{ updating, state, refresh: fetchOnce, setUpdating: setUpdatingFlag }}>
      {children}
    </UpdateContext.Provider>
  );
}

export const useUpdate = () => useContext(UpdateContext);
