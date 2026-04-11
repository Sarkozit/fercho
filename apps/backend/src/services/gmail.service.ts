import { google } from 'googleapis';
import { prisma } from '../utils/db.js';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// ── OAuth2 Client ───────────────────────────────────────────────

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── Token Management (Database) ─────────────────────────────────

async function loadTokens() {
  return prisma.gmailTokens.findUnique({ where: { id: 'singleton' } });
}

async function saveTokens(data: {
  accessToken: string;
  refreshToken: string;
  expiryDate?: bigint | null;
  historyId?: string | null;
  authorizedAt?: Date;
}) {
  await prisma.gmailTokens.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
}

export async function updateHistoryId(historyId: string | number) {
  await prisma.gmailTokens.update({
    where: { id: 'singleton' },
    data: { historyId: String(historyId) },
  });
}

export async function getStoredHistoryId(): Promise<string | null> {
  const tokens = await loadTokens();
  return tokens?.historyId || null;
}

// ── Auth URL Generation ─────────────────────────────────────────

export function getGoogleAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

// ── Exchange Code for Tokens ────────────────────────────────────

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get access_token or refresh_token from Google');
  }

  const currentHistoryId = await getStoredHistoryId();

  await saveTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
    historyId: currentHistoryId,
    authorizedAt: new Date(),
  });

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  };
}

// ── Token Expiry Check (Test Mode: 7 days) ──────────────────────

export async function checkTokenExpiry(): Promise<{ daysLeft: number; expired: boolean } | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  const authorizedAt = tokens.authorizedAt;
  const now = new Date();
  const msElapsed = now.getTime() - authorizedAt.getTime();
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, 7 - daysElapsed);

  return { daysLeft: Math.round(daysLeft * 10) / 10, expired: daysLeft <= 0 };
}

// ── Authenticated Gmail Client ──────────────────────────────────

async function getAuthenticatedGmail() {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error('No Gmail tokens found. Run OAuth flow first: GET /api/auth/google');
  }

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate ? Number(tokens.expiryDate) : undefined,
  });

  // Auto-refresh: save new tokens when they refresh
  client.on('tokens', async (newTokens) => {
    const updates: any = {};
    if (newTokens.access_token) updates.accessToken = newTokens.access_token;
    if (newTokens.expiry_date) updates.expiryDate = BigInt(newTokens.expiry_date);
    if (Object.keys(updates).length > 0) {
      await prisma.gmailTokens.update({
        where: { id: 'singleton' },
        data: updates,
      });
    }
  });

  return google.gmail({ version: 'v1', auth: client });
}

// ── Gmail Watch (Pub/Sub registration) ──────────────────────────

export async function setupGmailWatch() {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) {
    throw new Error('Missing GMAIL_PUBSUB_TOPIC env variable');
  }

  const gmail = await getAuthenticatedGmail();
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
    },
  });

  // Store the historyId from watch response
  if (res.data.historyId) {
    await updateHistoryId(res.data.historyId);
  }

  console.log('Gmail watch registered. Expiration:', res.data.expiration);
  return res.data;
}

// ── Process Gmail Push Notification ─────────────────────────────

export async function processGmailPush(historyId: string): Promise<string | null> {
  const gmail = await getAuthenticatedGmail();
  const storedHistoryId = await getStoredHistoryId();

  if (!storedHistoryId) {
    console.warn('No stored historyId — skipping. Run gmail-watch first.');
    return null;
  }

  // Get history since last known historyId
  const messageIds: string[] = [];
  try {
    const historyRes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: storedHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    });

    if (historyRes.data.history) {
      for (const h of historyRes.data.history) {
        if (h.messagesAdded) {
          for (const msg of h.messagesAdded) {
            if (msg.message?.id) {
              messageIds.push(msg.message.id);
            }
          }
        }
      }
    }
  } catch (err: any) {
    // historyId might be too old (404) — just update and skip
    if (err.code === 404) {
      console.warn('History too old, resetting historyId');
      await updateHistoryId(historyId);
      return null;
    }
    throw err;
  }

  // Update stored historyId
  await updateHistoryId(historyId);

  if (messageIds.length === 0) {
    return null;
  }

  // Process each new message — find Bancolombia notifications
  for (const msgId of messageIds) {
    const msgRes = await gmail.users.messages.get({
      userId: 'me',
      id: msgId,
      format: 'full',
    });

    const body = extractEmailBody(msgRes.data);
    if (!body) continue;

    // Find the Bancolombia line
    const bancolombiaLine = extractBancolombiaLine(body);
    if (!bancolombiaLine) continue;

    // Filter: must contain "Recibiste" or "Fonda Caballo Loco", must NOT contain "pagaste"
    const lower = bancolombiaLine.toLowerCase();
    const isRelevant =
      (lower.includes('recibiste') || lower.includes('fonda caballo loco')) &&
      !lower.includes('pagaste');

    if (isRelevant) {
      return bancolombiaLine;
    }
  }

  return null;
}

// ── Email Body Extraction ───────────────────────────────────────

function extractEmailBody(message: any): string | null {
  if (!message.payload) return null;

  // Try plain text first
  let body = extractPartBody(message.payload, 'text/plain');
  if (body) return body;

  // Fall back to HTML (strip tags)
  body = extractPartBody(message.payload, 'text/html');
  if (body) {
    return body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return null;
}

function extractPartBody(part: any, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  }

  if (part.parts) {
    for (const subPart of part.parts) {
      const result = extractPartBody(subPart, mimeType);
      if (result) return result;
    }
  }

  return null;
}

// ── Extract Bancolombia Line ────────────────────────────────────

function extractBancolombiaLine(body: string): string | null {
  // Decode HTML entities
  const decoded = body
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/\s+/g, ' ');

  // Try to find the line that starts with "Bancolombia:"
  const lines = decoded.split(/\n|\r\n?/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('bancolombia:')) {
      return trimmed;
    }
  }

  // Fallback: in emails the whole body may be one long line after stripping HTML
  const match = decoded.match(/Bancolombia:[^.]*\./i);
  if (match) return match[0].trim();

  // Last resort: find "Bancolombia:" and grab everything until the end
  const idx = decoded.toLowerCase().indexOf('bancolombia:');
  if (idx !== -1) {
    return decoded.substring(idx).trim();
  }

  return null;
}
