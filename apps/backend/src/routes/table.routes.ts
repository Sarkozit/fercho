import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TableService } from '../services/table.service.js';
import { SocketService } from '../services/socket.service.js';
import { prisma } from '../utils/db.js';
import { authorize } from '../utils/rbac.js';

export async function tableRoutes(fastify: FastifyInstance) {
  // All table routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);
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

  // Checkout a table, registering payment (ADMIN + CAJERO only)
  fastify.post('/tables/:id/checkout', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
            include: { items: { include: { product: true } }, user: { select: { username: true } } }
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

  // Apply discount to table (ADMIN + CAJERO only)
  fastify.put('/tables/:id/discount', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { discount } = request.body as { discount: number };

      if (typeof discount !== 'number' || discount < 0) {
        return reply.code(400).send({ error: 'El descuento debe ser un número válido o mayor o igual a 0' });
      }

      const updatedTable = await TableService.applyDiscount(id, discount);
      
      if (updatedTable) {
        SocketService.emitTableUpdate(updatedTable);
      }

      return updatedTable;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: error.message || 'Error al aplicar descuento' });
    }
  });

  // Partial checkout — pay for specific items without closing the table (ADMIN + CAJERO only)
  fastify.post('/tables/:id/partial-checkout', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { items, paymentMethod, amountPaid, tipAmount } = request.body as {
        items: { saleItemId: string; qty: number }[];
        paymentMethod: string;
        amountPaid: number;
        tipAmount?: number;
      };

      const updatedTable = await TableService.partialCheckout(
        id,
        items,
        paymentMethod,
        amountPaid,
        tipAmount ?? 0
      );

      if (updatedTable) {
        SocketService.emitTableUpdate(updatedTable);
      }

      return updatedTable;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message || 'Error en cierre parcial' });
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

  // Delete item from an active sale (ADMIN + CAJERO only)
  fastify.delete('/tables/:tableId/items/:itemId', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    const { tableId, itemId } = request.params as { tableId: string, itemId: string };
    try {
      await TableService.deleteSaleItem(itemId);

      // Refresh table data to get the full object with items and product details
      const table = await prisma.table.findUnique({
        where: { id: tableId },
        include: {
          activeSale: {
            include: { items: { include: { product: true } }, user: { select: { username: true } } }
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

  // Toggle tip on a closed sale's payment (ADMIN + CAJERO only)
  fastify.put('/sales/:saleId/tip', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    const { saleId } = request.params as { saleId: string };
    const { enabled } = request.body as { enabled: boolean };

    try {
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { payments: true }
      });

      if (!sale) return reply.code(404).send({ error: 'Venta no encontrada' });

      const tipAmount = enabled ? Math.round(sale.total * 0.1) : 0;

      // Update tip on all payments for this sale
      for (const payment of sale.payments) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { tip: payment.id === sale.payments[0].id ? tipAmount : 0 }
        });
      }

      // Return updated sale with payments
      const updated = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          payments: true,
          items: { include: { product: true } },
          user: true
        }
      });

      return updated;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Error al actualizar propina' });
    }
  });

  // Update payment method on a closed sale's payment (ADMIN + CAJERO only)
  fastify.put('/sales/:saleId/payment-method', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    const { saleId } = request.params as { saleId: string };
    const { paymentId, method } = request.body as { paymentId: string; method: string };

    try {
      const validMethods = ['Efectivo', 'Bold', 'QR'];
      if (!validMethods.includes(method)) {
        return reply.code(400).send({ error: 'Método de pago no válido' });
      }

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment || payment.saleId !== saleId) {
        return reply.code(404).send({ error: 'Pago no encontrado' });
      }

      await prisma.payment.update({
        where: { id: paymentId },
        data: { method }
      });

      // Return updated sale with payments
      const updated = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          payments: true,
          items: { include: { product: true } },
          user: true
        }
      });

      return updated;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Error al actualizar método de pago' });
    }
  });

  // Move entire sale to another table (ADMIN + CAJERO only)
  fastify.put('/tables/:id/move-sale', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { targetTableId } = request.body as { targetTableId: string };

    try {
      const result = await TableService.moveSale(id, targetTableId);

      if (result.from) SocketService.emitTableUpdate(result.from);
      if (result.to) SocketService.emitTableUpdate(result.to);

      return result;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message || 'Error al mover la venta' });
    }
  });

  // Split items from a sale to a new table (ADMIN + CAJERO only)
  fastify.post('/tables/:id/split-sale', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { targetTableId, itemIds } = request.body as { targetTableId: string, itemIds: string[] };

    try {
      const result = await TableService.splitSale(id, targetTableId, itemIds);

      if (result.from) SocketService.emitTableUpdate(result.from);
      if (result.to) SocketService.emitTableUpdate(result.to);

      return result;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message || 'Error al separar la venta' });
    }
  });
}
