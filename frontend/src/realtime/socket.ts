import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const token = localStorage.getItem('supportflow_token') || localStorage.getItem('token');
    // Connect to same origin (Vite proxy forwards websocket traffic to backend on port 5000)
    socket = io('/', {
      auth: { token },
      autoConnect: !!token,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // Socket connected
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection notice:', err.message);
    });
  }
  return socket;
};

export const updateSocketAuth = (token: string | null): void => {
  if (!socket) {
    if (token) getSocket();
    return;
  }

  socket.auth = { token };
  if (token) {
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
