import { FastifyInstance, FastifyRequest } from 'fastify';
import { ProductService } from '../services/product.service.js';

export async function productRoutes(fastify: FastifyInstance) {
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

  // Create category
  fastify.post('/categories', async (request: FastifyRequest, reply) => {
    try {
      const data = request.body as any;
      return ProductService.createCategory(data);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Update category
  fastify.put('/categories/:id', async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      return ProductService.updateCategory(id, data);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Delete category
  // Body: { action: 'delete_products' | 'migrate_products', targetCategoryId?: string }
  fastify.delete('/categories/:id', async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { action, targetCategoryId } = request.body as { action: string, targetCategoryId?: string };
      return ProductService.deleteCategory(id, action, targetCategoryId);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Create product
  fastify.post('/', async (request: FastifyRequest, reply) => {
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

  // Update product
  fastify.put('/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    return ProductService.updateProduct(id, data);
  });

  // Delete all products
  fastify.delete('/all', async () => {
    return ProductService.deleteAllProducts();
  });

  // Delete all categories
  fastify.delete('/categories/all', async () => {
    return ProductService.deleteAllCategories();
  });

  // Import CSV data
  fastify.post('/import', async (request: FastifyRequest, reply) => {
    try {
      const { rows } = request.body as { rows: any[] };
      const result = await ProductService.importCSV(rows);
      return result;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: error.message || 'Error importing products' });
    }
  });
}
