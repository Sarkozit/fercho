import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/db.js';
import { InventoryService } from '../services/inventory.service.js';

export async function publicRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/public/menu
   * Returns all categories and products with onlineMenu: true.
   * No authentication required.
   */
  fastify.get('/menu', async (_request, reply) => {
    try {
      const categories = await prisma.category.findMany({
        where: { onlineMenu: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          sortOrder: true,
          products: {
            where: {
              onlineMenu: true,
              active: true,
            },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
            },
          },
        },
      });

      return reply.send({
        categories,
        updatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error fetching menu' });
    }
  });

  /**
   * GET /api/public/count-form
   * Returns all countable items grouped into 5 sections + user list.
   * No authentication required (employees access from their phones).
   */
  fastify.get('/count-form', async (_request, reply) => {
    try {
      const data = await InventoryService.getCountFormData();
      return reply.send(data);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error loading count form' });
    }
  });

  /**
   * POST /api/public/count-form
   * Saves a batch of inventory counts from the employee form.
   * Body: { userId: string, counts: [{ id, type, stock }] }
   */
  fastify.post('/count-form', async (request, reply) => {
    try {
      const { userId, counts } = request.body as any;
      if (!userId || !counts || !Array.isArray(counts)) {
        return reply.code(400).send({ error: 'userId y counts son requeridos' });
      }
      const result = await InventoryService.submitCountForm({ userId, counts });
      return reply.send(result);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error saving counts' });
    }
  });
}

