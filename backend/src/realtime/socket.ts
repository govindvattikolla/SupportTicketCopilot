import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { User } from '../modules/users/user.model';
import { Ticket } from '../modules/tickets/ticket.model';

export interface AuthenticatedSocketData {
  user: {
    _id: string;
    workspaceId: string;
    role: 'agent' | 'lead' | 'admin';
    name: string;
    email: string;
  };
}

let io: SocketIOServer | null = null;

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5000'],
      methods: ['GET', 'POST', 'PATCH'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization
          ? socket.handshake.headers.authorization.replace('Bearer ', '')
          : null);

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: string;
        workspaceId: string;
        role: 'agent' | 'lead' | 'admin';
      };

      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User inactive or not found'));
      }

      // Attach authenticated user metadata to socket session
      (socket.data as AuthenticatedSocketData).user = {
        _id: user._id.toString(),
        workspaceId: user.workspaceId.toString(),
        role: user.role,
        name: user.name,
        email: user.email,
      };

      return next();
    } catch (err: any) {
      return next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // Connection Handler & Secure Room Management
  io.on('connection', (socket: Socket) => {
    const user = (socket.data as AuthenticatedSocketData).user;
    if (!user) {
      socket.disconnect();
      return;
    }

    // Auto-join authorized tenant and personal rooms
    const workspaceRoom = `workspace:${user.workspaceId}`;
    const userRoom = `user:${user._id}`;
    const roleRoom = `role:${user.workspaceId}:${user.role}`;

    socket.join(workspaceRoom);
    socket.join(userRoom);
    socket.join(roleRoom);

    // Secure Ticket Room Subscription
    socket.on('join_ticket', async (payload: { ticketId: string }, callback?: (res: any) => void) => {
      try {
        const { ticketId } = payload;
        if (!ticketId || !Types.ObjectId.isValid(ticketId)) {
          if (callback) callback({ success: false, error: 'Invalid ticket ID format' });
          return;
        }

        // Verify the ticket belongs to the user's workspace to prevent cross-tenant sniffing
        const ticket = await Ticket.findOne({
          _id: ticketId,
          workspaceId: user.workspaceId,
        });

        if (!ticket) {
          if (callback) {
            callback({
              success: false,
              error: 'Forbidden: Cannot subscribe to ticket outside your workspace',
            });
          }
          return;
        }

        const ticketRoom = `ticket:${ticketId}`;
        socket.join(ticketRoom);

        if (callback) callback({ success: true, room: ticketRoom });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('leave_ticket', (payload: { ticketId: string }, callback?: (res: any) => void) => {
      const { ticketId } = payload;
      if (ticketId) {
        socket.leave(`ticket:${ticketId}`);
        if (callback) callback({ success: true });
      }
    });
  });

  return io;
};

export const getSocketServer = (): SocketIOServer | null => io;

/**
 * Broadcast event to entire tenant workspace
 */
export const emitToWorkspace = (workspaceId: string | Types.ObjectId, event: string, data: any): void => {
  if (io) {
    io.to(`workspace:${workspaceId.toString()}`).emit(event, data);
  }
};

/**
 * Broadcast event to a specific individual user
 */
export const emitToUser = (userId: string | Types.ObjectId, event: string, data: any): void => {
  if (io) {
    io.to(`user:${userId.toString()}`).emit(event, data);
  }
};

/**
 * Broadcast event to users of a specific role within a workspace
 */
export const emitToRole = (
  workspaceId: string | Types.ObjectId,
  role: 'agent' | 'lead' | 'admin',
  event: string,
  data: any
): void => {
  if (io) {
    io.to(`role:${workspaceId.toString()}:${role}`).emit(event, data);
  }
};

/**
 * Broadcast event to clients actively viewing a specific ticket
 */
export const emitToTicket = (ticketId: string | Types.ObjectId, event: string, data: any): void => {
  if (io) {
    io.to(`ticket:${ticketId.toString()}`).emit(event, data);
  }
};
