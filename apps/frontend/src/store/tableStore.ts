import { create } from 'zustand';
import axios from '../api/axios';
import { io, Socket } from 'socket.io-client';
import { printAgent } from '../services/printAgent';

export interface Product {
  id: string;
  name: string;
  price: number;
  favorite: boolean;
  kitchen?: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  paidQty: number;
  price: number;
  comment?: string;
}

export interface Sale {
  id: string;
  openingComment?: string;
  startedAt?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  user?: { username: string };
}

export interface Table {
  id: string;
  number: number;
  x: number;
  y: number;
  shape: string;
  size?: string;
  status: string;
  roomId: string;
  activeSale?: Sale;
}

interface Room {
  id: string;
  name: string;
  zoom: number;
  tables: Table[];
}

interface PendingItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  comment: string;
  kitchen: string;
}

interface TableState {
  rooms: Room[];
  favorites: Product[];
  selectedRoomId: string | null;
  selectedTableId: string | null;
  pendingItems: PendingItem[];
  loading: boolean;
  socket: Socket | null;
  fetchRooms: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  setSelectedRoom: (roomId: string) => void;
  setSelectedTable: (tableId: string | null) => void;
  addPendingItem: (product: Product) => void;
  removePendingItem: (index: number) => void;
  updatePendingItem: (index: number, updates: Partial<PendingItem>) => void;
  clearPendingItems: () => void;
  openTable: (tableId: string, comment: string) => Promise<void>;
  confirmOrder: (tableId: string) => Promise<void>;
  initSocket: () => void;
  updateTableStatus: (tableId: string, status: string) => void;
  checkoutTable: (tableId: string, paymentMethod: string, amountPaid: number, tipAmount?: number) => void;
  updateTableCoordinates: (tableId: string, x: number, y: number) => Promise<void>;
  updateTableShape: (tableId: string, shape: string) => Promise<void>;
  updateTableSize: (tableId: string, size: string) => Promise<void>;
  createTable: (number: number, x: number, y: number, roomId: string) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  createRoom: (name: string) => Promise<void>;
  updateRoom: (roomId: string, name: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  updateRoomZoom: (roomId: string, zoom: number) => Promise<void>;
  deleteSaleItem: (tableId: string, itemId: string) => Promise<void>;
  tableTips: Record<string, boolean>;
  setTableTip: (tableId: string, enabled: boolean) => void;
  applyDiscount: (tableId: string, discount: number) => Promise<void>;
  partialCheckout: (tableId: string, items: { saleItemId: string; qty: number }[], paymentMethod: string, amountPaid: number, tipAmount?: number) => Promise<void>;
}

export const useTableStore = create<TableState>((set, get) => ({
  rooms: [],
  favorites: [],
  selectedRoomId: null,
  selectedTableId: null,
  pendingItems: [],
  loading: false,
  socket: null,
  tableTips: {},

  setTableTip: (tableId: string, enabled: boolean) => {
    set((state) => ({
      tableTips: { ...state.tableTips, [tableId]: enabled }
    }));
  },

  fetchRooms: async () => {
    set({ loading: true });
    try {
      const response = await axios.get('/tables/rooms');
      const rooms = response.data;

      set((state) => {
        // Keep current selection if it still exists, otherwise pick first
        const currentSelectedId = state.selectedRoomId;
        const stillExists = rooms.some((r: any) => r.id === currentSelectedId);
        const newSelectedId = stillExists ? currentSelectedId : (rooms.length > 0 ? rooms[0].id : null);

        return {
          rooms,
          selectedRoomId: newSelectedId,
          loading: false
        };
      });
    } catch (error) {
      console.error('Error fetching rooms:', error);
      set({ loading: false });
    }
  },

  fetchFavorites: async () => {
    try {
      const response = await axios.get('/products/favorites');
      set({ favorites: response.data });
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  },

  applyDiscount: async (tableId: string, discount: number) => {
    try {
      await axios.put(`/tables/tables/${tableId}/discount`, { discount });
      // The websocket will automatically update the table state for all clients
    } catch (error) {
      console.error('Error applying discount:', error);
      throw error;
    }
  },

  partialCheckout: async (tableId: string, items: { saleItemId: string; qty: number }[], paymentMethod: string, amountPaid: number, tipAmount?: number) => {
    try {
      await axios.post(`/tables/tables/${tableId}/partial-checkout`, {
        items,
        paymentMethod,
        amountPaid,
        tipAmount: tipAmount ?? 0
      });
      // WebSocket will update the table state
    } catch (error) {
      console.error('Error in partial checkout:', error);
      throw error;
    }
  },

  setSelectedRoom: (roomId: string) => {
    set({ selectedRoomId: roomId });
  },

  setSelectedTable: (tableId: string | null) => {
    set({ selectedTableId: tableId, pendingItems: [] });
  },

  addPendingItem: (product: Product) => {
    const items = get().pendingItems;
    const existing = items.findIndex(i => i.productId === product.id);
    if (existing >= 0) {
      const newItems = [...items];
      newItems[existing].quantity += 1;
      set({ pendingItems: newItems });
    } else {
      set({
        pendingItems: [...items, {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          comment: '',
          kitchen: product.kitchen || 'Cocina'
        }]
      });
    }
  },

  removePendingItem: (index: number) => {
    const items = [...get().pendingItems];
    items.splice(index, 1);
    set({ pendingItems: items });
  },

  updatePendingItem: (index: number, updates: Partial<PendingItem>) => {
    const items = [...get().pendingItems];
    items[index] = { ...items[index], ...updates };
    set({ pendingItems: items });
  },

  clearPendingItems: () => set({ pendingItems: [] }),

  openTable: async (tableId: string, comment: string) => {
    try {
      const response = await axios.post(`/tables/tables/${tableId}/status`, {
        status: 'OCCUPIED',
        comment
      });
      // WebSocket will update rooms, but we can update locally too
      const updatedTable = response.data;
      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.map((table) =>
            table.id === updatedTable.id ? updatedTable : table
          ),
        })),
        selectedTableId: updatedTable.id
      }));
    } catch (error) {
      console.error('Error opening table:', error);
    }
  },

  confirmOrder: async (tableId: string) => {
    const items = get().pendingItems;
    if (items.length === 0) return;

    try {
      const response = await axios.post(`/tables/tables/${tableId}/order`, {
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
          comment: i.comment
        }))
      });

      // Comanda printing is now handled via socket print_job event
      // (the backend emits it after saving the order)

      set({ pendingItems: [] });

      // Local update
      const updatedTable = response.data;
      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.map((table) =>
            table.id === updatedTable.id ? updatedTable : table
          ),
        })),
      }));
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      console.error('Order Confirmation Error:', errorMsg);
      alert('Error al confirmar: ' + errorMsg);
    }
  },

  initSocket: () => {
    if (get().socket) return;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    const socket = io(socketUrl, { path: '/api/socket.io/' });
    socket.on('table_updated', (updatedTable: Table) => {
      set((state) => ({
        rooms: state.rooms.map((room) => {
          if (room.id !== updatedTable.roomId) return room;

          const hasTable = room.tables.some(t => t.id === updatedTable.id);
          if (hasTable) {
            return {
              ...room,
              tables: room.tables.map((table) =>
                table.id === updatedTable.id ? updatedTable : table
              ),
            };
          } else {
            return {
              ...room,
              tables: [...room.tables, updatedTable]
            };
          }
        }),
      }));
    });

    // 🖨️ Listen for print jobs emitted by the backend (remote printing)
    socket.on('print_job', (job: any) => {
      if (printAgent.getStatus() !== 'connected') {
        // This client doesn't have the print agent — skip
        return;
      }

      if (job.type === 'comanda' && job.jobs) {
        for (const comandaJob of job.jobs) {
          printAgent.printComanda(comandaJob.printer, comandaJob.data);
        }
      } else if (job.type === 'factura' && job.data) {
        printAgent.printFactura(job.data);
        if (job.openDrawer) {
          printAgent.openDrawer();
        }
      }
    });

    socket.on('table_created', (newTable: Table) => {
      set((state) => ({
        rooms: state.rooms.map((room) => {
          if (room.id === newTable.roomId) {
            return {
              ...room,
              tables: [...room.tables, newTable]
            };
          }
          return room;
        })
      }));
    });

    socket.on('table_deleted', ({ tableId }: { tableId: string }) => {
      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.filter((table) => table.id !== tableId)
        })),
        selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId
      }));
    });
    set({ socket });
  },

  updateTableStatus: (tableId: string, status: string) => {
    axios.post(`/tables/tables/${tableId}/status`, { status })
      .catch(err => console.error(err));
  },

  checkoutTable: async (tableId: string, paymentMethod: string, amountPaid: number, tipAmount?: number) => {
    try {
      await axios.post(`/tables/tables/${tableId}/checkout`, { paymentMethod, amountPaid, tipAmount: tipAmount ?? 0 });
    } catch (err: any) {
      console.error('Checkout error:', err);
    }
  },

  updateTableCoordinates: async (tableId: string, x: number, y: number) => {
    try {
      // Optimistic update
      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.map((table) =>
            table.id === tableId ? { ...table, x, y } : table
          ),
        })),
      }));
      await axios.put(`/tables/tables/${tableId}/move`, { x, y });
    } catch (error) {
      console.error('Error updating table coordinates:', error);
      // Revert would go here ideally
    }
  },

  updateTableShape: async (tableId: string, shape: string) => {
    try {
      // Optimistic update
      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.map((table) =>
            table.id === tableId ? { ...table, shape } : table
          ),
        })),
      }));
      await axios.put(`/tables/tables/${tableId}/shape`, { shape });
    } catch (error) {
      console.error('Error updating table shape:', error);
    }
  },

  updateTableSize: async (tableId: string, size: string) => {
    try {
      // Optimistic
      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.map((table) =>
            table.id === tableId ? { ...table, size } : table
          ),
        })),
      }));
      await axios.put(`/tables/tables/${tableId}/size`, { size });
    } catch (error) {
      console.error('Error updating table size:', error);
    }
  },

  createTable: async (number: number, x: number, y: number, roomId: string) => {
    try {
      const response = await axios.post('/tables/tables', { number, x, y, roomId });
      // The socket logic will automatically append it, but we can optimistically append the returned table
      const newTable = response.data;
      set((state) => ({
        rooms: state.rooms.map((room) => {
          if (room.id === roomId) {
            // Only add if not already there (prevents duplication if socket arrived fast)
            const exists = room.tables.some(t => t.id === newTable.id);
            if (!exists) {
              return { ...room, tables: [...room.tables, newTable] };
            }
          }
          return room;
        })
      }));
    } catch (error) {
      console.error('Error creating table:', error);
    }
  },

  deleteTable: async (tableId: string) => {
    try {
      // Optimistic delete
      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.filter((table) => table.id !== tableId)
        })),
        selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId
      }));
      await axios.delete(`/tables/tables/${tableId}`);
    } catch (error) {
      console.error('Error deleting table:', error);
    }
  },

  createRoom: async (name: string) => {
    try {
      const response = await axios.post('/tables/rooms', { name });
      const newRoom = { ...response.data, tables: [] };
      set((state) => ({
        rooms: [...state.rooms, newRoom],
        selectedRoomId: state.selectedRoomId || newRoom.id
      }));
    } catch (error) {
      console.error('Error creating room:', error);
    }
  },

  updateRoom: async (roomId: string, name: string) => {
    try {
      const response = await axios.put(`/tables/rooms/${roomId}`, { name });
      const updatedRoom = response.data;
      set((state) => ({
        rooms: state.rooms.map(room =>
          room.id === roomId ? { ...room, name: updatedRoom.name } : room
        )
      }));
    } catch (error) {
      console.error('Error updating room:', error);
    }
  },

  deleteRoom: async (roomId: string) => {
    try {
      await axios.delete(`/tables/rooms/${roomId}`);
      set((state) => {
        const newRooms = state.rooms.filter(room => room.id !== roomId);
        return {
          rooms: newRooms,
          selectedRoomId: state.selectedRoomId === roomId
            ? (newRooms.length > 0 ? newRooms[0].id : null)
            : state.selectedRoomId
        };
      });
    } catch (error) {
      console.error('Error deleting room:', error);
    }
  },

  updateRoomZoom: async (roomId: string, zoom: number) => {
    try {
      await axios.put(`/tables/rooms/${roomId}/zoom`, { zoom });
      set((state) => ({
        rooms: state.rooms.map(room =>
          room.id === roomId ? { ...room, zoom } : room
        )
      }));
    } catch (error) {
      console.error('Error updating room zoom:', error);
    }
  },

  deleteSaleItem: async (tableId: string, itemId: string) => {
    try {
      const response = await axios.delete(`/tables/tables/${tableId}/items/${itemId}`);
      const updatedTable = response.data;

      set((state) => ({
        rooms: state.rooms.map((room) => ({
          ...room,
          tables: room.tables.map((table) =>
            table.id === updatedTable.id ? updatedTable : table
          ),
        })),
      }));
    } catch (error) {
      console.error('Error deleting sale item:', error);
    }
  }
}));
