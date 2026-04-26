import { FastifyInstance } from 'fastify';
import { InventoryService } from '../services/inventory.service.js';
import { authorize } from '../utils/rbac.js';

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ===== DASHBOARD =====
  fastify.get('/dashboard', async () => {
    return InventoryService.getDashboard();
  });

  // ===== INVENTORY ITEMS (non-POS) =====
  fastify.get('/items', async () => {
    return InventoryService.listInventoryItems();
  });

  fastify.post('/items', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { name, unit, cost, idealStock, packSize, packName, categoryTag, supplierId } = request.body as any;
      if (!name?.trim()) return reply.status(400).send({ message: 'El nombre es requerido' });
      return InventoryService.createInventoryItem({ name: name.trim(), unit, cost, idealStock, packSize, packName, categoryTag, supplierId });
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/items/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      return InventoryService.updateInventoryItem(id, request.body);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.delete('/items/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await InventoryService.deleteInventoryItem(id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // ===== COUNTS =====
  fastify.post('/counts', async (request, reply) => {
    try {
      const { productId, inventoryItemId, currentStock, notes } = request.body as any;
      const user = request.user as any;
      if (currentStock === undefined || currentStock === null) return reply.status(400).send({ message: 'currentStock es requerido' });
      return InventoryService.createCount({
        productId,
        inventoryItemId,
        currentStock: parseInt(currentStock),
        countedBy: user.id,
        notes,
      });
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.get('/counts/latest', async () => {
    return InventoryService.getLatestCounts();
  });

  // ===== RECEIVE ORDER =====
  fastify.post('/receive-order', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { items } = request.body as any;
      const user = request.user as any;
      if (!items || !Array.isArray(items)) return reply.status(400).send({ message: 'items es requerido' });
      return InventoryService.receiveOrder(items, user.id);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // ===== COUNT FORM DATA (for admin reorder UI) =====
  fastify.get('/count-form-sections', async () => {
    return InventoryService.getCountFormData();
  });

  // ===== REORDER COUNT FORM =====
  fastify.put('/count-sort-order', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { items } = request.body as any;
      if (!items || !Array.isArray(items)) return reply.status(400).send({ message: 'items es requerido' });
      return InventoryService.updateCountSortOrder(items);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });
}
