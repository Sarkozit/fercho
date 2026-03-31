import { prisma } from '../utils/db.js';

export class ReportService {
  static async getDailyBalance() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sales = await prisma.sale.aggregate({
      where: {
        status: 'CLOSED',
        closedAt: {
          gte: today,
        },
      },
      _sum: {
        total: true,
      },
    });

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

    const totalSales = sales._sum.total || 0;
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

    const sales = await prisma.sale.aggregate({
      where: {
        status: 'CLOSED',
        closedAt: dateFilter,
      },
      _sum: { total: true },
    });

    const expenses = await prisma.expense.aggregate({
      where: { date: dateFilter },
      _sum: { amount: true },
    });

    const payments = await prisma.payment.groupBy({
      by: ['method'],
      where: { createdAt: dateFilter },
      _sum: { amount: true }
    });

    const paymentTotals = { Efectivo: 0, Bold: 0, QR: 0 };
    payments.forEach(p => {
      if (p.method === 'Efectivo') paymentTotals.Efectivo += p._sum.amount || 0;
      if (p.method === 'Bold') paymentTotals.Bold += p._sum.amount || 0;
      if (p.method === 'QR') paymentTotals.QR += p._sum.amount || 0;
    });

    const bestSelling = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          status: 'CLOSED',
          closedAt: dateFilter
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

    const totalSales = sales._sum.total || 0;
    const totalExpenses = expenses._sum.amount || 0;
    const cashNet = paymentTotals.Efectivo - totalExpenses;

    const salesHistory = await prisma.sale.findMany({
      where: {
        status: 'CLOSED',
        closedAt: dateFilter,
      },
      include: {
        user: { select: { name: true } },
        items: {
          include: { product: { select: { name: true } } }
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
