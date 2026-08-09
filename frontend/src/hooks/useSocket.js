import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Live connection to the hub.
 *
 * Returns the socket plus whether it is actually connected. That second value
 * matters in a monitoring product: a dashboard that has quietly stopped
 * receiving updates looks identical to one where nothing is happening, and the
 * difference is the whole point of the screen.
 */
export function useSocket(onEvent) {
  const ref = useRef(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ha-hub-token');
    if (!token) return undefined;

    const s = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    ref.current = s;

    const emit = (ev, payload) => handler.current?.(ev, payload);

    s.on('connect', () => { setConnected(true); emit('connect', null); });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    s.on('client:update', (p) => emit('client:update', p));
    s.on('notification', (p) => emit('notification', p));
    // socket.io fires this on the manager; keep the legacy name working too.
    s.on('reconnect', () => { setConnected(true); emit('reconnect', null); });
    s.io.on('reconnect', () => { setConnected(true); emit('reconnect', null); });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      ref.current = null;
      setConnected(false);
    };
  }, []);

  return { socket: ref, connected };
}

export default useSocket;
