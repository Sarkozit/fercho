import { FastifyInstance } from 'fastify';
import {
  processBoldWebhook,
  processBancolombiaWebhook,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notification.service.js';
import { processGmailPush } from '../services/gmail.service.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';

// Middleware: validate webhook secret from Authorization header
function validateWebhookHeader(request: any, reply: any) {
  const authHeader = request.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

// Validate webhook secret from query parameter (for services like BOLD that don't support custom headers)
function validateWebhookQuery(request: any, reply: any) {
  const query = request.query as { token?: string };
  if (!query.token || query.token !== WEBHOOK_SECRET) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function notificationRoutes(fastify: FastifyInstance) {

  // ── Webhooks (public, protected by secret token) ────────────

  /**
   * POST /api/webhooks/bold?token=WEBHOOK_SECRET
   * Receives BOLD payment gateway webhook notifications
   * Token goes in URL because BOLD doesn't support custom headers
   */
  fastify.post('/webhooks/bold', async (request, reply) => {
    validateWebhookQuery(request, reply);
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
   * Receives SMS or Email body forwarded from iPhone Shortcut or email automation
   * Body: { "sms_body": "Bancolombia: ..." }
   */
  fastify.post('/webhooks/bancolombia', async (request, reply) => {
    validateWebhookHeader(request, reply);
    if (reply.sent) return;

    const body = request.body as { sms_body?: string };
    if (!body?.sms_body) {
      return reply.code(400).send({ error: 'Missing sms_body' });
    }

    try {
      const result = await processBancolombiaWebhook(body as { sms_body: string });
      const isDuplicate = 'duplicate' in result && result.duplicate;
      return reply.code(200).send({
        ok: true,
        notificationId: result.id,
        duplicate: isDuplicate,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Error processing Bancolombia webhook' });
    }
  });

  /**
   * POST /api/webhooks/gmail-push
   * Receives Google Pub/Sub push notifications for Gmail.
   * Decodes the message, fetches email via Gmail API, extracts
   * Bancolombia notification, and processes it.
   * MUST always return 200 — otherwise Pub/Sub retries indefinitely.
   */
  fastify.post('/webhooks/gmail-push', async (request, reply) => {
    try {
      const pubsubMsg = request.body as any;
      const data = pubsubMsg?.message?.data;

      if (!data) {
        fastify.log.warn('Gmail push: no message.data');
        return reply.code(200).send({ ok: true, skipped: true });
      }

      // Decode base64 → { emailAddress, historyId }
      const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
      const historyId = decoded.historyId;

      if (!historyId) {
        fastify.log.warn('Gmail push: no historyId in payload');
        return reply.code(200).send({ ok: true, skipped: true });
      }

      fastify.log.info(`Gmail push received — historyId: ${historyId}`);

      // Fetch email and extract Bancolombia line
      const bancolombiaLine = await processGmailPush(historyId);

      if (!bancolombiaLine) {
        return reply.code(200).send({ ok: true, skipped: true, reason: 'no relevant email' });
      }

      // Feed to existing Bancolombia SMS processor (same logic, dedup handles duplicates)
      const result = await processBancolombiaWebhook({ sms_body: bancolombiaLine });
      const isDuplicate = 'duplicate' in result && result.duplicate;

      fastify.log.info(`Gmail push processed: amount=${result.amount}, duplicate=${isDuplicate}`);
      return reply.code(200).send({ ok: true, notificationId: result.id, duplicate: isDuplicate });

    } catch (error: any) {
      fastify.log.error({ err: error }, 'Gmail push error');
      // Always return 200 to prevent Pub/Sub retries
      return reply.code(200).send({ ok: true, error: error.message });
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
