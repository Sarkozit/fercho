import { FastifyInstance, FastifyRequest } from 'fastify';
import { ExpenseService } from '../services/expense.service.js';
import { SocketService } from '../services/socket.service.js';

export async function expenseRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest) => {
    const { startDate, endDate } = request.query as { startDate?: string, endDate?: string };
    return ExpenseService.getExpenses(startDate, endDate);
  });

  fastify.post('/', async (request: FastifyRequest, reply) => {
    try {
      const { description, amount, category } = request.body as { description: string, amount: number, category: string };
      const userId = (request as any).user?.id;

      if (!description || !amount || !category) {
        return reply.code(400).send({ error: 'Descripción, monto y categoría requeridos' });
      }

      const expense = await ExpenseService.createExpense(description, amount, category, userId);
      SocketService.emitExpenseUpdate();
      return expense;
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      await ExpenseService.deleteExpense(id);
      SocketService.emitExpenseUpdate();
      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
