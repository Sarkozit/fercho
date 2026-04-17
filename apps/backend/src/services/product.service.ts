import { prisma } from '../utils/db.js';

export class ProductService {
  static async getProducts(search?: string) {
    return prisma.product.findMany({
      where: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } }
        ]
      } : {},
      include: { category: true },
      orderBy: { name: 'asc' }
    });
  }

  static async getProductsByCategory(categoryId: string) {
    return prisma.product.findMany({
      where: { categoryId },
      include: { category: true },
      orderBy: { name: 'asc' }
    });
  }

  static async getProductById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: { category: true }
    });
  }

  static async getFavorites() {
    return prisma.product.findMany({
      where: { favorite: true },
      take: 8
    });
  }

  static async getCategories() {
    return prisma.category.findMany({
      include: { products: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  static async updateProduct(id: string, data: any) {
    return prisma.product.update({
      where: { id },
      data,
      include: { category: true }
    });
  }

  static async createProduct(data: { name: string; categoryId: string; price: number; code?: string; kitchen?: string; active?: boolean; onlineMenu?: boolean; favorite?: boolean }) {
    return prisma.product.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        price: data.price,
        code: data.code || null,
        kitchen: data.kitchen || 'Cocina',
        active: data.active ?? true,
        onlineMenu: data.onlineMenu ?? true,
        favorite: data.favorite ?? false,
      },
      include: { category: true }
    });
  }

  static async createCategory(data: { name: string; onlineMenu?: boolean; sortOrder?: number }) {
    const maxOrder = await prisma.category.aggregate({ _max: { sortOrder: true } });
    return prisma.category.create({
      data: {
        name: data.name,
        onlineMenu: data.onlineMenu ?? true,
        sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
      include: { products: true }
    });
  }

  static async updateCategory(id: string, data: { name?: string; onlineMenu?: boolean; sortOrder?: number }) {
    return prisma.category.update({
      where: { id },
      data,
      include: { products: true }
    });
  }

  static async deleteCategory(id: string, action: string, targetCategoryId?: string) {
    if (action === 'migrate_products') {
      if (!targetCategoryId) throw new Error('targetCategoryId is required for migrate_products action');
      await prisma.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: targetCategoryId }
      });
    } else if (action === 'delete_products') {
      // Remove sale items referencing these products first
      const products = await prisma.product.findMany({ where: { categoryId: id }, select: { id: true } });
      const productIds = products.map(p => p.id);
      await prisma.saleItem.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { categoryId: id } });
    } else {
      throw new Error('Invalid action. Use delete_products or migrate_products');
    }
    await prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  static async deleteProduct(id: string) {
    // Remove sale items referencing this product first (FK constraint)
    await prisma.saleItem.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  static async deleteAllProducts() {
    // Delete sale items first to avoid FK constraints
    await prisma.saleItem.deleteMany({});
    await prisma.product.deleteMany({});
    return { deleted: true };
  }

  static async deleteAllCategories() {
    await prisma.category.deleteMany({});
    return { deleted: true };
  }

  static async importCSV(rows: any[]) {
    const categoryMap = new Map<string, string>();
    let sortOrder = 0;

    // First pass: create categories
    for (const row of rows) {
      const categoryName = row.category?.trim();
      if (categoryName && !categoryMap.has(categoryName)) {
        const existing = await prisma.category.findUnique({
          where: { name: categoryName }
        });
        if (existing) {
          categoryMap.set(categoryName, existing.id);
        } else {
          const cat = await prisma.category.create({
            data: { name: categoryName, sortOrder: sortOrder++ }
          });
          categoryMap.set(categoryName, cat.id);
        }
      }
    }

    // Second pass: create products
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const categoryName = row.category?.trim();
      const categoryId = categoryMap.get(categoryName);
      if (!categoryId) { skipped++; continue; }

      const name = row.name?.trim();
      if (!name) { skipped++; continue; }

      const parseBoolean = (val: any) => {
        if (typeof val === 'boolean') return val;
        if (!val) return false;
        const s = String(val).trim().toLowerCase();
        return ['si', 'sí', 's', 'activo', 'true', '1', 'v', 'verdadero', 'yes', 'y'].includes(s);
      };

      try {
        await prisma.product.create({
          data: {
            code: row.code?.toString().trim() || null,
            name,
            price: parseFloat(row.price) || 0,
            categoryId,
            active: parseBoolean(row.active),
            favorite: parseBoolean(row.favorite),
            onlineMenu: parseBoolean(row.onlineMenu),
            kitchen: row.kitchen?.trim() || 'Cocina',
          }
        });
        created++;
      } catch (err: any) {
        console.error(`Skipping product "${name}":`, err.message);
        skipped++;
      }
    }

    return { created, skipped, categories: categoryMap.size };
  }
}
