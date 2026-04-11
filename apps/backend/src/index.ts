import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { prisma } from './utils/db.js';
import * as dotenv from 'dotenv';
import { authRoutes } from './routes/auth.routes.js';
import { tableRoutes } from './routes/table.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { reservationRoutes } from './routes/reservation.routes.js';
import { expenseRoutes } from './routes/expense.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { configRoutes } from './routes/config.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';
import { SocketService } from './services/socket.service.js';

import { setupGmailWatch } from './services/gmail.service.js';

dotenv.config();

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
  }
}

const fastify = Fastify({
  logger: true,
});

// Register plugins
fastify.register(cors, {
  origin: true, // In production, replace with actual origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret-key-pos-system',
});

// Multipart for file uploads (10MB limit)
fastify.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Serve uploaded images as static files
fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), 'uploads'),
  prefix: '/api/uploads/',
  decorateReply: false,
});

fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(tableRoutes, { prefix: '/api/tables' });
fastify.register(productRoutes, { prefix: '/api/products' });
fastify.register(reservationRoutes, { prefix: '/api/reservations' });
fastify.register(expenseRoutes, { prefix: '/api/expenses' });
fastify.register(reportRoutes, { prefix: '/api/reports' });
fastify.register(configRoutes, { prefix: '/api/config' });
fastify.register(userRoutes, { prefix: '/api/users' });
fastify.register(publicRoutes, { prefix: '/api/public' });
fastify.register(notificationRoutes, { prefix: '/api' });

// Basic health check
fastify.get('/health', async () => {
  return { status: 'OK', timestamp: new Date().toISOString() };
});

// Start server
// Initialize Socket.io
SocketService.init(fastify);

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);

    // Auto-renew Gmail Watch (non-blocking — runs in background)
    setupGmailWatch()
      .then((res) => console.log(`✅ Gmail watch renewed. Expires: ${new Date(Number(res.expiration)).toISOString()}`))
      .catch((err) => console.warn('⚠️ Gmail watch not renewed (tokens may not be set yet):', err.message));

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down server...');
  await fastify.close();
  await prisma.$disconnect();
  console.log('Server and database disconnected');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { fastify, prisma };
