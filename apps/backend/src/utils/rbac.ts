import { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';

export const authorize = (roles: UserRole[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    if (!user || !roles.includes(user.role)) {
      reply.status(403).send({ message: 'Forbidden: You do not have the required role' });
    }
  };
};
