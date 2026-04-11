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

// ── Bancolombia Webhook (SMS or Email — same body) ──────────────

/**
 * Parses two Bancolombia message formats:
 *
 * Format 1 (QR/Llave):
 * "Bancolombia: Fonda Caballo Loco, recibiste un pago de ANDRES FELIPE BERNAL MURILLO
 *  por $70,000.00 en tu cuenta *3894 conectado a la llave 0040800427 el 04/04/2026
 *  a las 11:00..."
 *
 * Format 2 (Transferencia):
 * "Bancolombia: Recibiste una transferencia por $150,000 de LEANDRO GONZALEZ
 *  en tu cuenta **3894, el 05/04/2026 a las 12:51..."
 */
function parseBancolombiaMessage(body: string) {
  // Normalize ALL types of whitespace (including non-breaking spaces \xA0 from HTML emails)
  const normalized = body.replace(/[\s\u00A0\u200B]+/g, ' ').trim();

  // ── Extract amount ──
  // Bancolombia uses comma for thousands: $70,000.00 or $150,000
  const amountMatch = normalized.match(/\$([\d.,]+)/);
  let amount = 0;
  if (amountMatch) {
    // Remove dots used as thousands separator, replace comma with dot for decimals
    // Handle both "70,000" (US) and "70.000" (Colombian) formats
    let raw = amountMatch[1];
    if (raw.includes(',') && raw.includes('.')) {
      // Has both: "70,000.00" → remove commas
      raw = raw.replace(/,/g, '');
    } else if (raw.includes(',')) {
      // Only commas: "70,000" → remove commas
      raw = raw.replace(/,/g, '');
    } else if (raw.includes('.') && raw.indexOf('.') < raw.length - 3) {
      // Dots as thousands: "70.000" → remove dots
      raw = raw.replace(/\./g, '');
    }
    amount = parseFloat(raw);
  }

  // ── Extract sender name ──
  let sender = 'Desconocido';
  // Format 1: "pago de NOMBRE por $" (QR/Llave)
  const senderFormat1 = normalized.match(/pago\s+de\s+(.+?)\s+por\s+\$/i);
  // Format 2: "$AMOUNT de NOMBRE en tu cuenta" (transfer)
  const senderFormat2 = normalized.match(/\$[\d.,]+\s+de\s+(.+?)\s+en\s+tu\s+cuenta/i);
  // Format 3: generic "$AMOUNT de NOMBRE" followed by punctuation or end
  const senderFormat3 = normalized.match(/\$[\d.,]+\s+de\s+(.+?)(?:\s+en\s+|\s*[.,]\s*|$)/i);

  if (senderFormat1) {
    sender = senderFormat1[1].trim();
  } else if (senderFormat2) {
    sender = senderFormat2[1].trim();
  } else if (senderFormat3) {
    sender = senderFormat3[1].trim();
  }

  // Capitalize sender: "ANDRES BERNAL" → "Andres Bernal"
  if (sender !== 'Desconocido') {
    sender = sender
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Extract account ──
  const accountMatch = normalized.match(/cuenta\s*\*+(\d+)/i);
  const account = accountMatch ? accountMatch[1] : null;

  // ── Extract date ──
  const dateMatch = normalized.match(/el\s+(\d{2}\/\d{2}\/\d{4})/);
  const txDate = dateMatch ? dateMatch[1] : null;

  // ── Extract time ──
  const timeMatch = normalized.match(/a\s+las\s+(\d{1,2}:\d{2})/);
  const txTime = timeMatch ? timeMatch[1] : null;

  return { amount, sender, account, txDate, txTime };
}

/**
 * Generates a deduplication fingerprint from transaction data.
 * Same amount + same sender + same date + same time = same transaction
 * (whether it arrives via SMS or email)
 * 
 * Including time prevents falsely deduplicating two different transactions
 * from the same person with the same amount on the same day.
 */
function generateFingerprint(amount: number, sender: string, txDate: string | null, txTime: string | null): string {
  const normalizedSender = sender.toUpperCase().trim().replace(/\s+/g, ' ');
  return `BANCOLOMBIA|${amount}|${normalizedSender}|${txDate || 'NODATE'}|${txTime || 'NOTIME'}`;
}

export async function processBancolombiaWebhook(payload: { sms_body: string }) {
  const { sms_body } = payload;

  // Debug: log the raw input to help diagnose parsing issues
  console.log('[Bancolombia] Raw input:', sms_body.substring(0, 200));

  const { amount, sender, account, txDate, txTime } = parseBancolombiaMessage(sms_body);
  console.log(`[Bancolombia] Parsed: amount=${amount}, sender="${sender}", date=${txDate}, time=${txTime}`);

  const fingerprint = generateFingerprint(amount, sender, txDate, txTime);
  const reference = account ? `*${account}` : null;

  // ── Deduplication: check if this exact transaction was already processed ──
  const existing = await prisma.notification.findFirst({
    where: { fingerprint },
  });

  if (existing) {
    // Already processed (via the other channel — SMS or email)
    return { ...existing, duplicate: true };
  }

  // ── Create new notification ──
  const notification = await prisma.notification.create({
    data: {
      source: 'BANCOLOMBIA',
      type: 'TRANSFER_RECEIVED',
      amount,
      currency: 'COP',
      reference,
      sender,
      fingerprint,
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
