import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Connect with credentials so HTTP-only authentication cookies are sent in handshake
    socket = io('/', {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // Socket connected with HTTP-only cookie authentication
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection notice:', err.message);
    });
  }
  return socket;
};

export const updateSocketAuth = (authenticated: boolean | string | null): void => {
  const isAuth = !!authenticated;
  if (!socket) {
    if (isAuth) getSocket();
    return;
  }

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
