import { prisma } from '../utils/db.js';

export class InventoryService {
  // ===== INVENTORY ITEMS (non-POS products for operations) =====
  static async listInventoryItems() {
    return prisma.inventoryItem.findMany({
      include: { supplier: true },
      orderBy: [{ categoryTag: 'asc' }, { name: 'asc' }],
    });
  }

  static async createInventoryItem(data: { name: string; unit?: string; cost?: number; idealStock?: number; categoryTag?: string; supplierId?: string }) {
    return prisma.inventoryItem.create({
      data: {
        name: data.name,
        unit: data.unit || 'und',
        cost: data.cost ?? 0,
        idealStock: data.idealStock ?? 0,
        categoryTag: data.categoryTag || 'General',
        supplierId: data.supplierId || null,
      },
      include: { supplier: true },
    });
  }

  static async updateInventoryItem(id: string, data: any) {
    const clean: any = {};
    if (data.name !== undefined) clean.name = data.name;
    if (data.unit !== undefined) clean.unit = data.unit;
    if (data.cost !== undefined) clean.cost = data.cost;
    if (data.idealStock !== undefined) clean.idealStock = data.idealStock;
    if (data.categoryTag !== undefined) clean.categoryTag = data.categoryTag;
    if (data.supplierId !== undefined) clean.supplierId = data.supplierId || null;
    if (data.active !== undefined) clean.active = data.active;
    return prisma.inventoryItem.update({ where: { id }, data: clean, include: { supplier: true } });
  }

  static async deleteInventoryItem(id: string) {
    await prisma.inventoryCount.deleteMany({ where: { inventoryItemId: id } });
    return prisma.inventoryItem.delete({ where: { id } });
  }

  // ===== INVENTORY COUNTS =====
  static async createCount(data: { productId?: string; inventoryItemId?: string; currentStock: number; countedBy: string; notes?: string }) {
    // Calculate expected stock for products based on sales
    let expectedStock: number | null = null;
    let discrepancy: number | null = null;

    if (data.productId) {
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (product && product.idealStock > 0) {
        // Get sales in the last 8 days
        const eightDaysAgo = new Date();
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
        const salesAgg = await prisma.saleItem.aggregate({
          where: {
            productId: data.productId,
            sale: { status: 'CLOSED', closedAt: { gte: eightDaysAgo } },
          },
          _sum: { quantity: true },
        });
        const sold = salesAgg._sum.quantity || 0;
        expectedStock = product.idealStock - sold;
        discrepancy = data.currentStock - expectedStock;
      }
    }

    if (data.inventoryItemId) {
      const item = await prisma.inventoryItem.findUnique({ where: { id: data.inventoryItemId } });
      if (item && item.idealStock > 0) {
        expectedStock = item.idealStock;
        discrepancy = data.currentStock - expectedStock;
      }
    }

    return prisma.inventoryCount.create({
      data: {
        productId: data.productId || null,
        inventoryItemId: data.inventoryItemId || null,
        currentStock: data.currentStock,
        expectedStock,
        discrepancy,
        countedBy: data.countedBy,
        notes: data.notes || null,
      },
    });
  }

  // Get the latest count for each product/item
  static async getLatestCounts() {
    // Latest counts for POS products
    const productCounts = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON ("productId") *
      FROM "InventoryCount"
      WHERE "productId" IS NOT NULL
      ORDER BY "productId", "countDate" DESC
    `;

    // Latest counts for inventory items
    const itemCounts = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON ("inventoryItemId") *
      FROM "InventoryCount"
      WHERE "inventoryItemId" IS NOT NULL
      ORDER BY "inventoryItemId", "countDate" DESC
    `;

    return { productCounts, itemCounts };
  }

  // ===== DASHBOARD: Full inventory overview =====
  static async getDashboard() {
    // 1. Get all POS products with supplier and idealStock > 0
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { supplier: true, category: true },
      orderBy: { name: 'asc' },
    });

    // 2. Get all inventory items
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { active: true },
      include: { supplier: true },
      orderBy: { name: 'asc' },
    });

    // 3. Get latest counts
    const { productCounts, itemCounts } = await this.getLatestCounts();
    const productCountMap = new Map(productCounts.map((c: any) => [c.productId, c]));
    const itemCountMap = new Map(itemCounts.map((c: any) => [c.inventoryItemId, c]));

    // 4. Get sales in last 8 days for discrepancy calculation
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    const salesByProduct = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { status: 'CLOSED', closedAt: { gte: eightDaysAgo } },
      },
      _sum: { quantity: true },
    });
    const salesMap = new Map(salesByProduct.map(s => [s.productId, s._sum.quantity || 0]));

    // 5. Get all suppliers
    const suppliers = await prisma.supplier.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

    // 6. Build unified list
    const allItems = [
      ...products.map(p => {
        const lastCount = productCountMap.get(p.id);
        const sold = salesMap.get(p.id) || 0;
        const expectedStock = p.idealStock > 0 ? p.idealStock - sold : null;
        const currentStock = lastCount ? lastCount.currentStock : null;
        const discrepancy = (expectedStock !== null && currentStock !== null) ? currentStock - expectedStock : null;
        return {
          id: p.id,
          type: 'product' as const,
          name: p.name,
          category: p.category?.name || '',
          unit: (p as any).unit || 'und',
          cost: p.cost,
          price: p.price,
          idealStock: p.idealStock,
          currentStock,
          expectedStock,
          sold,
          discrepancy,
          supplierId: p.supplierId,
          supplierName: p.supplier?.name || null,
          lastCountDate: lastCount?.countDate || null,
        };
      }),
      ...inventoryItems.map(item => {
        const lastCount = itemCountMap.get(item.id);
        const currentStock = lastCount ? lastCount.currentStock : null;
        const discrepancy = (item.idealStock > 0 && currentStock !== null) ? currentStock - item.idealStock : null;
        return {
          id: item.id,
          type: 'inventory_item' as const,
          name: item.name,
          category: item.categoryTag,
          unit: item.unit,
          cost: item.cost,
          price: 0,
          idealStock: item.idealStock,
          currentStock,
          expectedStock: item.idealStock > 0 ? item.idealStock : null,
          sold: 0,
          discrepancy,
          supplierId: item.supplierId,
          supplierName: item.supplier?.name || null,
          lastCountDate: lastCount?.countDate || null,
        };
      }),
    ];

    // 7. Alerts: items with negative discrepancy
    const alerts = allItems.filter(i => i.discrepancy !== null && i.discrepancy < 0);

    // 8. Order suggestions grouped by supplier
    const orderBySupplier = suppliers.map(sup => {
      const items = allItems.filter(i => i.supplierId === sup.id && i.idealStock > 0);
      const orderItems = items
        .filter(i => i.currentStock !== null && i.currentStock < i.idealStock)
        .map(i => ({
          ...i,
          toOrder: i.idealStock - (i.currentStock || 0),
          subtotal: (i.idealStock - (i.currentStock || 0)) * i.cost,
        }));
      const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0);
      return { supplier: sup, items: orderItems, total };
    }).filter(g => g.items.length > 0);

    return { allItems, alerts, orderBySupplier, suppliers };
  }
}
