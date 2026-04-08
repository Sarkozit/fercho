import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/db.js';

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
}
