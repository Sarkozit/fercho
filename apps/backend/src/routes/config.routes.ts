import { FastifyInstance } from 'fastify';
import { ConfigService } from '../services/config.service.js';
import { authorize } from '../utils/rbac.js';

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

  fastify.post('/printers', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const body: any = request.body;
      const printer = await ConfigService.createPrinter(body);
      return reply.status(201).send(printer);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/printers/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body: any = request.body;
      const printer = await ConfigService.updatePrinter(id, body);
      return printer;
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.delete('/printers/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
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

  fastify.put('/print-settings', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const body: any = request.body;
      const settings = await ConfigService.updatePrintSettings(body);
      return settings;
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // ========== APP SETTINGS ==========

  fastify.get('/app-settings', async (_request, reply) => {
    try {
      return await ConfigService.getAppSettings();
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/app-settings', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const body: any = request.body;
      const settings = await ConfigService.updateAppSettings(body);
      return settings;
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // ========== KITCHENS ==========

  fastify.get('/kitchens', async (_request, reply) => {
    try {
      return await ConfigService.listKitchens();
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.post('/kitchens', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const body: any = request.body;
      const kitchen = await ConfigService.createKitchen(body);
      return reply.status(201).send(kitchen);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/kitchens/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body: any = request.body;
      return await ConfigService.updateKitchen(id, body);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.delete('/kitchens/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await ConfigService.deleteKitchen(id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // ========== PAYMENT METHODS ==========

  fastify.get('/payment-methods', async (_request, reply) => {
    try {
      return await ConfigService.listPaymentMethods();
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.post('/payment-methods', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const body: any = request.body;
      const pm = await ConfigService.createPaymentMethod(body);
      return reply.status(201).send(pm);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/payment-methods/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body: any = request.body;
      return await ConfigService.updatePaymentMethod(id, body);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.delete('/payment-methods/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await ConfigService.deletePaymentMethod(id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  // ===== SUPPLIERS =====
  fastify.get('/suppliers', async () => {
    return ConfigService.listSuppliers();
  });

  fastify.post('/suppliers', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { name, phone, contactName, notes, active } = request.body as any;
      if (!name?.trim()) return reply.status(400).send({ message: 'El nombre es requerido' });
      return ConfigService.createSupplier({ name: name.trim(), phone, contactName, notes, active });
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.put('/suppliers/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      return ConfigService.updateSupplier(id, data);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.delete('/suppliers/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await ConfigService.deleteSupplier(id);
      return { success: true };
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  });
}
