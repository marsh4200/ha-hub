import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from '../hooks/useSocket';
import { triage, needsAction } from '../lib/format';

/**
 * One source of truth for the fleet.
 *
 * Previously each screen fetched /clients for itself, which meant the sidebar
 * could not show fleet health at all and the dashboard and the site register
 * polled the same endpoint independently. Owning it once means every surface
 * agrees, the poll runs once, and a live socket update repaints everything
 * that is on screen.
 */
const FleetContext = createContext(null);

const EMPTY_STATS = {
  total: 0, online: 0, offline: 0, unknown: 0, updatesAvailable: 0, linked: 0, userCount: null,
};

export function FleetProvider({ children }) {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [c, s] = await Promise.all([api.get('/clients'), api.get('/system/stats')]);
      if (!mounted.current) return;
      setClients(c.data.clients || []);
      setStats(s.data || EMPTY_STATS);
      setLastSyncedAt(Date.now());
      setError(false);
    } catch (_) {
      // Transient — the poller brings us back. Surfacing a red banner every
      // time a container restarts would train the operator to ignore banners.
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const { data } = await api.get('/system/stats');
      if (mounted.current) setStats(data || EMPTY_STATS);
    } catch (_) { /* ignore */ }
  }, []);

  /** Merge a partial client into the list without waiting for a full reload. */
  const patchClient = useCallback((patch) => {
    if (!patch?.id) return;
    setClients((prev) => prev.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)));
  }, []);

  const { connected } = useSocket((ev, payload) => {
    if (ev === 'client:update') {
      patchClient(payload);
      refreshStats();
    } else if (ev === 'reconnect' || ev === 'connect') {
      reload({ silent: true });
    }
  });

  useEffect(() => {
    if (!user) {
      setClients([]);
      setStats(EMPTY_STATS);
      setLoading(false);
      return undefined;
    }
    reload();
    const id = setInterval(() => reload({ silent: true }), 15_000);
    return () => clearInterval(id);
  }, [user, reload]);

  /**
   * Two independent counts, kept apart on purpose. A site with a pending
   * update is not a site with a problem, and merging them makes the attention
   * number meaningless within a week of running a real fleet.
   */
  const derived = useMemo(() => {
    const attention = clients.filter(needsAction).length;
    const updates = clients.filter((c) => !needsAction(c) && triage(c) === 'info' && c.updateAvailable).length;
    return { attention, updates };
  }, [clients]);

  const value = useMemo(
    () => ({
      clients, stats, loading, error, connected, lastSyncedAt,
      attentionCount: derived.attention,
      updateCount: derived.updates,
      reload, refreshStats, patchClient,
    }),
    [clients, stats, loading, error, connected, lastSyncedAt, derived, reload, refreshStats, patchClient]
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet must be used inside <FleetProvider>');
  return ctx;
}

export default FleetProvider;
