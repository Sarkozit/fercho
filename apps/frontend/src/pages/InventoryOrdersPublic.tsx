import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

interface OrderItem {
  id: string;
  name: string;
  packs: number;
  packName: string;
  packSize: number;
  unitsToOrder: number;
  subtotal: number;
  cost: number;
}

interface OrderGroup {
  supplier: Supplier;
  items: OrderItem[];
  total: number;
}

interface OrdersData {
  orderBySupplier: OrderGroup[];
  lastCountDate: string | null;
}

const InventoryOrdersPublic: React.FC = () => {
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/public/orders`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los pedidos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const generateWhatsAppMessage = (group: OrderGroup) => {
    let msg = `Hola, buen día...\n\n`;
    msg += `Podrían por favor colaborarnos con este pedido a nombre de *Fonda Caballo Loco*:\n\n`;
    group.items.forEach(item => {
      if (item.packSize > 1) {
        msg += `${item.packs} ${item.packName} de ${item.name}\n`;
      } else {
        msg += `${item.unitsToOrder} ${item.name}\n`;
      }
    });
    msg += `\nSe los agradecemos mucho.`;
    return msg;
  };

  const handleOrderClick = (group: OrderGroup) => {
    const msg = generateWhatsAppMessage(group);
    const phone = group.supplier.phone?.replace(/\D/g, '') || '';
    const url = phone
      ? `https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const calculateDaysAgo = (dateStr: string) => {
    const past = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - past.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh' }} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-orange-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm font-medium">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100dvh' }} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-white/90 font-bold mb-6">{error}</p>
        <button onClick={fetchOrders} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold transition">
          Reintentar
        </button>
      </div>
    );
  }

  const daysAgo = data?.lastCountDate ? calculateDaysAgo(data.lastCountDate) : null;
  const formattedDate = data?.lastCountDate ? new Date(data.lastCountDate).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;

  return (
    <div style={{ height: '100dvh' }} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/30 backdrop-blur-lg border-b border-white/10 px-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: '16px' }}
      >
        <h1 className="text-white font-black text-xl text-center mb-2">Pedidos Pendientes</h1>
        <div className="bg-white/5 rounded-lg border border-white/10 p-3 text-center">
          {data?.lastCountDate ? (
            <p className="text-white/80 text-sm">
              Este inventario fue realizado hace <span className="font-bold text-white">{daysAgo === 0 ? 'hoy' : `${daysAgo} días`}</span><br/>
              <span className="text-white/50 text-xs">({formattedDate})</span>
            </p>
          ) : (
            <p className="text-white/50 text-sm">No hay registro de conteos recientes.</p>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {!data?.orderBySupplier || data.orderBySupplier.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-2">No hay pedidos pendientes</h3>
            <p className="text-white/40 text-sm">El inventario está en niveles óptimos.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {data.orderBySupplier.map(group => (
              <div key={group.supplier.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col items-center">
                <button
                  onClick={() => handleOrderClick(group)}
                  className="w-full bg-[#82B38A] hover:bg-[#72a37a] active:bg-[#62936a] text-white font-black py-4 rounded-xl shadow-lg transition uppercase tracking-wide text-sm flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  PEDIDO {group.supplier.name}
                </button>
                <p className="text-white/60 text-sm mt-4 font-medium">
                  Total estimado: <span className="font-bold text-white/90">${group.total.toLocaleString('es-CO')}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default InventoryOrdersPublic;
