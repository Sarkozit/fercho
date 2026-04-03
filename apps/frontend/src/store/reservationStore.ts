import { create } from 'zustand';
import api from '../api/axios';

export interface PolizaDetail {
  nombre: string;
  apellido: string;
  identificacion: string;
  estado: string;
}

export interface ReservationLocalNote {
  status: 'PENDIENTE' | 'LLEGO' | 'EN_RUTA';
  paidBalance: boolean;
  meatNote: string;
  comment: string;
  bbqTimeOverride?: string; // HH:MM format — overrides calculated BBQ time
}

export interface Reservation {
  id: string;
  fecha: string;
  horaSalida: string;
  nombre: string;
  horasCabalgata: number;
  telefono: string;
  caballos: number;
  asignacion: string;
  asados: number;
  mediasLicor: number;
  ponchoSombrero: string;
  transporte: string;
  total: number;
  adelanto: number;
  saldoPendiente: number;
  polizas: {
    enviadas: number;
    requeridas: number;
    detalles: PolizaDetail[];
  };
  localNote: ReservationLocalNote;
}

export interface CreateReservationInput {
  fecha: string;
  hora: string;
  cliente: string;
  tour: number;
  telefono: string;
  caballos: number;
  valor: number;
  adicionales: number;
  asados: number;
  licor: number;
  kits: number;
  transporte: number;
}

export interface CreateReservationResult {
  status: string;
  row: number;
  confirmationText: string;
  whatsappNumber: string;
  n8nSent: boolean;
}

interface ReservationState {
  reservations: Reservation[];
  loading: boolean;
  lastUpdated: string | null;
  error: string | null;
  fetchReservations: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  updateStatus: (id: string, status: 'PENDIENTE' | 'LLEGO' | 'EN_RUTA') => Promise<void>;
  togglePaid: (id: string, paidBalance: boolean) => Promise<void>;
  updateNote: (id: string, meatNote?: string, comment?: string, bbqTimeOverride?: string) => Promise<void>;
  createReservation: (input: CreateReservationInput) => Promise<CreateReservationResult>;
  sendPolizaReminder: (phone: string, nombre: string, reservaId: string, polizasEnviadas: number) => Promise<{ success: boolean; error?: string }>;
}

export const useReservationStore = create<ReservationState>((set, get) => ({
  reservations: [],
  loading: false,
  lastUpdated: null,
  error: null,

  fetchReservations: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/reservations');
      set({
        reservations: data.reservations || [],
        lastUpdated: data.lastUpdated,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Error fetching reservations', loading: false });
    }
  },

  forceRefresh: async () => {
    set({ loading: true, error: null });
    try {
      await api.post('/reservations/refresh');
      const { data } = await api.get('/reservations');
      set({
        reservations: data.reservations || [],
        lastUpdated: data.lastUpdated,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Error refreshing', loading: false });
    }
  },

  updateStatus: async (id, status) => {
    try {
      await api.post(`/reservations/${id}/status`, { status });
      // Optimistic update
      set({
        reservations: get().reservations.map(r =>
          r.id === id ? { ...r, localNote: { ...r.localNote, status } } : r
        ),
      });
    } catch (err: any) {
      console.error('Error updating status:', err);
    }
  },

  togglePaid: async (id, paidBalance) => {
    try {
      await api.post(`/reservations/${id}/paid`, { paidBalance });
      set({
        reservations: get().reservations.map(r =>
          r.id === id ? { ...r, localNote: { ...r.localNote, paidBalance } } : r
        ),
      });
    } catch (err: any) {
      console.error('Error updating paid status:', err);
    }
  },

  updateNote: async (id, meatNote?, comment?, bbqTimeOverride?) => {
    try {
      const body: any = {};
      if (meatNote !== undefined) body.meatNote = meatNote;
      if (comment !== undefined) body.comment = comment;
      if (bbqTimeOverride !== undefined) body.bbqTimeOverride = bbqTimeOverride;
      await api.post(`/reservations/${id}/note`, body);
      set({
        reservations: get().reservations.map(r =>
          r.id === id
            ? {
                ...r,
                localNote: {
                  ...r.localNote,
                  ...(meatNote !== undefined ? { meatNote } : {}),
                  ...(comment !== undefined ? { comment } : {}),
                  ...(bbqTimeOverride !== undefined ? { bbqTimeOverride } : {}),
                },
              }
            : r
        ),
      });
    } catch (err: any) {
      console.error('Error updating note:', err);
    }
  },

  createReservation: async (input) => {
    const { data } = await api.post('/reservations/create', input);
    // Refresh list so new reservation appears immediately
    await get().forceRefresh();
    return data;
  },

  sendPolizaReminder: async (phone, nombre, reservaId, polizasEnviadas) => {
    try {
      await api.post('/reservations/send-poliza-reminder', { phone, nombre, reservaId, polizasEnviadas });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  },
}));
