import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TableService } from '../services/table.service.js';
import { SocketService } from '../services/socket.service.js';
import { prisma } from '../utils/db.js';

export async function tableRoutes(fastify: FastifyInstance) {
  // Get all rooms with tables
  fastify.get('/rooms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rooms = await TableService.getRooms();
      return rooms;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch rooms' });
    }
  });

  // Get tables for a specific room
  fastify.get('/rooms/:id/tables', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tables = await TableService.getTablesByRoom(id);
      return tables;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch tables' });
    }
  });

  // Update table status (e.g., from Occupied to Free)
  fastify.post('/tables/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, comment } = request.body as { status: string, comment?: string };

      let userId = (request as any).user?.id;
      if (!userId) {
        const admin = await prisma.user.findFirst();
        userId = admin?.id;
      }

      const updatedTable = await TableService.updateTableStatus(id, status, comment, userId);

      // Broadcast update via WebSocket
      SocketService.emitTableUpdate(updatedTable);

      return updatedTable;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to update table status' });
    }
  });

  // Checkout a table, registering payment
  fastify.post('/tables/:id/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { paymentMethod, amountPaid, tipAmount } = request.body as { paymentMethod: string, amountPaid: number, tipAmount?: number };

      const updatedTable = await TableService.checkoutTable(id, paymentMethod, amountPaid, tipAmount ?? 0);
      
      SocketService.emitTableUpdate(updatedTable);
      
      return updatedTable;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to checkout table' });
    }
  });

  // Add items to a table's active sale
  fastify.post('/tables/:id/order', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { items } = request.body as { items: any[] };

    try {
      let table = await prisma.table.findUnique({
        where: { id },
        include: { activeSale: true }
      });

      if (!table) {
        return reply.code(404).send({ error: 'Mesa no encontrada' });
      }

      // If the table is marked OCCUPIED but has no active Sale (e.g. seeded data),
      // auto-create one so the flow continues seamlessly.
      if (!table.activeSale) {
        const admin = await prisma.user.findFirst();
        if (!admin) return reply.code(500).send({ error: 'No hay usuarios en el sistema' });

        await prisma.sale.create({
          data: { tableId: id, userId: admin.id, status: 'OPEN' }
        });

        // Also make sure the table status is OCCUPIED
        await prisma.table.update({ where: { id }, data: { status: 'OCCUPIED' } });

        // Re-fetch with the new sale
        table = await prisma.table.findUnique({
          where: { id },
          include: { activeSale: true }
        });
      }

      if (!table?.activeSale) {
        return reply.code(400).send({ error: 'La mesa no tiene una cuenta activa' });
      }

      await TableService.addItemsToSale(table.activeSale.id, items);

      // Refresh table data and broadcast
      const updatedTable = await prisma.table.findUnique({
        where: { id },
        include: {
          activeSale: {
            include: { items: { include: { product: true } } }
          }
        }
      });

      if (updatedTable) {
        SocketService.emitTableUpdate(updatedTable);
      }

      return updatedTable;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: error.message || 'Error al confirmar el pedido' });
    }
  });

  // Update table coordinates
  fastify.put('/tables/:id/move', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { x, y } = request.body as { x: number, y: number };

      const updatedTable = await TableService.updateTableCoordinates(id, x, y);
      SocketService.emitTableUpdate(updatedTable);

      return updatedTable;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to update table coordinates' });
    }
  });

  // Update table shape
  fastify.put('/tables/:id/shape', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { shape } = request.body as { shape: string };

      const updatedTable = await TableService.updateTableShape(id, shape);
      SocketService.emitTableUpdate(updatedTable);

      return updatedTable;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to update table shape' });
    }
  });

  fastify.put('/tables/:id/size', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { size } = request.body as { size: string };

    try {
      const table = await TableService.updateTableSize(id, size);

      SocketService.emitTableUpdate(table);

      return table;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to update table size' });
    }
  });

  fastify.post('/tables', async (request, reply) => {
    const { number, x, y, shape, size, roomId, status } = request.body as {
      number: number;
      x: number;
      y: number;
      shape: string;
      size: string;
      roomId: string;
      status: string;
    };

    try {
      const table = await TableService.createTable({
        number,
        x,
        y,
        shape: shape || 'square',
        size: size || 'large',
        roomId,
        status: status || 'FREE'
      });

      SocketService.emitTableUpdate(table);

      return reply.code(201).send(table);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to create table' });
    }
  });

  fastify.delete('/tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await TableService.deleteTable(id);
      SocketService.emitTableDeleted(id);

      return reply.code(204).send();
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to delete table' });
    }
  });

  // Create new room
  fastify.post('/rooms', async (request, reply) => {
    const { name } = request.body as { name: string };
    try {
      const room = await TableService.createRoom(name);
      return reply.code(201).send(room);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to create room' });
    }
  });

  // Update room name
  fastify.put('/rooms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };
    try {
      const room = await TableService.updateRoom(id, name);
      return room;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to update room' });
    }
  });

  // Delete room
  fastify.delete('/rooms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await TableService.deleteRoom(id);
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to delete room' });
    }
  });

  // Update room zoom
  fastify.put('/rooms/:id/zoom', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { zoom } = request.body as { zoom: number };
    try {
      const room = await TableService.updateRoomZoom(id, zoom);
      return room;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to update room zoom' });
    }
  });

  // Delete item from an active sale
  fastify.delete('/tables/:tableId/items/:itemId', async (request, reply) => {
    const { tableId, itemId } = request.params as { tableId: string, itemId: string };
    try {
      await TableService.deleteSaleItem(itemId);

      // Refresh table data to get the full object with items and product details
      const table = await prisma.table.findUnique({
        where: { id: tableId },
        include: {
          activeSale: {
            include: { items: { include: { product: true } } }
          }
        }
      });

      if (table) {
        SocketService.emitTableUpdate(table);
      }

      return table;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Error al eliminar el producto' });
    }
  });
}
