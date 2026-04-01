import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/db.js';

// ── In-memory cache (5 minutes TTL) ──
let sheetsCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchFromSheets() {
  const baseUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;
  if (!baseUrl) {
    throw new Error('GOOGLE_SHEETS_WEB_APP_URL not configured in .env');
  }

  // Check cache
  if (sheetsCache && Date.now() - sheetsCache.timestamp < CACHE_TTL) {
    return sheetsCache.data;
  }

  // Append sheetId if configured (needed when script is standalone, not bound to sheet)
  const sheetId = process.env.GOOGLE_SHEETS_ID || '';
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = sheetId ? `${baseUrl}${separator}sheetId=${sheetId}` : baseUrl;

  // Fetch fresh data — follow redirects (Google Apps Script redirects)
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Google Sheets API error: ${response.status}`);
  }

  const data = await response.json();

  // Check if Sheets returned an error
  if (data.error) {
    throw new Error(`Google Sheets script error: ${data.error}`);
  }
  
  // Update cache
  sheetsCache = { data, timestamp: Date.now() };
  return data;
}

// ── Normalize date/time from Sheets raw formats ──
// Sheets may return dates as "Thu Jun 01 2023 00:00:00 GMT-0500 (...)" or "2023-06-01"
function normalizeDate(raw: any): string {
  if (!raw) return '';
  const str = String(raw);
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // Try to parse as Date
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  
  return str;
}

// Sheets may return times as "Sat Dec 30 1899 13:30:00 GMT-0456 (...)" or "13:30"
// NOTE: We extract HH:MM directly via regex to avoid timezone offset issues
// (1899 Colombia timezone was GMT-0456, not GMT-0500, causing a ~4 min drift)
function normalizeTime(raw: any): string {
  if (!raw) return '';
  const str = String(raw);
  
  // Already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(str)) return str;
  
  // Extract HH:MM:SS directly from the string (avoids timezone conversion)
  const timeMatch = str.match(/(\d{1,2}):(\d{2}):\d{2}/);
  if (timeMatch) {
    return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }
  
  // Fallback: try Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  
  return str;
}

// ── Keep-alive: ping Sheets every 4 min to prevent cold starts ──
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(async () => {
    try {
      await fetchFromSheets();
      console.log('[keep-alive] Sheets cache refreshed');
    } catch (err) {
      console.error('[keep-alive] Error refreshing cache:', err);
    }
  }, 4 * 60 * 1000); // Every 4 minutes
}

export async function reservationRoutes(fastify: FastifyInstance) {

  // Start keep-alive on first registration
  startKeepAlive();

  // ─────────────────────────────────────────────
  // GET /api/reservations — Fetch reservations + merge local notes
  // ─────────────────────────────────────────────
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const sheetsData = await fetchFromSheets();
      
      const reservas = sheetsData.reservas || [];
      const polizas = sheetsData.polizas || [];

      // Count pólizas per reservation ID — only count those with estado === 'Activada'
      const polizaCountMap: Record<string, number> = {};
      const polizaDetailsMap: Record<string, any[]> = {};
      
      for (const p of polizas) {
        const id = String(p.idCabalgata);
        if (!id) continue;
        const estado = String(p.estado || '').trim().toLowerCase();
        const isActivada = estado === 'activada';
        
        if (isActivada) {
          polizaCountMap[id] = (polizaCountMap[id] || 0) + 1;
        }
        if (!polizaDetailsMap[id]) polizaDetailsMap[id] = [];
        polizaDetailsMap[id].push({
          nombre: p.nombre,
          apellido: p.apellido,
          identificacion: p.identificacion,
          estado: p.estado || '',
        });
      }

      // Get all local notes
      const allNotes = await prisma.reservationNote.findMany();
      const notesMap: Record<string, any> = {};
      for (const note of allNotes) {
        notesMap[note.reservationId] = note;
      }

      // Merge data
      const merged = reservas.map((r: any) => {
        const resId = String(r.id);
        const localNote = notesMap[resId];
        
        return {
          ...r,
          id: resId,
          fecha: normalizeDate(r.fecha),
          horaSalida: normalizeTime(r.horaSalida),
          polizas: {
            enviadas: polizaCountMap[resId] || 0,
            requeridas: r.caballos || 0,
            detalles: polizaDetailsMap[resId] || [],
          },
          localNote: localNote ? {
            status: localNote.status,
            paidBalance: localNote.paidBalance,
            meatNote: localNote.meatNote || '',
            comment: localNote.comment || '',
            bbqTimeOverride: localNote.bbqTimeOverride || undefined,
          } : {
            status: 'PENDIENTE',
            paidBalance: false,
            meatNote: '',
            comment: '',
          }
        };
      });

      return {
        reservations: merged,
        lastUpdated: sheetsData.fetchedAt || new Date().toISOString(),
      };
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/reservations/:id/status — Update reservation status
  // ─────────────────────────────────────────────
  fastify.post('/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const validStatuses = ['PENDIENTE', 'LLEGO', 'EN_RUTA'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const note = await prisma.reservationNote.upsert({
      where: { reservationId: id },
      update: { status },
      create: { reservationId: id, status },
    });

    return note;
  });

  // ─────────────────────────────────────────────
  // POST /api/reservations/:id/paid — Toggle paid balance
  // ─────────────────────────────────────────────
  fastify.post('/:id/paid', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { paidBalance } = request.body as { paidBalance: boolean };

    const note = await prisma.reservationNote.upsert({
      where: { reservationId: id },
      update: { paidBalance },
      create: { reservationId: id, paidBalance },
    });

    return note;
  });

  // ─────────────────────────────────────────────
  // POST /api/reservations/:id/note — Update meat note / comment
  // ─────────────────────────────────────────────
  fastify.post('/:id/note', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { meatNote, comment, bbqTimeOverride } = request.body as { meatNote?: string; comment?: string; bbqTimeOverride?: string };

    const updateData: any = {};
    if (meatNote !== undefined) updateData.meatNote = meatNote;
    if (comment !== undefined) updateData.comment = comment;
    if (bbqTimeOverride !== undefined) updateData.bbqTimeOverride = bbqTimeOverride;

    const note = await prisma.reservationNote.upsert({
      where: { reservationId: id },
      update: updateData,
      create: { reservationId: id, ...updateData },
    });

    return note;
  });

  // ─────────────────────────────────────────────
  // POST /api/reservations/refresh — Force cache invalidation
  // ─────────────────────────────────────────────
  fastify.post('/refresh', { preHandler: [fastify.authenticate] }, async () => {
    sheetsCache = null;
    const data = await fetchFromSheets();
    return { success: true, fetchedAt: data.fetchedAt };
  });
}
