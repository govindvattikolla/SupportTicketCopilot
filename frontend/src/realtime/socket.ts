import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../api/client';

let socket: Socket | null = null;

const getSocketBaseUrl = (): string => {
  const envVal = (import.meta.env.VITE_API_URL || '').trim();
  if (!envVal || envVal === '/') {
    return '';
  }
  return envVal.replace(/\/+$/, '');
};

export const getSocket = (): Socket => {
  if (!socket) {
    const baseUrl = getSocketBaseUrl();
    const token = getAuthToken();

    // Connect with auth token and credentials for cross-domain and same-domain support
    socket = io(baseUrl || '/', {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: { token },
    });

    socket.on('connect', () => {
      // Socket connected with token authentication
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection notice:', err.message);
    });
  }
  return socket;
};

export const updateSocketAuth = (authenticated: boolean | string | null): void => {
  const isAuth = !!authenticated;
  const token = getAuthToken();

  if (!socket) {
    if (isAuth) getSocket();
    return;
  }

  // Update credentials for active/reconnecting socket session
  socket.auth = { token };

  if (isAuth) {
    if (!socket.connected) {
      socket.connect();
    }
  } else {
    socket.disconnect();
  }
};

export const subscribeToTicket = (ticketId: string): void => {
  const s = getSocket();
  if (s.connected) {
    s.emit('join_ticket', { ticketId });
  } else {
    s.once('connect', () => {
      s.emit('join_ticket', { ticketId });
    });
  }
};

export const unsubscribeFromTicket = (ticketId: string): void => {
  const s = getSocket();
  if (s.connected) {
    s.emit('leave_ticket', { ticketId });
  }
};
