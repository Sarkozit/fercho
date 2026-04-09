import { FastifyInstance } from 'fastify';
import {
  processBoldWebhook,
  processBancolombiaWebhook,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notification.service.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';

// Middleware: validate webhook secret token
function validateWebhookToken(request: any, reply: any) {
  const authHeader = request.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function notificationRoutes(fastify: FastifyInstance) {

  // ── Webhooks (public, protected by secret token) ────────────

  /**
   * POST /api/webhooks/bold
   * Receives BOLD payment gateway webhook notifications
   */
  fastify.post('/webhooks/bold', async (request, reply) => {
    validateWebhookToken(request, reply);
    if (reply.sent) return;

    try {
      const notification = await processBoldWebhook(request.body);
      return reply.code(200).send({ ok: true, notificationId: notification.id });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error processing BOLD webhook' });
    }
  });

  /**
   * POST /api/webhooks/bancolombia
   * Receives SMS forwarded from iPhone Shortcut
   * Body: { "sms_body": "Bancolombia te informa..." }
   */
  fastify.post('/webhooks/bancolombia', async (request, reply) => {
    validateWebhookToken(request, reply);
    if (reply.sent) return;

    const body = request.body as { sms_body?: string };
    if (!body?.sms_body) {
      return reply.code(400).send({ error: 'Missing sms_body' });
    }

    try {
      const notification = await processBancolombiaWebhook(body as { sms_body: string });
      return reply.code(200).send({ ok: true, notificationId: notification.id });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error processing Bancolombia webhook' });
    }
  });

  // ── Authenticated API ───────────────────────────────────────

  /**
   * GET /api/notifications?page=1&limit=5
   * Returns paginated notifications (newest first)
   */
  fastify.get('/notifications', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const query = request.query as { page?: string; limit?: string };
      const page = Math.max(1, parseInt(query.page || '1'));
      const limit = Math.min(50, Math.max(1, parseInt(query.limit || '5')));
      const result = await getNotifications(page, limit);
      return reply.send(result);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error fetching notifications' });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Returns count of unread notifications
   */
  fastify.get('/notifications/unread-count', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    try {
      const count = await getUnreadCount();
      return reply.send({ count });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error fetching unread count' });
    }
  });

  /**
   * PATCH /api/notifications/read-all
   * Marks all notifications as read
   */
  fastify.patch('/notifications/read-all', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    try {
      await markAllAsRead();
      return reply.send({ ok: true });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error marking notifications as read' });
    }
  });

  /**
   * PATCH /api/notifications/:id/read
   * Marks a single notification as read
   */
  fastify.patch('/notifications/:id/read', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const notification = await markAsRead(id);
      return reply.send(notification);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error marking notification as read' });
    }
  });
}
