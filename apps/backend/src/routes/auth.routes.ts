import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', AuthController.login);
  
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, AuthController.me);
}
