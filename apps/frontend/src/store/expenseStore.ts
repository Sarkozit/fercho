import { create } from 'zustand';
import axios from '../api/axios';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  user?: { name: string };
}

interface ExpenseState {
  expenses: Expense[];
  dailyBalance: {
    totalSales: number;
    totalExpenses: number;
    balance: number;
  };
  loading: boolean;
  fetchExpenses: (startDate?: string, endDate?: string) => Promise<void>;
  fetchDailyBalance: () => Promise<void>;
  createExpense: (description: string, amount: number, category: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  dailyBalance: { totalSales: 0, totalExpenses: 0, balance: 0 },
  loading: false,

  fetchExpenses: async (startDate?: string, endDate?: string) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const url = `/expenses${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await axios.get(url);
      set({ expenses: response.data, loading: false });
    } catch (error) {
      console.error('Error fetching expenses:', error);
      set({ loading: false });
    }
  },

  fetchDailyBalance: async () => {
    try {
      const response = await axios.get('/reports/daily-balance');
      set({ dailyBalance: response.data });
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  },

  createExpense: async (description: string, amount: number, category: string) => {
    try {
      await axios.post('/expenses', { description, amount, category });
      await get().fetchExpenses();
      await get().fetchDailyBalance();
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  },

  deleteExpense: async (id: string) => {
    try {
      await axios.delete(`/expenses/${id}`);
      await get().fetchExpenses();
      await get().fetchDailyBalance();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  }
}));
