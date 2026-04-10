import { create } from 'zustand';
import api from '../api/axios';

export interface Notification {
  id: string;
  source: 'BOLD' | 'BANCOLOMBIA' | 'MANUAL';
  type: string;
  amount: number;
  currency: string;
  reference: string | null;
  sender: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  currentPage: number;
  hasMore: boolean;
  loading: boolean;

  // Actions
  fetchNotifications: (page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  showBrowserNotification: (notification: Notification) => void;
  requestBrowserPermission: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  currentPage: 1,
  hasMore: false,
  loading: false,

  fetchNotifications: async (page = 1) => {
    try {
      set({ loading: true });
      const { data } = await api.get(`/notifications?page=${page}&limit=5`);
      set({
        notifications: data.notifications,
        hasMore: data.hasMore,
        currentPage: page,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { currentPage, loading } = get();
    if (loading) return;
    try {
      set({ loading: true });
      const nextPage = currentPage + 1;
      const { data } = await api.get(`/notifications?page=${nextPage}&limit=5`);
      set((state) => ({
        notifications: [...state.notifications, ...data.notifications],
        hasMore: data.hasMore,
        currentPage: nextPage,
        loading: false,
      }));
    } catch (error) {
      console.error('Error loading more notifications:', error);
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      set({ unreadCount: data.count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));

    // Trigger browser notification
    get().showBrowserNotification(notification);
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },

  showBrowserNotification: (notification: Notification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const amount = '$' + Math.round(notification.amount).toLocaleString('es-CO');
    const sender = notification.sender
      ? notification.sender.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      : notification.reference || 'Sin referencia';

    new Notification(`💰 Recibiste ${amount}`, {
      body: sender,
      icon: '/favicon.ico',
      tag: notification.id,
    });
  },

  requestBrowserPermission: async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  },
}));
