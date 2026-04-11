import { FastifyInstance } from 'fastify';
import { UserService } from '../services/user.service.js';
import { authorize } from '../utils/rbac.js';

export async function userRoutes(fastify: FastifyInstance) {
  // All user routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // GET /users - List all users
  fastify.get('/', async (_request, reply) => {
    try {
      const users = await UserService.listUsers();
      return users;
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // POST /users - Create new user (ADMIN only)
  fastify.post('/', { preHandler: [authorize(['ADMIN'])] }, async (request, reply) => {
    try {
      const body: any = request.body;
      const user = await UserService.createUser(body);
      return reply.status(201).send({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        active: user.active,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.status(409).send({ message: 'El nombre de usuario ya existe' });
      }
      return reply.status(500).send({ message: error.message });
    }
  });

  // PUT /users/:id - Update user (ADMIN only)
  fastify.put('/:id', { preHandler: [authorize(['ADMIN'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body: any = request.body;
      const user = await UserService.updateUser(id, body);
      return user;
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.status(409).send({ message: 'El nombre de usuario ya existe' });
      }
      return reply.status(500).send({ message: error.message });
    }
  });

  // DELETE /users/:id - Deactivate user (ADMIN only)
  fastify.delete('/:id', { preHandler: [authorize(['ADMIN'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await UserService.deleteUser(id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });
}
