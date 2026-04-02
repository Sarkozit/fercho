import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/db.js';
import { fetchFromSheetsAPI, invalidateCache } from '../services/sheets.service.js';

export async function reservationRoutes(fastify: FastifyInstance) {

  // ─────────────────────────────────────────────
  // GET /api/reservations — Fetch reservations + merge local notes
  // ─────────────────────────────────────────────
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const sheetsData = await fetchFromSheetsAPI();
      
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
    invalidateCache();
    const data = await fetchFromSheetsAPI();
    return { success: true, fetchedAt: data.fetchedAt };
  });
}
