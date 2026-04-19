import { prisma } from '../utils/db.js';

export class InventoryService {
  // ===== INVENTORY ITEMS (non-POS products for operations) =====
  static async listInventoryItems() {
    return prisma.inventoryItem.findMany({
      include: { supplier: true },
      orderBy: [{ categoryTag: 'asc' }, { name: 'asc' }],
    });
  }

  static async createInventoryItem(data: { name: string; unit?: string; cost?: number; idealStock?: number; packSize?: number; packName?: string; categoryTag?: string; supplierId?: string }) {
    return prisma.inventoryItem.create({
      data: {
        name: data.name,
        unit: data.unit || 'und',
        cost: data.cost ?? 0,
        idealStock: data.idealStock ?? 0,
        packSize: data.packSize ?? 1,
        packName: data.packName || 'Unidad',
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
    if (data.packSize !== undefined) clean.packSize = data.packSize;
    if (data.packName !== undefined) clean.packName = data.packName;
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
    let expectedStock: number | null = null;
    let discrepancy: number | null = null;

    if (data.productId) {
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (product && product.idealStock > 0) {
        // Get the last count date for this product
        const lastCount = await prisma.inventoryCount.findFirst({
          where: { productId: data.productId },
          orderBy: { countDate: 'desc' },
        });
        const sinceDate = lastCount ? lastCount.countDate : new Date(0);
        const lastStock = lastCount ? lastCount.currentStock : product.idealStock;

        // Sales since last count (not fixed 8 days)
        const salesAgg = await prisma.saleItem.aggregate({
          where: {
            productId: data.productId,
            sale: { status: 'CLOSED', closedAt: { gte: sinceDate } },
          },
          _sum: { quantity: true },
        });
        const sold = salesAgg._sum.quantity || 0;
        expectedStock = lastStock - sold;
        discrepancy = data.currentStock - expectedStock;
      }
    }

    if (data.inventoryItemId) {
      const item = await prisma.inventoryItem.findUnique({ where: { id: data.inventoryItemId } });
      if (item) {
        // For inventory items: check last count
        const lastCount = await prisma.inventoryCount.findFirst({
          where: { inventoryItemId: data.inventoryItemId },
          orderBy: { countDate: 'desc' },
        });
        const lastStock = lastCount ? lastCount.currentStock : item.idealStock;
        expectedStock = lastStock; // No POS sales for these
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
    const productCounts = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON ("productId") *
      FROM "InventoryCount"
      WHERE "productId" IS NOT NULL
      ORDER BY "productId", "countDate" DESC
    `;
    const itemCounts = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON ("inventoryItemId") *
      FROM "InventoryCount"
      WHERE "inventoryItemId" IS NOT NULL
      ORDER BY "inventoryItemId", "countDate" DESC
    `;
    return { productCounts, itemCounts };
  }

  // ===== RECEIVE ORDER: bulk add stock =====
  static async receiveOrder(items: { id: string; type: 'product' | 'inventory_item'; received: number }[], userId: string) {
    const results = [];
    for (const item of items) {
      if (item.received <= 0) continue;

      // Get current stock from latest count
      let currentStock = 0;
      if (item.type === 'product') {
        const lastCount = await prisma.inventoryCount.findFirst({
          where: { productId: item.id },
          orderBy: { countDate: 'desc' },
        });
        currentStock = lastCount ? lastCount.currentStock : 0;
      } else {
        const lastCount = await prisma.inventoryCount.findFirst({
          where: { inventoryItemId: item.id },
          orderBy: { countDate: 'desc' },
        });
        currentStock = lastCount ? lastCount.currentStock : 0;
      }

      // Create new count = current + received
      const newStock = currentStock + item.received;
      const count = await prisma.inventoryCount.create({
        data: {
          productId: item.type === 'product' ? item.id : null,
          inventoryItemId: item.type === 'inventory_item' ? item.id : null,
          currentStock: newStock,
          expectedStock: null,
          discrepancy: null,
          countedBy: userId,
          notes: `Pedido recibido: +${item.received} unidades`,
        },
      });
      results.push(count);
    }
    return results;
  }

  // ===== DASHBOARD: Full inventory overview =====
  static async getDashboard() {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { supplier: true, category: true },
      orderBy: { name: 'asc' },
    });

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { active: true },
      include: { supplier: true },
      orderBy: { name: 'asc' },
    });

    const { productCounts, itemCounts } = await this.getLatestCounts();
    const productCountMap = new Map(productCounts.map((c: any) => [c.productId, c]));
    const itemCountMap = new Map(itemCounts.map((c: any) => [c.inventoryItemId, c]));

    // Sales SINCE LAST COUNT for each product (not fixed 8 days)
    const salesMap = new Map<string, number>();
    for (const product of products) {
      const lastCount = productCountMap.get(product.id);
      const sinceDate = lastCount ? lastCount.countDate : new Date(0);
      const salesAgg = await prisma.saleItem.aggregate({
        where: {
          productId: product.id,
          sale: { status: 'CLOSED', closedAt: { gte: sinceDate } },
        },
        _sum: { quantity: true },
      });
      salesMap.set(product.id, salesAgg._sum.quantity || 0);
    }

    const suppliers = await prisma.supplier.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

    // Build unified list
    const allItems = [
      ...products.map(p => {
        const lastCount = productCountMap.get(p.id);
        const sold = salesMap.get(p.id) || 0;
        const lastStock = lastCount ? lastCount.currentStock : null;
        const expectedStock = lastStock !== null ? lastStock - sold : null;
        const discrepancy = expectedStock !== null ? (lastStock! - sold) - (lastStock! - sold) : null;
        // For ordering: compare current estimated stock vs ideal
        const currentEstimated = lastStock !== null ? lastStock - sold : null;
        return {
          id: p.id,
          type: 'product' as const,
          name: p.name,
          category: p.category?.name || '',
          unit: (p as any).unit || 'und',
          cost: p.cost,
          price: p.price,
          idealStock: p.idealStock,
          packSize: (p as any).packSize || 1,
          packName: (p as any).packName || 'Unidad',
          currentStock: currentEstimated,
          lastCountStock: lastStock,
          expectedStock,
          sold,
          discrepancy: lastCount ? lastCount.discrepancy : null,
          supplierId: p.supplierId,
          supplierName: p.supplier?.name || null,
          lastCountDate: lastCount?.countDate || null,
        };
      }),
      ...inventoryItems.map(item => {
        const lastCount = itemCountMap.get(item.id);
        const currentStock = lastCount ? lastCount.currentStock : null;
        return {
          id: item.id,
          type: 'inventory_item' as const,
          name: item.name,
          category: item.categoryTag,
          unit: item.unit,
          cost: item.cost,
          price: 0,
          idealStock: item.idealStock,
          packSize: item.packSize || 1,
          packName: item.packName || 'Unidad',
          currentStock,
          lastCountStock: currentStock,
          expectedStock: item.idealStock > 0 ? item.idealStock : null,
          sold: 0,
          discrepancy: lastCount ? lastCount.discrepancy : null,
          supplierId: item.supplierId,
          supplierName: item.supplier?.name || null,
          lastCountDate: lastCount?.countDate || null,
        };
      }),
    ];

    // Alerts: items with negative discrepancy from latest count
    const alerts = allItems.filter(i => i.discrepancy !== null && i.discrepancy < 0);

    // Order suggestions grouped by supplier (with pack calculation)
    const orderBySupplier = suppliers.map(sup => {
      const items = allItems.filter(i => i.supplierId === sup.id && i.idealStock > 0);
      const orderItems = items
        .filter(i => i.currentStock !== null && i.currentStock < i.idealStock)
        .map(i => {
          const needed = i.idealStock - (i.currentStock || 0);
          const packs = Math.ceil(needed / i.packSize);
          const unitsToOrder = packs * i.packSize;
          return {
            ...i,
            needed,
            packs,
            unitsToOrder,
            subtotal: unitsToOrder * i.cost,
          };
        });
      const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0);
      return { supplier: sup, items: orderItems, total };
    }).filter(g => g.items.length > 0);

    return { allItems, alerts, orderBySupplier, suppliers };
  }
}
