import { FastifyInstance, FastifyRequest } from 'fastify';
import { ProductService } from '../services/product.service.js';
import { prisma } from '../utils/db.js';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { authorize } from '../utils/rbac.js';

export async function productRoutes(fastify: FastifyInstance) {
  // All product routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);
  // Get all products (with optional search)
  fastify.get('/', async (request: FastifyRequest) => {
    const { search, categoryId } = request.query as { search?: string, categoryId?: string };
    if (search) {
      return ProductService.getProducts(search);
    }
    if (categoryId) {
      return ProductService.getProductsByCategory(categoryId);
    }
    return ProductService.getProducts();
  });

  // Get favorites
  fastify.get('/favorites', async () => {
    return ProductService.getFavorites();
  });

  // Get categories
  fastify.get('/categories', async () => {
    return ProductService.getCategories();
  });

  // Create category (ADMIN + CAJERO only)
  fastify.post('/categories', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply) => {
    try {
      const data = request.body as any;
      return ProductService.createCategory(data);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Update category (ADMIN + CAJERO only)
  fastify.put('/categories/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      return ProductService.updateCategory(id, data);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Delete category (ADMIN + CAJERO only)
  fastify.delete('/categories/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { action, targetCategoryId } = request.body as { action: string, targetCategoryId?: string };
      return ProductService.deleteCategory(id, action, targetCategoryId);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Create product (ADMIN + CAJERO only)
  fastify.post('/', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply) => {
    try {
      const data = request.body as any;
      return ProductService.createProduct(data);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get single product
  fastify.get('/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    return ProductService.getProductById(id);
  });

  // Update product (ADMIN + CAJERO only)
  fastify.put('/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    return ProductService.updateProduct(id, data);
  });

  // Delete single product (ADMIN + CAJERO only)
  fastify.delete('/:id', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      // Clean up attached image file
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) return reply.code(404).send({ error: 'Producto no encontrado' });
      if (product.imageUrl) {
        const filename = product.imageUrl.split('/').pop();
        if (filename) {
          const filepath = path.join(process.cwd(), 'uploads', 'products', filename);
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }
      }
      const result = await ProductService.deleteProduct(id);
      return result;
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Delete all products (ADMIN + CAJERO only)
  fastify.delete('/all', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async () => {
    return ProductService.deleteAllProducts();
  });

  // Delete all categories (ADMIN + CAJERO only)
  fastify.delete('/categories/all', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async () => {
    return ProductService.deleteAllCategories();
  });

  // Import CSV data (ADMIN + CAJERO only)
  fastify.post('/import', { preHandler: [authorize(['ADMIN', 'CAJERO'])] }, async (request: FastifyRequest, reply) => {
    try {
      const { rows } = request.body as { rows: any[] };
      const result = await ProductService.importCSV(rows);
      return result;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: error.message || 'Error importing products' });
    }
  });

  // ── Image Upload ─────────────────────────────────────────────────────

  // Upload product image
  fastify.post('/:id/image', async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = await request.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });

      const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
      fs.mkdirSync(uploadsDir, { recursive: true });

      const ext = path.extname(data.filename) || '.jpg';
      const filename = `${id}${ext}`;
      const filepath = path.join(uploadsDir, filename);

      await pipeline(data.file, fs.createWriteStream(filepath));

      const imageUrl = `/api/uploads/products/${filename}`;

      const product = await prisma.product.update({
        where: { id },
        data: { imageUrl },
        include: { category: true },
      });

      return product;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: error.message || 'Error uploading image' });
    }
  });

  // Delete product image
  fastify.delete('/:id/image', async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await prisma.product.findUnique({ where: { id } });
      if (product?.imageUrl) {
        // Try to delete the file
        const filename = product.imageUrl.split('/').pop();
        if (filename) {
          const filepath = path.join(process.cwd(), 'uploads', 'products', filename);
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }
      }
      const updated = await prisma.product.update({
        where: { id },
        data: { imageUrl: null },
        include: { category: true },
      });
      return updated;
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Upload category image
  fastify.post('/categories/:id/image', async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = await request.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });

      const uploadsDir = path.join(process.cwd(), 'uploads', 'categories');
      fs.mkdirSync(uploadsDir, { recursive: true });

      const ext = path.extname(data.filename) || '.jpg';
      const filename = `${id}${ext}`;
      const filepath = path.join(uploadsDir, filename);

      await pipeline(data.file, fs.createWriteStream(filepath));

      const imageUrl = `/api/uploads/categories/${filename}`;

      const category = await prisma.category.update({
        where: { id },
        data: { imageUrl },
        include: { products: true },
      });

      return category;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: error.message || 'Error uploading image' });
    }
  });
}
