import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Wallet,
  CreditCard,
  QrCode,
  PackageSearch,
  X,
  FileText,
  Printer,
  Clock,
  CheckCircle2,
  ScrollText
} from 'lucide-react';
import { useSalesStore, type SalesDashboardData } from '../store/salesStore';

const QUICK_FILTERS = [
  { label: 'Hoy', days: 0 },
  { label: 'Ayer', days: 1 },
  { label: 'Última semana', days: 7 },
  { label: 'Último mes', days: 30 },
  { label: 'Este año', days: 365 }
];

const Sales: React.FC = () => {
  const { dashboardData, loading, fetchDashboard } = useSalesStore();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSale, setSelectedSale] = useState<SalesDashboardData['salesHistory'][0] | null>(null);
  const [visibleSales, setVisibleSales] = useState(20);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Reset visible sales when dashboard data changes
  useEffect(() => {
    setVisibleSales(20);
  }, [dashboardData]);

  const applyFilter = () => {
    fetchDashboard(dateRange.start, dateRange.end);
  };

  const clearFilter = () => {
    setDateRange({ start: '', end: '' });
    fetchDashboard();
  };

  const applyQuickFilter = (days: number) => {
    const end = new Date();
    const start = new Date();
    
    if (days === 1) {
      // Yesterday
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (days > 1) {
      start.setDate(start.getDate() - days);
    }
    
    // For 'Hoy' (days === 0), it will just send today's date for both
    
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const newRange = { start: formatDate(start), end: formatDate(end) };
    setDateRange(newRange);
    fetchDashboard(newRange.start, newRange.end);
  };

  if (!dashboardData && loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  const data = dashboardData || {
    totalSales: 0,
    totalExpenses: 0,
    cashNet: 0,
    paymentTotals: { Efectivo: 0, Bold: 0, QR: 0 },
    productSales: [],
    salesHistory: []
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F3F4F6] overflow-y-auto h-full p-8 space-y-8">
      {/* HEADER WITH FILTERS */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="bg-orange-50 text-orange-500 p-3 rounded-xl">
            <TrendingUp className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">
              Reporte de Ventas
            </h1>
            <p className="text-sm text-gray-400 font-medium mt-1">
              {dateRange.start ? `Desde ${dateRange.start} hasta ${dateRange.end || dateRange.start}` : 'Mostrando métricas del día de hoy'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-sm focus-within:ring-2 focus-within:ring-orange-500 transition-all">
            <Calendar className="h-4 w-4 text-gray-400 ml-2" />
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent border-none text-gray-600 outline-none focus:ring-0 text-sm font-medium w-[120px]" 
            />
            <span className="text-gray-300 font-bold">-</span>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent border-none text-gray-600 outline-none focus:ring-0 text-sm font-medium w-[120px]" 
            />
          </div>
          <button 
            onClick={applyFilter} 
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg text-sm shadow-md transition active:scale-95 tracking-wide"
          >
            Filtrar
          </button>
          {(dateRange.start || dateRange.end) && (
            <button 
              onClick={clearFilter} 
              className="p-2.5 text-orange-500 hover:bg-orange-50 font-bold rounded-lg transition active:scale-95" 
              title="Limpiar filtro"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* QUICK FILTERS */}
      <div className="flex flex-wrap gap-3 pb-2">
        {QUICK_FILTERS.map((qf) => (
          <button
            key={qf.label}
            onClick={() => applyQuickFilter(qf.days)}
            className="px-5 py-2 whitespace-nowrap bg-white border border-gray-200 text-gray-600 font-bold text-sm rounded-full shadow-sm hover:border-orange-300 hover:text-orange-600 focus:ring-2 focus:ring-orange-100 transition-all transform active:scale-95"
          >
            {qf.label}
          </button>
        ))}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* VENTA TOTAL */}
        <div className="bg-white rounded-2xl p-6 shadow-xl shadow-gray-200/40 border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 bg-gradient-to-bl from-orange-400 to-transparent w-full h-full rounded-tr-2xl group-hover:opacity-10 transition duration-500"></div>
          <div className="flex items-center justify-between z-10 relative">
            <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs">Venta General Bruta</h3>
            <div className="bg-orange-50 p-2 rounded-lg text-orange-500"><TrendingUp className="h-5 w-5" /></div>
          </div>
          <p className="mt-4 text-3xl font-black text-gray-800 tracking-tight">${data.totalSales.toLocaleString('es-CO')}</p>
          <div className="mt-2 text-xs font-semibold text-gray-400">Total facturado en el rango</div>
        </div>

        {/* CIERRE CAJA */}
        <div className="bg-gradient-to-br from-gray-800 to-black rounded-2xl p-6 shadow-xl shadow-gray-900/30 border border-gray-800 relative overflow-hidden transform hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between z-10 relative">
            <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs">Cierre Efectivo Neto</h3>
            <div className="bg-white/10 p-2 rounded-lg text-green-400"><Wallet className="h-5 w-5" /></div>
          </div>
          <p className="mt-4 text-3xl font-black text-white tracking-tight">${data.cashNet.toLocaleString('es-CO')}</p>
          <div className="mt-2 text-xs font-medium text-gray-400 flex items-center justify-between">
            <span>(Efectivo: ${data.paymentTotals.Efectivo.toLocaleString('es-CO')})</span>
            <span className="text-red-400">- Gastos: ${data.totalExpenses.toLocaleString('es-CO')}</span>
          </div>
        </div>

        {/* METODOS DE PAGO BOLD */}
        <div className="bg-white rounded-2xl p-6 shadow-xl shadow-gray-200/40 border border-gray-100 relative overflow-hidden group">
           <div className="flex items-center justify-between z-10 relative">
            <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs">Bold (Datafono)</h3>
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><CreditCard className="h-5 w-5" /></div>
          </div>
          <p className="mt-4 text-3xl font-black text-gray-800 tracking-tight">${data.paymentTotals.Bold.toLocaleString('es-CO')}</p>
          <div className="mt-2 text-xs font-semibold text-gray-400">Total transaccionado tarjeta</div>
        </div>

        {/* METODOS DE PAGO QR */}
        <div className="bg-white rounded-2xl p-6 shadow-xl shadow-gray-200/40 border border-gray-100 relative overflow-hidden group">
           <div className="flex items-center justify-between z-10 relative">
            <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs">Código QR</h3>
            <div className="bg-purple-50 p-2 rounded-lg text-purple-600"><QrCode className="h-5 w-5" /></div>
          </div>
          <p className="mt-4 text-3xl font-black text-gray-800 tracking-tight">${data.paymentTotals.QR.toLocaleString('es-CO')}</p>
          <div className="mt-2 text-xs font-semibold text-gray-400">Transferencias tipo Nequi/Bancolombia</div>
        </div>
      </div>


      {/* DETAILED TABLES: SALES HISTORY */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 flex flex-col flex-1 overflow-hidden min-h-[700px]">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-orange-500" />
              Historial de Mesas Facturadas
            </h2>
            <p className="text-gray-400 text-sm font-medium mt-1">Registro de resoluciones y comandas por mesa</p>
          </div>
        </div>
        <div className="flex-1 overflow-auto h-full">
          {(!data.salesHistory || data.salesHistory.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 italic py-16">
              <ScrollText className="w-16 h-16 text-gray-200 mb-4" />
              <p>No se encontraron mesas facturadas en este periodo</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400">Hora Cierre</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400">Mesa</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400">Mesero</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400">Pagos</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.salesHistory.slice(0, visibleSales).map((sale) => (
                  <tr 
                    key={sale.id} 
                    className="hover:bg-orange-50/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedSale(sale)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-700">
                          {new Date(sale.closedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-bold text-sm">
                        {sale.tableName ? `Mesa ${sale.tableName}` : 'Barra / Sin Mesa'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-600">
                        {sale.user?.name || 'Sistema'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {sale.payments.map((p, idx) => (
                          <span key={idx} className={`text-xs font-bold px-2 py-1 rounded-md ${
                            p.method === 'Efectivo' ? 'bg-green-50 text-green-600 border border-green-100' :
                            p.method === 'Bold' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            'bg-purple-50 text-purple-600 border border-purple-100'
                          }`}>
                            {p.method}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-gray-800 text-[15px]">
                        ${sale.total.toLocaleString('es-CO')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.salesHistory && data.salesHistory.length > visibleSales && (
            <div className="p-6 border-t border-gray-100 flex justify-center bg-gray-50/30">
              <button 
                onClick={() => setVisibleSales(prev => prev + 20)}
                className="px-6 py-2 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold text-sm rounded-full transition-colors flex items-center gap-2 shadow-sm"
              >
                Cargar más antiguas ({data.salesHistory.length - visibleSales} restantes)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DETAILED TABLES: PRODUCTS RANKING */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <PackageSearch className="w-5 h-5 text-orange-500" />
              Productos Más Vendidos
            </h2>
            <p className="text-gray-400 text-sm font-medium mt-1">Métricas de desempeño de menú en este periodo</p>
          </div>
        </div>
        <div className="flex-1 overflow-auto h-full">
          {data.productSales.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 italic py-16">
              <PackageSearch className="w-16 h-16 text-gray-200 mb-4" />
              <p>No se registraron ventas de productos en este periodo</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400">Producto</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400 text-center">Unidades Vendidas</th>
                  <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-400 text-right">Ganancia Bruta Aproximada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.productSales.map((product, index) => (
                  <tr key={product.id} className="hover:bg-orange-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center font-bold text-gray-300 group-hover:text-orange-300">#{index + 1}</span>
                        <span className="font-bold text-[15px] text-gray-700">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-bold text-sm">
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-gray-800 text-[15px]">
                        ${product.revenue.toLocaleString('es-CO')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SALES SLIDING DRAWER */}
      {selectedSale && (
        <div 
          className="fixed inset-0 z-[100] flex justify-end bg-gray-900/40 backdrop-blur-sm transition-opacity" 
          onClick={() => setSelectedSale(null)}
        >
          <div 
            className="w-[450px] h-full bg-white shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="bg-orange-500 text-white p-6 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Detalle de Venta
                </h2>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-orange-600 rounded-lg transition" title="Reimprimir Comandas" onClick={() => alert('Próximamente: Reimpresión de comandas')}>
                    <Printer className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-orange-600 rounded-lg transition" title="Reimprimir Factura" onClick={() => alert('Próximamente: Reimpresión de factura')}>
                    <FileText className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-orange-600 rounded-lg transition" onClick={() => setSelectedSale(null)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col p-6 space-y-6">
              
              {/* Meta information */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Estado</span>
                  <span className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-1 rounded font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Facturada
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Mesa</span>
                  <span className="text-gray-800 font-bold">{selectedSale.tableName || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Mesero / Cajero</span>
                  <span className="text-gray-800 font-bold">{selectedSale.user?.name || 'Sistema'}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-3 mt-3">
                  <span className="text-gray-500 font-medium">Hora Inicio</span>
                  <span className="text-gray-800 font-medium">
                    {new Date(selectedSale.startedAt).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Hora Cierre</span>
                  <span className="text-gray-800 font-bold">
                    {new Date(selectedSale.closedAt).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-100 px-5 py-3 border-b border-gray-200">
                  <h3 className="font-bold text-gray-500 tracking-wider text-xs uppercase">Comandas / Consumo</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-400 min-w-[20px]">{item.quantity}</span>
                        <span className="font-bold text-gray-700">{item.product.name}</span>
                      </div>
                      <span className="font-bold text-gray-600">
                        ${(item.price * item.quantity).toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                  {selectedSale.items.length === 0 && (
                    <div className="p-6 text-center text-gray-400 italic font-medium">No se registraron productos</div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer (Totals) */}
            <div className="bg-gray-800 text-white p-6 pb-8 shadow-inner">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2 mb-1">
                    Métodos aplicados
                  </span>
                  <div className="flex flex-col gap-1">
                    {selectedSale.payments.map((p, idx) => (
                      <span key={idx} className="text-sm font-medium text-gray-300">
                        {p.method}: ${p.amount.toLocaleString('es-CO')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-xs block mb-1">Total Facturado</span>
                  <span className="text-3xl font-black tracking-tight">${selectedSale.total.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
