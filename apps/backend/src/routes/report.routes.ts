import { FastifyInstance, FastifyRequest } from 'fastify';
import { ReportService } from '../services/report.service.js';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.get('/daily-balance', async () => {
    return ReportService.getDailyBalance();
  });

  fastify.get('/sales-dashboard', async (request: FastifyRequest) => {
    const { startDate, endDate } = request.query as { startDate?: string, endDate?: string };
    return ReportService.getSalesDashboard(startDate, endDate);
  });
}
