import { prisma } from '../utils/db.js';

export class ReportService {
  static async getDailyBalance() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all sale items from today's sales, joining with product to check excludeFromReports
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          startedAt: { gte: today },
        },
      },
      include: {
        product: { select: { excludeFromReports: true } },
      },
    });

    // Sum only items from products NOT excluded from reports
    const totalSales = saleItems
      .filter(item => !item.product.excludeFromReports)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const expenses = await prisma.expense.aggregate({
      where: {
        date: {
          gte: today,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const totalExpenses = expenses._sum.amount || 0;
    const balance = totalSales - totalExpenses;

    return { totalSales, totalExpenses, balance };
  }

  static async getSalesDashboard(startDate?: string, endDate?: string) {
    let dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) {
        const [year, month, day] = startDate.split('-').map(Number);
        dateFilter.gte = new Date(year, month - 1, day);
      }
      if (endDate) {
        const [year, month, day] = endDate.split('-').map(Number);
        const end = new Date(year, month - 1, day);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter.gte = today;
    }

    // Get all sale items with product info to filter excluded products
    const allSaleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          startedAt: dateFilter,
        },
      },
      include: {
        product: { select: { excludeFromReports: true } },
        sale: { select: { id: true } },
      },
    });

    // Calculate total sales excluding excluded products
    const totalSales = allSaleItems
      .filter(item => !item.product.excludeFromReports)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const expenses = await prisma.expense.aggregate({
      where: { date: dateFilter },
      _sum: { amount: true },
    });

    // For payment totals, we need to proportionally attribute payments
    // Simple approach: use the full payment amounts since payments are tied to sales
    // But we need to subtract the excluded product amounts from each sale's payment attribution
    // Simpler: get payments grouped by method, then subtract excluded amounts proportionally
    // Simplest correct approach: calculate non-excluded total per sale, then scale payments proportionally

    // Get all sales with payments and items in the date range
    const salesWithPayments = await prisma.sale.findMany({
      where: {
        startedAt: dateFilter,
      },
      include: {
        payments: true,
        items: {
          include: {
            product: { select: { excludeFromReports: true } },
          },
        },
      },
    });

    const paymentTotals = { Efectivo: 0, Bold: 0, QR: 0 };
    for (const sale of salesWithPayments) {
      const saleFullTotal = sale.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const saleReportTotal = sale.items
        .filter(i => !i.product.excludeFromReports)
        .reduce((sum, i) => sum + (i.price * i.quantity), 0);

      // Scale factor: what proportion of the sale is reportable
      const scale = saleFullTotal > 0 ? saleReportTotal / saleFullTotal : 1;

      for (const payment of sale.payments) {
        const scaledAmount = Math.round(payment.amount * scale);
        if (payment.method === 'Efectivo') paymentTotals.Efectivo += scaledAmount;
        else if (payment.method === 'Bold') paymentTotals.Bold += scaledAmount;
        else if (payment.method === 'QR') paymentTotals.QR += scaledAmount;
      }
    }

    const bestSelling = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          startedAt: dateFilter
        }
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 20
    });

    const productIds = bestSelling.map(bs => bs.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    const productSales = bestSelling.map(bs => {
      const product = products.find(p => p.id === bs.productId);
      return {
        id: bs.productId,
        name: product?.name || 'Producto Eliminado',
        quantity: bs._sum.quantity || 0,
        revenue: (bs._sum.quantity || 0) * (product?.price || 0)
      };
    });

    const totalExpenses = expenses._sum.amount || 0;
    const cashNet = paymentTotals.Efectivo - totalExpenses;

    const salesHistory = await prisma.sale.findMany({
      where: {
        startedAt: dateFilter,
        status: 'CLOSED',
      },
      include: {
        user: { select: { name: true } },
        items: {
          include: { product: { select: { name: true, kitchen: true } } }
        },
        payments: true
      },
      orderBy: { closedAt: 'desc' }
    });

    return {
      totalSales,
      totalExpenses,
      cashNet,
      paymentTotals,
      productSales,
      salesHistory
    };
  }
}
