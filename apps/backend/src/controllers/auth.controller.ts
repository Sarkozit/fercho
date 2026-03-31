import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { UserService } from '../services/user.service.js';
import { fastify } from '../index.js';

export class AuthController {
  static async login(request: FastifyRequest, reply: FastifyReply) {
    const { username, password }: any = request.body;

    const user = await UserService.findByUsername(username);
    if (!user) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role 
    });

    // Update last login
    // await UserService.update(user.id, { lastLogin: new Date() });

    return { token, user: { id: user.id, username: user.username, role: user.role, name: user.name } };
  }

  static async me(request: FastifyRequest) {
    return request.user;
  }
}
