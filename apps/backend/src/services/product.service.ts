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

  static async createProduct(data: { name: string; categoryId: string; price: number; cost?: number; code?: string; kitchen?: string; active?: boolean; onlineMenu?: boolean; favorite?: boolean; supplierId?: string; packSize?: number; packName?: string }) {
    return prisma.product.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        price: data.price,
        cost: data.cost ?? 0,
        code: data.code || null,
        kitchen: data.kitchen || 'Cocina',
        active: data.active ?? true,
        onlineMenu: data.onlineMenu ?? true,
        favorite: data.favorite ?? false,
        supplierId: data.supplierId || null,
        packSize: data.packSize ?? 1,
        packName: data.packName || 'Unidad',
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
    const supplierMap = new Map<string, string>();

    // First pass: create categories and suppliers
    for (const row of rows) {
      const rawRow = row as Record<string, any>;
      const lowerKeysRow: Record<string, any> = {};
      for (const k of Object.keys(rawRow)) {
        lowerKeysRow[k.toLowerCase().trim()] = rawRow[k];
      }

      const supplierName = lowerKeysRow['proveedor']?.toString().trim();
      if (supplierName && !supplierMap.has(supplierName)) {
        let supp = await prisma.supplier.findUnique({ where: { name: supplierName } });
        if (!supp) {
          supp = await prisma.supplier.create({ data: { name: supplierName, active: true } });
        }
        supplierMap.set(supplierName, supp.id);
      }

      const categoryName = lowerKeysRow['categoría']?.toString().trim() || lowerKeysRow['categoria']?.toString().trim();
      if (categoryName && !categoryMap.has(categoryName)) {
        let cat = await prisma.category.findUnique({ where: { name: categoryName } });
        if (!cat) {
          const maxOrder = await prisma.category.aggregate({ _max: { sortOrder: true } });
          cat = await prisma.category.create({ data: { name: categoryName, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 } });
        }
        categoryMap.set(categoryName, cat.id);
      }
    }

    // Second pass: Upsert products/items
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const rawRow = row as Record<string, any>;
      const lowerKeysRow: Record<string, any> = {};
      for (const k of Object.keys(rawRow)) {
        lowerKeysRow[k.toLowerCase().trim()] = rawRow[k];
      }

      const tipo = (lowerKeysRow['tipo']?.toString().trim().toUpperCase()) || 'OPERACION';
      const name = lowerKeysRow['nombre']?.toString().trim();
      if (!name) { skipped++; continue; }

      const supplierName = lowerKeysRow['proveedor']?.toString().trim();
      const supplierId = supplierName ? supplierMap.get(supplierName) : null;

      const categoryName = lowerKeysRow['categoría']?.toString().trim() || lowerKeysRow['categoria']?.toString().trim();
      const categoryId = categoryName ? categoryMap.get(categoryName) : null;

      const costStr = String(lowerKeysRow['costo'] || '0').replace(/[^0-9.,]/g, '').replace(',', '.');
      const cost = parseFloat(costStr) || 0;

      const priceStr = String(lowerKeysRow['precio'] || '0').replace(/[^0-9.,]/g, '').replace(',', '.');
      const price = parseFloat(priceStr) || 0;

      const idealStock = parseInt(lowerKeysRow['stock_ideal'] || '0') || 0;
      const unit = lowerKeysRow['unidad']?.toString().trim() || 'und';
      const packSize = parseInt(lowerKeysRow['presentacion_cant'] || '1') || 1;
      const packName = lowerKeysRow['presentacion_nombre']?.toString().trim() || 'Unidad';

      try {
        if (tipo === 'POS') {
          if (!categoryId) { skipped++; continue; } // POS needs category
          await prisma.product.upsert({
            where: { name },
            update: {
              price, cost, idealStock, unit, packSize, packName, categoryId,
              supplierId: supplierId || null
            },
            create: {
              name, price, cost, idealStock, unit, packSize, packName, categoryId,
              supplierId: supplierId || null,
              active: true, onlineMenu: true, kitchen: 'Cocina', favorite: false
            }
          });
        } else {
          // OPERACION
          await prisma.inventoryItem.upsert({
            where: { name },
            update: {
              cost, idealStock, unit, packSize, packName,
              categoryTag: categoryName || 'General',
              supplierId: supplierId || null
            },
            create: {
              name, cost, idealStock, unit, packSize, packName,
              categoryTag: categoryName || 'General',
              supplierId: supplierId || null,
              active: true
            }
          });
        }
        created++;
      } catch (err: any) {
        console.error(`Skipping "${name}":`, err.message);
        skipped++;
      }
    }

    return { created, skipped, categories: categoryMap.size, suppliers: supplierMap.size };
  }
}
