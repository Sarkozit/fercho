import { create } from 'zustand';
import axios from '../api/axios';

export interface ProductSale {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface SalesDashboardData {
  totalSales: number;
  totalExpenses: number;
  cashNet: number;
  paymentTotals: Record<string, number>;
  productSales: ProductSale[];
  salesHistory: {
    id: string;
    tableName: string | null;
    status: string;
    startedAt: string;
    closedAt: string;
    subtotal: number;
    discount: number;
    total: number;
    user: { name: string };
    payments: { amount: number, method: string }[];
    items: { product: { name: string; kitchen?: string }, quantity: number, price: number, comment?: string }[];
  }[];
}

interface SalesState {
  dashboardData: SalesDashboardData | null;
  loading: boolean;
  fetchDashboard: (startDate?: string, endDate?: string) => Promise<void>;
}

export const useSalesStore = create<SalesState>((set) => ({
  dashboardData: null,
  loading: false,

  fetchDashboard: async (startDate?: string, endDate?: string) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const url = `/reports/sales-dashboard${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await axios.get(url);
      set({ dashboardData: response.data, loading: false });
    } catch (error) {
      console.error('Error fetching sales dashboard:', error);
      set({ loading: false });
    }
  }
}));
