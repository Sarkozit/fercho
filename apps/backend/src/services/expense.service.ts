import { prisma } from '../utils/db.js';

export class ExpenseService {
  static async getExpenses(startDate?: string, endDate?: string) {
    let whereClause: any = {};
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        const [year, month, day] = startDate.split('-');
        const start = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
        whereClause.date.gte = start;
      }
      if (endDate) {
        const [year, month, day] = endDate.split('-');
        const end = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      whereClause.date = { gte: today };
    }

    return prisma.expense.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      include: { user: { select: { name: true } } }
    });
  }

  static async createExpense(description: string, amount: number, category: string, userId?: string) {
    return prisma.expense.create({
      data: {
        description,
        amount,
        category,
        userId
      }
    });
  }

  static async deleteExpense(id: string) {
    return prisma.expense.delete({
      where: { id }
    });
  }
}
