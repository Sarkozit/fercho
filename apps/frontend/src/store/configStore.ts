import { create } from 'zustand';
import axios from '../api/axios';

export interface Printer {
  id: string;
  name: string;
  type: string;
  connectionType: string;
  address: string | null;
  kitchens: string[];
  printCommands: boolean;
  printInvoice: boolean;
  active: boolean;
}

export interface PrintSettings {
  id: string;
  header: string;
  footer: string;
  showLogo: boolean;
  qrImage: string | null;
  qrText: string;
}

export interface UserItem {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'CAJERO' | 'MESERO';
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  tipEnabled: boolean;
  tipThreshold: number;
  tipPercent: number;
}

export interface Kitchen {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

interface ConfigState {
  // Printers
  printers: Printer[];
  loadingPrinters: boolean;
  fetchPrinters: () => Promise<void>;
  createPrinter: (data: Partial<Printer>) => Promise<void>;
  updatePrinter: (id: string, data: Partial<Printer>) => Promise<void>;
  deletePrinter: (id: string) => Promise<void>;

  // Print Settings
  printSettings: PrintSettings | null;
  fetchPrintSettings: () => Promise<void>;
  updatePrintSettings: (data: Partial<PrintSettings>) => Promise<void>;

  // Users
  users: UserItem[];
  loadingUsers: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (data: any) => Promise<void>;
  updateUser: (id: string, data: any) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  // App Settings
  appSettings: AppSettings | null;
  fetchAppSettings: () => Promise<void>;
  updateAppSettings: (data: Partial<AppSettings>) => Promise<void>;

  // Kitchens
  kitchens: Kitchen[];
  loadingKitchens: boolean;
  fetchKitchens: () => Promise<void>;
  createKitchen: (data: Partial<Kitchen>) => Promise<void>;
  updateKitchen: (id: string, data: Partial<Kitchen>) => Promise<void>;
  deleteKitchen: (id: string) => Promise<void>;

  // Payment Methods
  paymentMethods: PaymentMethod[];
  loadingPaymentMethods: boolean;
  fetchPaymentMethods: () => Promise<void>;
  createPaymentMethod: (data: Partial<PaymentMethod>) => Promise<void>;
  updatePaymentMethod: (id: string, data: Partial<PaymentMethod>) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // ========== PRINTERS ==========
  printers: [],
  loadingPrinters: false,

  fetchPrinters: async () => {
    set({ loadingPrinters: true });
    try {
      const res = await axios.get('/config/printers');
      set({ printers: res.data, loadingPrinters: false });
    } catch (error) {
      console.error('Error fetching printers:', error);
      set({ loadingPrinters: false });
    }
  },

  createPrinter: async (data) => {
    try {
      await axios.post('/config/printers', data);
      await get().fetchPrinters();
    } catch (error) {
      console.error('Error creating printer:', error);
      throw error;
    }
  },

  updatePrinter: async (id, data) => {
    try {
      await axios.put(`/config/printers/${id}`, data);
      await get().fetchPrinters();
    } catch (error) {
      console.error('Error updating printer:', error);
      throw error;
    }
  },

  deletePrinter: async (id) => {
    try {
      await axios.delete(`/config/printers/${id}`);
      await get().fetchPrinters();
    } catch (error) {
      console.error('Error deleting printer:', error);
      throw error;
    }
  },

  // ========== PRINT SETTINGS ==========
  printSettings: null,

  fetchPrintSettings: async () => {
    try {
      const res = await axios.get('/config/print-settings');
      set({ printSettings: res.data });
    } catch (error) {
      console.error('Error fetching print settings:', error);
    }
  },

  updatePrintSettings: async (data) => {
    try {
      const res = await axios.put('/config/print-settings', data);
      set({ printSettings: res.data });
    } catch (error) {
      console.error('Error updating print settings:', error);
      throw error;
    }
  },

  // ========== USERS ==========
  users: [],
  loadingUsers: false,

  fetchUsers: async () => {
    set({ loadingUsers: true });
    try {
      const res = await axios.get('/users');
      set({ users: res.data, loadingUsers: false });
    } catch (error) {
      console.error('Error fetching users:', error);
      set({ loadingUsers: false });
    }
  },

  createUser: async (data) => {
    try {
      await axios.post('/users', data);
      await get().fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  updateUser: async (id, data) => {
    try {
      await axios.put(`/users/${id}`, data);
      await get().fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  deleteUser: async (id) => {
    try {
      await axios.delete(`/users/${id}`);
      await get().fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // ========== APP SETTINGS ==========
  appSettings: null,

  fetchAppSettings: async () => {
    try {
      const res = await axios.get('/config/app-settings');
      set({ appSettings: res.data });
    } catch (error) {
      console.error('Error fetching app settings:', error);
    }
  },

  updateAppSettings: async (data) => {
    try {
      const res = await axios.put('/config/app-settings', data);
      set({ appSettings: res.data });
    } catch (error) {
      console.error('Error updating app settings:', error);
      throw error;
    }
  },

  // ========== KITCHENS ==========
  kitchens: [],
  loadingKitchens: false,

  fetchKitchens: async () => {
    set({ loadingKitchens: true });
    try {
      const res = await axios.get('/config/kitchens');
      set({ kitchens: res.data, loadingKitchens: false });
    } catch (error) {
      console.error('Error fetching kitchens:', error);
      set({ loadingKitchens: false });
    }
  },

  createKitchen: async (data) => {
    try {
      await axios.post('/config/kitchens', data);
      await get().fetchKitchens();
    } catch (error) {
      console.error('Error creating kitchen:', error);
      throw error;
    }
  },

  updateKitchen: async (id, data) => {
    try {
      await axios.put(`/config/kitchens/${id}`, data);
      await get().fetchKitchens();
    } catch (error) {
      console.error('Error updating kitchen:', error);
      throw error;
    }
  },

  deleteKitchen: async (id) => {
    try {
      await axios.delete(`/config/kitchens/${id}`);
      await get().fetchKitchens();
    } catch (error) {
      console.error('Error deleting kitchen:', error);
      throw error;
    }
  },

  // ========== PAYMENT METHODS ==========
  paymentMethods: [],
  loadingPaymentMethods: false,

  fetchPaymentMethods: async () => {
    set({ loadingPaymentMethods: true });
    try {
      const res = await axios.get('/config/payment-methods');
      set({ paymentMethods: res.data, loadingPaymentMethods: false });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      set({ loadingPaymentMethods: false });
    }
  },

  createPaymentMethod: async (data) => {
    try {
      await axios.post('/config/payment-methods', data);
      await get().fetchPaymentMethods();
    } catch (error) {
      console.error('Error creating payment method:', error);
      throw error;
    }
  },

  updatePaymentMethod: async (id, data) => {
    try {
      await axios.put(`/config/payment-methods/${id}`, data);
      await get().fetchPaymentMethods();
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  },

  deletePaymentMethod: async (id) => {
    try {
      await axios.delete(`/config/payment-methods/${id}`);
      await get().fetchPaymentMethods();
    } catch (error) {
      console.error('Error deleting payment method:', error);
      throw error;
    }
  },
}));
