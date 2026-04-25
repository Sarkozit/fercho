import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import { useConfigStore, type Supplier } from '../store/configStore';
import {
  Package, AlertTriangle, ClipboardList, ShoppingCart, Search,
  MessageCircle, ChevronDown, ChevronUp, Save, Plus, X, Trash2,
  Building2, RefreshCw, CheckCircle2, TrendingDown, BarChart3, PackageCheck,
} from 'lucide-react';

type Tab = 'dashboard' | 'count' | 'orders';

interface DashboardItem {
  id: string;
  type: 'product' | 'inventory_item';
  name: string;
  category: string;
  unit: string;
  cost: number;
  price: number;
  idealStock: number;
  packSize: number;
  packName: string;
  currentStock: number | null;
  lastCountStock: number | null;
  expectedStock: number | null;
  sold: number;
  discrepancy: number | null;
  supplierId: string | null;
  supplierName: string | null;
  lastCountDate: string | null;
}

interface OrderItem extends DashboardItem {
  needed: number;
  packs: number;
  unitsToOrder: number;
  subtotal: number;
}

interface OrderGroup {
  supplier: Supplier;
  items: OrderItem[];
  total: number;
}

interface DashboardData {
  allItems: DashboardItem[];
  alerts: DashboardItem[];
  orderBySupplier: OrderGroup[];
  suppliers: Supplier[];
}

interface InventoryItemForm {
  name: string; unit: string; cost: string; idealStock: string; packSize: string; packName: string; categoryTag: string; supplierId: string;
}

const EMPTY_FORM: InventoryItemForm = { name: '', unit: 'und', cost: '0', idealStock: '0', packSize: '1', packName: 'Unidad', categoryTag: 'General', supplierId: '' };

const Inventory: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'product' | 'inventory_item'>('all');

  // Count state
  const [countValues, setCountValues] = useState<Record<string, string>>({});
  const [countSaving, setCountSaving] = useState<string | null>(null);
  const [countSaved, setCountSaved] = useState<Set<string>>(new Set());

  // Inventory item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<InventoryItemForm>(EMPTY_FORM);

  // Orders / receive state
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [receiveMode, setReceiveMode] = useState<string | null>(null); // supplierId in receive mode
  const [receivedQty, setReceivedQty] = useState<Record<string, string>>({}); // itemId -> received packs
  const [receiving, setReceiving] = useState(false);
  const [receiveSuccess, setReceiveSuccess] = useState<string | null>(null);

  const { suppliers, fetchSuppliers } = useConfigStore();

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory/dashboard');
      setData(res.data);
    } catch (e) {
      console.error('Error fetching inventory:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); fetchSuppliers(); }, []);

  const filteredItems = (data?.allItems || []).filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSupplier && i.supplierId !== filterSupplier) return false;
    if (filterType !== 'all' && i.type !== filterType) return false;
    return true;
  });

  const saveCount = async (item: DashboardItem) => {
    const val = countValues[item.id];
    if (val === undefined || val === '') return;
    setCountSaving(item.id);
    try {
      await axios.post('/inventory/counts', {
        [item.type === 'product' ? 'productId' : 'inventoryItemId']: item.id,
        currentStock: parseInt(val),
      });
      setCountSaved(prev => new Set([...prev, item.id]));
      setTimeout(() => setCountSaved(prev => { const n = new Set(prev); n.delete(item.id); return n; }), 2000);
    } catch (e) {
      console.error('Error saving count:', e);
    } finally {
      setCountSaving(null);
    }
  };

  const saveInventoryItem = async () => {
    try {
      const payload = {
        name: itemForm.name.trim(),
        unit: itemForm.unit,
        cost: parseFloat(itemForm.cost) || 0,
        idealStock: parseInt(itemForm.idealStock) || 0,
        packSize: parseInt(itemForm.packSize) || 1,
        packName: itemForm.packName.trim() || 'Unidad',
        categoryTag: itemForm.categoryTag.trim() || 'General',
        supplierId: itemForm.supplierId || undefined,
      };
      if (editingItemId) {
        await axios.put(`/inventory/items/${editingItemId}`, payload);
      } else {
        await axios.post('/inventory/items', payload);
      }
      setShowItemForm(false);
      setEditingItemId(null);
      setItemForm(EMPTY_FORM);
      fetchDashboard();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error al guardar');
    }
  };

  const deleteInventoryItem = async (id: string) => {
    if (!confirm('¿Eliminar este item de inventario?')) return;
    try {
      await axios.delete(`/inventory/items/${id}`);
      fetchDashboard();
    } catch (e) {
      console.error(e);
    }
  };

  // Enter receive mode for a supplier
  const startReceiveMode = (group: OrderGroup) => {
    setReceiveMode(group.supplier.id);
    // Pre-fill with suggested packs
    const qty: Record<string, string> = {};
    group.items.forEach(item => {
      qty[item.id] = String(item.packs);
    });
    setReceivedQty(qty);
  };

  // Confirm received order
  const confirmReceive = async (group: OrderGroup) => {
    setReceiving(true);
    try {
      const items = group.items
        .filter(item => parseInt(receivedQty[item.id] || '0') > 0)
        .map(item => ({
          id: item.id,
          type: item.type,
          received: parseInt(receivedQty[item.id] || '0') * item.packSize,
        }));
      await axios.post('/inventory/receive-order', { items });
      setReceiveMode(null);
      setReceivedQty({});
      setReceiveSuccess(group.supplier.id);
      setTimeout(() => setReceiveSuccess(null), 3000);
      fetchDashboard();
    } catch (e) {
      console.error(e);
      alert('Error al confirmar recepción');
    } finally {
      setReceiving(false);
    }
  };

  // Generate WhatsApp message with packs
  const generateWhatsAppMessage = (group: OrderGroup) => {
    const date = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    let msg = `🐴 *Pedido Caballo Loco*\n📅 ${date}\n\n`;
    msg += `*Proveedor: ${group.supplier.name}*\n\n`;
    group.items.forEach(item => {
      if (item.packSize > 1) {
        msg += `${item.packs} × ${item.packName} de ${item.name} ($${(item.cost * item.packSize).toLocaleString('es-CO')}) = $${item.subtotal.toLocaleString('es-CO')}\n`;
      } else {
        msg += `${item.unitsToOrder} × ${item.name} ($${item.cost.toLocaleString('es-CO')}) = $${item.subtotal.toLocaleString('es-CO')}\n`;
      }
    });
    msg += `\n━━━━━━━━━━━━━━━\n*TOTAL ESTIMADO: $${group.total.toLocaleString('es-CO')}*`;
    return msg;
  };

  const openWhatsApp = (group: OrderGroup) => {
    const msg = generateWhatsAppMessage(group);
    const phone = group.supplier.phone?.replace(/\D/g, '') || '';
    const url = phone
      ? `https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const tabs = [
    { key: 'dashboard' as Tab, label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'count' as Tab, label: 'Conteo', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'orders' as Tab, label: 'Pedidos', icon: <ShoppingCart className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="bg-[#555555] text-white px-6 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg tracking-wide">📦 Inventario</span>
          <div className="flex bg-white/10 rounded-lg p-0.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                  tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-white/70 hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'count' && (
            <button
              onClick={() => { setShowItemForm(true); setEditingItemId(null); setItemForm(EMPTY_FORM); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
            >
              <Plus className="h-4 w-4" />
              <span>Item Operación</span>
            </button>
          )}
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-sm transition border border-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : (
          <>
            {/* ===== DASHBOARD TAB ===== */}
            {tab === 'dashboard' && data && (
              <div className="p-6 space-y-6 max-w-6xl mx-auto">
                {/* KPI Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Items</p>
                    <p className="text-3xl font-black text-gray-800 mt-1">{data.allItems.length}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Con Conteo</p>
                    <p className="text-3xl font-black text-blue-600 mt-1">{data.allItems.filter(i => i.currentStock !== null).length}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bajo Stock</p>
                    <p className="text-3xl font-black text-orange-500 mt-1">
                      {data.allItems.filter(i => i.currentStock !== null && i.idealStock > 0 && i.currentStock < i.idealStock).length}
                    </p>
                  </div>
                  <div className={`rounded-xl border p-5 shadow-sm ${data.alerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alertas</p>
                    <p className={`text-3xl font-black mt-1 ${data.alerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {data.alerts.length}
                    </p>
                  </div>
                </div>

                {/* Alerts */}
                {data.alerts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <h3 className="font-black text-red-700 text-sm uppercase tracking-wider">
                        Discrepancias Detectadas ({data.alerts.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {data.alerts.map(alert => (
                        <div key={alert.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-red-100">
                          <div className="flex items-center gap-3">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            <span className="font-bold text-gray-800">{alert.name}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{alert.category}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-500">Esperado: <strong>{alert.expectedStock}</strong></span>
                            <span className="text-gray-500">Conteo: <strong>{alert.currentStock}</strong></span>
                            <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">
                              {alert.discrepancy! > 0 ? '+' : ''}{alert.discrepancy}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orders summary */}
                {data.orderBySupplier.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-orange-500" />
                      <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider">Pedidos Pendientes por Proveedor</h3>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Proveedor</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase">Items</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Total Estimado</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.orderBySupplier.map(group => (
                          <tr key={group.supplier.id} className="hover:bg-orange-50/30 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="font-bold text-gray-800">{group.supplier.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-gray-600">{group.items.length}</td>
                            <td className="px-6 py-4 text-right font-black text-gray-800">${group.total.toLocaleString('es-CO')}</td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => setTab('orders')} className="text-xs font-bold text-orange-500 hover:text-orange-700 transition">
                                Ver Detalle →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ===== COUNT TAB ===== */}
            {tab === 'count' && data && (
              <div className="p-6 max-w-6xl mx-auto">
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text" placeholder="Buscar producto..."
                      value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                    />
                  </div>
                  <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400">
                    <option value="">Todos los proveedores</option>
                    {(data.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400">
                    <option value="all">Todos</option>
                    <option value="product">Productos POS</option>
                    <option value="inventory_item">Items Operación</option>
                  </select>
                </div>

                {/* Item form */}
                {showItemForm && (
                  <div className="bg-white border border-orange-200 rounded-xl p-5 mb-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-black text-sm text-gray-700 uppercase">{editingItemId ? 'Editar' : 'Nuevo'} Item de Operación</h3>
                      <button onClick={() => setShowItemForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre *</label>
                        <input type="text" value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400" placeholder="Ej: Vasos plásticos" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                        <input type="text" value={itemForm.categoryTag} onChange={e => setItemForm(p => ({ ...p, categoryTag: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400" placeholder="Ej: Desechables" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Proveedor</label>
                        <select value={itemForm.supplierId} onChange={e => setItemForm(p => ({ ...p, supplierId: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400">
                          <option value="">— Sin proveedor —</option>
                          {suppliers.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Costo unitario</label>
                        <input type="number" min="0" value={itemForm.cost} onChange={e => setItemForm(p => ({ ...p, cost: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock Ideal</label>
                        <input type="number" min="0" value={itemForm.idealStock} onChange={e => setItemForm(p => ({ ...p, idealStock: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Presentación (cant.)</label>
                        <input type="number" min="1" value={itemForm.packSize} onChange={e => setItemForm(p => ({ ...p, packSize: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400" placeholder="Ej: 6" />
                        <p className="text-[10px] text-gray-400 mt-1 leading-tight">Cantidad de unidades que trae el empaque.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre presentación</label>
                        <input type="text" value={itemForm.packName} onChange={e => setItemForm(p => ({ ...p, packName: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400" placeholder="Ej: Six Pack" />
                        <p className="text-[10px] text-gray-400 mt-1 leading-tight">Palabra para el pedido (Ej: Paca, Caja).</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unidad</label>
                        <select value={itemForm.unit} onChange={e => setItemForm(p => ({ ...p, unit: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400">
                          <option value="und">Unidad</option>
                          <option value="botella">Botella</option>
                          <option value="media">Media</option>
                          <option value="porcion">Porción</option>
                          <option value="kg">Kilogramo</option>
                          <option value="libra">Libra</option>
                          <option value="litro">Litro</option>
                          <option value="paquete">Paquete</option>
                          <option value="caja">Caja</option>
                          <option value="bolsa">Bolsa</option>
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1 leading-tight">Medida para el conteo (Ej: Botella, Porción).</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => setShowItemForm(false)} className="px-4 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                      <button onClick={saveInventoryItem} disabled={!itemForm.name.trim()}
                        className="px-4 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5">
                        <Save className="w-3.5 h-3.5" /> Guardar
                      </button>
                    </div>
                  </div>
                )}

                {/* Count table */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Producto</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Proveedor</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Ideal</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Vendido</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Conteo</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Dif.</th>
                        <th className="px-3 py-3 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredItems.map(item => {
                        const isSaved = countSaved.has(item.id);
                        const isSaving = countSaving === item.id;
                        return (
                          <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50/50 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.type === 'product' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                  {item.type === 'product' ? 'POS' : 'OP'}
                                </span>
                                <div>
                                  <span className="font-bold text-gray-800 text-sm block">{item.name}</span>
                                  {item.packSize > 1 && <span className="text-[10px] text-gray-400">Pres: {item.packName} (×{item.packSize})</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{item.supplierName || '—'}</td>
                            <td className="px-4 py-3 text-center text-sm font-semibold text-gray-600">{item.idealStock || '—'}</td>
                            <td className="px-4 py-3 text-center text-sm text-gray-500">{item.sold || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number" min="0"
                                value={countValues[item.id] ?? (item.lastCountStock !== null ? String(item.lastCountStock) : '')}
                                onChange={e => setCountValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                                placeholder="—"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.discrepancy !== null && (
                                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                  item.discrepancy < 0 ? 'bg-red-100 text-red-600' : item.discrepancy > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600'
                                }`}>
                                  {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => saveCount(item)} disabled={isSaving || !countValues[item.id]}
                                  className="p-1.5 rounded hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition disabled:opacity-30" title="Guardar conteo">
                                  {isSaved ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Save className="w-4 h-4" />}
                                </button>
                                {item.type === 'inventory_item' && (
                                  <button onClick={() => deleteInventoryItem(item.id)}
                                    className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition" title="Eliminar">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredItems.length === 0 && (
                    <div className="py-16 text-center text-gray-400">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                      <p className="font-medium">No se encontraron productos</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== ORDERS TAB ===== */}
            {tab === 'orders' && data && (
              <div className="p-6 max-w-5xl mx-auto space-y-4">
                {data.orderBySupplier.length === 0 ? (
                  <div className="py-20 text-center text-gray-400">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                    <p className="font-bold text-lg text-gray-500">No hay pedidos pendientes</p>
                    <p className="text-sm mt-1">Todos los productos están en stock o falta registrar conteo</p>
                  </div>
                ) : (
                  data.orderBySupplier.map(group => {
                    const isExpanded = expandedSupplier === group.supplier.id;
                    const isReceiving = receiveMode === group.supplier.id;
                    const justReceived = receiveSuccess === group.supplier.id;

                    return (
                      <div key={group.supplier.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden transition ${
                        justReceived ? 'border-green-300 bg-green-50/30' : 'border-gray-200'
                      }`}>
                        {/* Supplier header */}
                        <button
                          onClick={() => setExpandedSupplier(isExpanded ? null : group.supplier.id)}
                          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition text-left"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-orange-500" />
                            <div>
                              <span className="font-black text-gray-800 block">{group.supplier.name}</span>
                              {group.supplier.phone && <span className="text-xs text-gray-400">{group.supplier.phone}</span>}
                            </div>
                            {justReceived && (
                              <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Recibido
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-full">{group.items.length} items</span>
                            <span className="font-black text-lg text-gray-800">${group.total.toLocaleString('es-CO')}</span>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </div>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t border-gray-100">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-gray-50/50">
                                  <th className="px-6 py-2 text-left text-xs font-bold text-gray-400 uppercase">Producto</th>
                                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase">Actual</th>
                                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase">Ideal</th>
                                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase">A Pedir</th>
                                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase">Costo</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-400 uppercase">Subtotal</th>
                                  {isReceiving && <th className="px-4 py-2 text-center text-xs font-bold text-green-600 uppercase">Recibido</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {group.items.map(item => (
                                  <tr key={item.id} className={isReceiving ? 'bg-green-50/20' : ''}>
                                    <td className="px-6 py-3">
                                      <span className="font-semibold text-sm text-gray-800">{item.name}</span>
                                      {item.packSize > 1 && <span className="text-[10px] text-gray-400 ml-2">({item.packName})</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-500">{item.currentStock ?? '—'}</td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-500">{item.idealStock}</td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex flex-col items-center">
                                        <span className="font-bold text-orange-600">
                                          {item.packSize > 1 ? `${item.packs} × ${item.packName}` : `${item.unitsToOrder} und`}
                                        </span>
                                        {item.packSize > 1 && <span className="text-[10px] text-gray-400">({item.unitsToOrder} und)</span>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-500">
                                      ${item.packSize > 1 ? (item.cost * item.packSize).toLocaleString('es-CO') : item.cost.toLocaleString('es-CO')}
                                      {item.packSize > 1 && <span className="text-[10px] text-gray-400 block">×{item.packName}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-800">${item.subtotal.toLocaleString('es-CO')}</td>
                                    {isReceiving && (
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <input
                                            type="number" min="0"
                                            value={receivedQty[item.id] || '0'}
                                            onChange={e => setReceivedQty(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            className="w-14 border border-green-300 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-green-400"
                                          />
                                          {item.packSize > 1 && <span className="text-xs text-gray-400">{item.packName}</span>}
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-50 font-black">
                                  <td colSpan={5} className="px-6 py-3 text-right text-sm uppercase text-gray-500">Total Estimado:</td>
                                  <td className="px-4 py-3 text-right text-lg text-gray-800">${group.total.toLocaleString('es-CO')}</td>
                                  {isReceiving && <td></td>}
                                </tr>
                              </tfoot>
                            </table>

                            {/* Action buttons */}
                            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                              <div className="flex gap-2">
                                {!isReceiving ? (
                                  <button
                                    onClick={() => startReceiveMode(group)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition text-sm"
                                  >
                                    <PackageCheck className="w-4 h-4" />
                                    Recibir Pedido
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => confirmReceive(group)}
                                      disabled={receiving}
                                      className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition text-sm disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      {receiving ? 'Guardando...' : 'Confirmar Recepción'}
                                    </button>
                                    <button
                                      onClick={() => { setReceiveMode(null); setReceivedQty({}); }}
                                      className="px-4 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={() => openWhatsApp(group)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition text-sm shadow-sm"
                              >
                                <MessageCircle className="w-4 h-4" />
                                Enviar por WhatsApp
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Inventory;
