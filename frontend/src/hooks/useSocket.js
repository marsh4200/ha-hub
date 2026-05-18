import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(onEvent) {
  const ref = useRef(null);
  useEffect(() => {
    const token = localStorage.getItem('ha-hub-token');
    if (!token) return;
    const s = io({ auth: { token }, transports: ['websocket', 'polling'] });
    ref.current = s;
    if (onEvent) {
      s.on('client:update', (p) => onEvent('client:update', p));
      s.on('notification', (p) => onEvent('notification', p));
    }
    return () => s.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
