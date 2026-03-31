import { FastifyInstance } from 'fastify';
import { ConfigService } from '../services/config.service.js';

export async function configRoutes(fastify: FastifyInstance) {
  // All config routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // ========== PRINTERS ==========

  fastify.get('/printers', async (_request, reply) => {
    try {
      return await ConfigService.listPrinters();
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.post('/printers', async (request, reply) => {
    try {
      const body: any = request.body;
      const printer = await ConfigService.createPrinter(body);
      return reply.status(201).send(printer);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/printers/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body: any = request.body;
      const printer = await ConfigService.updatePrinter(id, body);
      return printer;
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.delete('/printers/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      await ConfigService.deletePrinter(id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // ========== PRINT SETTINGS ==========

  fastify.get('/print-settings', async (_request, reply) => {
    try {
      return await ConfigService.getPrintSettings();
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/print-settings', async (request, reply) => {
    try {
      const body: any = request.body;
      const settings = await ConfigService.updatePrintSettings(body);
      return settings;
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });
}
