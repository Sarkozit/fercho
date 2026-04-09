import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';

export class SocketService {
  private static io: Server;

  static init(fastify: FastifyInstance) {
    this.io = new Server(fastify.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      path: '/api/socket.io/',
    });

    this.io.on('connection', (socket: Socket) => {
      console.log('New client connected:', socket.id);

      socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    console.log('Socket.io initialized');
  }

  static emitTableUpdate(table: any) {
    if (this.io) {
      this.io.emit('table_updated', table);
    }
  }

  static emitTableDeleted(tableId: string) {
    if (this.io) {
      this.io.emit('table_deleted', { tableId });
    }
  }

  static emitExpenseUpdate() {
    if (this.io) {
      this.io.emit('expense_updated');
    }
  }

  static emitRoomUpdate(roomId: string, data: any) {
    if (this.io) {
      this.io.to(roomId).emit('room-update', data);
    }
  }

  static emitNewNotification(notification: any) {
    if (this.io) {
      this.io.emit('new_notification', notification);
    }
  }
}
