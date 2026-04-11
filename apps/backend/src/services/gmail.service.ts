import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Store tokens inside uploads/ which already has a persistent Docker volume
const TOKENS_PATH = path.join(process.cwd(), 'uploads', 'gmail-tokens.json');

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

// ── Token Management ────────────────────────────────────────────

interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
  historyId?: string;
}

function loadTokens(): GmailTokens | null {
  try {
    if (fs.existsSync(TOKENS_PATH)) {
      const data = fs.readFileSync(TOKENS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading Gmail tokens:', err);
  }
  return null;
}

function saveTokens(tokens: GmailTokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

export function updateHistoryId(historyId: string) {
  const tokens = loadTokens();
  if (tokens) {
    tokens.historyId = historyId;
    saveTokens(tokens);
  }
}

export function getStoredHistoryId(): string | null {
  const tokens = loadTokens();
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

  const stored: GmailTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || undefined,
    historyId: getStoredHistoryId() || undefined,
  };
  saveTokens(stored);

  return stored;
}

// ── Authenticated Gmail Client ──────────────────────────────────

function getAuthenticatedGmail() {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error('No Gmail tokens found. Run OAuth flow first: GET /api/auth/google');
  }

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  // Auto-refresh: save new tokens when they refresh
  client.on('tokens', (newTokens) => {
    const current = loadTokens();
    if (current) {
      if (newTokens.access_token) current.access_token = newTokens.access_token;
      if (newTokens.expiry_date) current.expiry_date = newTokens.expiry_date;
      saveTokens(current);
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

  const gmail = getAuthenticatedGmail();
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
    },
  });

  // Store the historyId from watch response
  if (res.data.historyId) {
    updateHistoryId(res.data.historyId);
  }

  console.log('Gmail watch registered. Expiration:', res.data.expiration);
  return res.data;
}

// ── Process Gmail Push Notification ─────────────────────────────

export async function processGmailPush(historyId: string): Promise<string | null> {
  const gmail = getAuthenticatedGmail();
  const storedHistoryId = getStoredHistoryId();

  if (!storedHistoryId) {
    console.warn('No stored historyId — skipping. Run gmail-watch first.');
    return null;
  }

  // Get history since last known historyId
  let messageIds: string[] = [];
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
      updateHistoryId(historyId);
      return null;
    }
    throw err;
  }

  // Update stored historyId
  updateHistoryId(historyId);

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
  // The message body may be multiline — find the line that starts with "Bancolombia:"
  const lines = body.split(/\n|\r\n?/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('bancolombia:')) {
      return trimmed;
    }
  }

  // Fallback: try to find "Bancolombia:" anywhere (email might be a single long line)
  const match = body.match(/Bancolombia:\s*[^\n]*/i);
  return match ? match[0].trim() : null;
}
