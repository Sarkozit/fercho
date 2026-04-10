import React, { useState, useEffect, useRef } from 'react';
import { Bell, CreditCard, Landmark, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useNotificationStore } from '../store/notificationStore';
import type { Notification } from '../store/notificationStore';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Ahora';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  return `${diffDay}d`;
}

function formatAmountCOP(amount: number): string {
  // Format as Colombian style: $150.000 (dot for thousands, no decimals)
  return '$' + Math.round(amount).toLocaleString('es-CO');
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const NotificationItem: React.FC<{ notification: Notification; onRead: (id: string) => void }> = ({ notification, onRead }) => {
  const isBold = notification.source === 'BOLD';
  const isBancolombia = notification.source === 'BANCOLOMBIA';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50 ${
        !notification.read ? 'bg-red-50/60' : ''
      }`}
      onClick={() => !notification.read && onRead(notification.id)}
    >
      {/* Source Icon */}
      <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${
        isBold
          ? 'bg-purple-100 text-purple-600'
          : 'bg-yellow-100 text-yellow-700'
      }`}>
        {isBold ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isBancolombia ? (
          <>
            {/* Bancolombia layout: Recibiste / $150.000 de / Nombre */}
            <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Recibiste</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-green-700">
                {formatAmountCOP(notification.amount)}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">de</span>
            </div>
            <p className="text-[11px] text-gray-600 font-medium truncate mt-0.5">
              {notification.sender ? capitalizeWords(notification.sender) : 'Desconocido'}
            </p>
          </>
        ) : (
          <>
            {/* BOLD / Other layout */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-green-700">
                {formatAmountCOP(notification.amount)}
              </span>
              <span className="text-[10px] text-gray-400 flex-shrink-0 font-medium">
                {timeAgo(notification.createdAt)}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              Bold • {notification.sender || notification.reference || notification.type}
            </p>
          </>
        )}
      </div>

      {/* Time + Unread Dot */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {isBancolombia && (
          <span className="text-[10px] text-gray-400 font-medium">
            {timeAgo(notification.createdAt)}
          </span>
        )}
        {!notification.read && (
          <div className="h-2 w-2 rounded-full bg-red-500" />
        )}
      </div>
    </div>
  );
};

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    hasMore,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications(1);
  }, [fetchUnreadCount, fetchNotifications]);

  const handleToggle = () => {
    setOpen(!open);
    if (!open) {
      fetchNotifications(1);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className={`p-2 border rounded-md transition relative cursor-pointer ${
          open
            ? 'border-red-300 bg-red-50 text-red-500'
            : 'border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300'
        }`}
        title="Notificaciones"
      >
        <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'animate-[wiggle_0.5s_ease-in-out]' : ''}`} />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm animate-[pulse_2s_ease-in-out_infinite]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[999] overflow-hidden"
          style={{ animation: 'fadeSlideIn 0.15s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-800">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-green-600 transition font-medium cursor-pointer"
              >
                <Check className="h-3 w-3" />
                Marcar leídas
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin notificaciones</p>
              </div>
            ) : (
              <>
                {notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
                ))}

                {/* Load More */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full py-3 text-center text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition border-t border-gray-100 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Ver notificaciones anteriores
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Inline Keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
