import { prisma } from '../utils/db.js';
import { SocketService } from './socket.service.js';

// ── BOLD Webhook ────────────────────────────────────────────────
export async function processBoldWebhook(payload: any) {
  const { id, type, data } = payload;

  const notification = await prisma.notification.create({
    data: {
      source: 'BOLD',
      type: type || 'UNKNOWN',
      amount: data?.amount ?? 0,
      currency: data?.currency || 'COP',
      reference: data?.payment_id || id || null,
      sender: data?.external_reference || null,
      rawData: JSON.stringify(payload),
    },
  });

  SocketService.emitNewNotification(notification);
  return notification;
}

// ── Bancolombia SMS Webhook ─────────────────────────────────────
export async function processBancolombiaWebhook(payload: { sms_body: string }) {
  const { sms_body } = payload;

  // Parse SMS body:
  // "Bancolombia te informa: Has recibido una transferencia de JUAN PEREZ por $150.000. Cuenta *1234. 09/Abr/2026 14:30"
  // Also handles: "Bancolombia le informa Transferencia recibida de NOMBRE por $XX.XXX en cta *1234..."
  const amountMatch = sms_body.match(/\$[\d.,]+/);
  const senderMatch = sms_body.match(/(?:transferencia\s+(?:de|recibida\s+de))\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\s+por|\s+en\s+cta)/i);
  const accountMatch = sms_body.match(/(?:Cuenta|cta)\s*\*?(\d+)/i);

  const rawAmount = amountMatch ? amountMatch[0].replace('$', '').replace(/\./g, '').replace(',', '.') : '0';
  const amount = parseFloat(rawAmount);
  const sender = senderMatch ? senderMatch[1].trim() : 'Desconocido';
  const reference = accountMatch ? `Cuenta *${accountMatch[1]}` : null;

  const notification = await prisma.notification.create({
    data: {
      source: 'BANCOLOMBIA',
      type: 'TRANSFER_RECEIVED',
      amount,
      currency: 'COP',
      reference,
      sender,
      rawData: sms_body,
    },
  });

  SocketService.emitNewNotification(notification);
  return notification;
}

// ── Queries ─────────────────────────────────────────────────────
export async function getNotifications(page: number = 1, limit: number = 5) {
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count(),
  ]);

  return { notifications, total, page, limit, hasMore: skip + limit < total };
}

export async function getUnreadCount() {
  return prisma.notification.count({ where: { read: false } });
}

export async function markAsRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

export async function markAllAsRead() {
  return prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });
}
