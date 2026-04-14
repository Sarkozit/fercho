import { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Search, X, Percent, Printer, Pencil,
  RefreshCw, Grid3X3, List, Info, ArrowRightLeft, Edit2,
  UtensilsCrossed, CalendarDays, LogOut
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTableStore } from '../store/tableStore';
import type { Product } from '../store/tableStore';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { printAgent } from '../services/printAgent';
import axios from '../api/axios';

type MobileView = 'map' | 'table_detail' | 'add_products' | 'checkout';
type ViewMode = 'grid' | 'list';

interface Category {
  id: string;
  name: string;
  products?: Product[];
}

const MobileTableMap = () => {
  const {
    rooms, selectedRoomId, selectedTableId,
    pendingItems, favorites,
    fetchRooms, fetchFavorites, initSocket,
    setSelectedRoom, setSelectedTable,
    addPendingItem, removePendingItem, updatePendingItem, clearPendingItems,
    openTable, confirmOrder, checkoutTable,
    deleteSaleItem, applyDiscount, tableTips
  } = useTableStore();

  const { user, logout } = useAuthStore();
  const { appSettings, fetchAppSettings } = useConfigStore();

  const [view, setView] = useState<MobileView>('map');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [openingComment, setOpeningComment] = useState('');

  // Add products state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Quantity popup
  const [qtyPopup, setQtyPopup] = useState<{ product: Product; qty: number; comment: string } | null>(null);

  // Checkout state
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('Efectivo');
  const [checkoutPayment, setCheckoutPayment] = useState('');

  // Discount state
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');

  // Edit menu
  const [showEditMenu, setShowEditMenu] = useState(false);

  // Move table state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetTableId, setMoveTargetTableId] = useState('');

  // Edit comment state
  const [showEditCommentModal, setShowEditCommentModal] = useState(false);
  const [editComment, setEditComment] = useState('');

  // Toast
  const [toast, setToast] = useState('');

  const canManage = user?.role === 'ADMIN' || user?.role === 'CAJERO';

  useEffect(() => {
    fetchRooms();
    fetchFavorites();
    initSocket();
    fetchAppSettings();
  }, []);

  // Selected room and table
  const currentRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];
  const tables = currentRoom?.tables || [];
  const selectedTable = tables.find(t => t.id === selectedTableId) || null;
  const items = selectedTable?.activeSale?.items || [];

  // Search products debounce
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchQuery.length > 1) {
        try {
          const res = await axios.get(`/products?search=${searchQuery}`);
          setSearchResults(res.data);
        } catch (e) { console.error(e); }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Fetch categories when opening add products
  const loadCategories = async () => {
    try {
      const res = await axios.get('/products/categories');
      setCategories(res.data);
      if (res.data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId('favorites');
      }
    } catch (e) { console.error(e); }
  };

  // Fetch products for selected category
  useEffect(() => {
    if (selectedCategoryId === 'favorites') {
      setCategoryProducts(favorites);
    } else if (selectedCategoryId) {
      (async () => {
        try {
          const res = await axios.get(`/products?categoryId=${selectedCategoryId}`);
          setCategoryProducts(res.data);
        } catch (e) { console.error(e); }
      })();
    }
  }, [selectedCategoryId, favorites]);

  // Auto-select first room
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoom(rooms[0].id);
    }
  }, [rooms]);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Compute totals
  const sale = selectedTable?.activeSale;
  const subtotal = sale?.subtotal || 0;
  const discount = sale?.discount || 0;
  const saleTotal = sale?.total || 0;
  const pendingTotal = pendingItems.reduce((a, i) => a + i.price * i.quantity, 0);

  const tipSettings = appSettings || { tipEnabled: true, tipThreshold: 150000, tipPercent: 10 };
  const showTip = tipSettings.tipEnabled && saleTotal >= tipSettings.tipThreshold;
  const tipEnabled = showTip ? (tableTips[selectedTable?.id || ''] ?? true) : false;
  const tipPercent = tipSettings.tipPercent;
  const tipAmount = tipEnabled ? Math.round(saleTotal * tipPercent / 100) : 0;
  const total = saleTotal + tipAmount;
  const payment = parseFloat(checkoutPayment) || 0;
  const change = payment > 0 ? Math.max(0, payment - total) : 0;

  // Color for table status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OCCUPIED': return '#e74c3c';
      case 'BILLING': return '#3b82f6';
      case 'FREE':
      default: return '#4ecdc4';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OCCUPIED': return 'Ocupada';
      case 'BILLING': return 'En cuenta';
      case 'FREE':
      default: return 'Libre';
    }
  };

  // Handle table tap
  const handleTableTap = (table: typeof tables[0]) => {
    setSelectedTable(table.id);
    setOpeningComment('');
    setShowDiscount(false);
    setShowEditMenu(false);
    clearPendingItems();
    setView('table_detail');
  };

  // Handle open table
  const handleOpenTable = async () => {
    if (!selectedTable) return;
    await openTable(selectedTable.id, openingComment);
    setOpeningComment('');
  };

  // Handle billing (print factura)
  const handlePrintFactura = async () => {
    if (!selectedTable) return;
    try {
      await axios.post(`/tables/tables/${selectedTable.id}/status`, { status: 'BILLING' });
      // Remote print
      if (printAgent.getStatus() === 'connected') {
        const settingsRes = await axios.get('/config/print-settings');
        const settings = settingsRes.data;
        const s = selectedTable.activeSale!;
        printAgent.printFactura({
          header: settings.header || '', tableNumber: selectedTable.number,
          items: s.items.map(i => ({ qty: i.quantity, name: i.product.name, price: i.price })),
          subtotal: s.subtotal, discount: s.discount,
          ...(tipAmount > 0 ? { tipPercent, tipAmount } : {}),
          total: s.total + tipAmount,
          footer: settings.footer || '', qrText: settings.qrText || '', qrImage: settings.qrImage || ''
        });
      } else {
        await axios.post(`/tables/tables/${selectedTable.id}/print-factura`, {
          tipAmount: tipAmount > 0 ? tipAmount : undefined
        });
      }
      setToast('🖨️ Pre-cuenta enviada');
    } catch (e) {
      setToast('❌ Error al imprimir');
    }
  };

  // Open add products
  const handleOpenAddProducts = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCategoryId('favorites');
    loadCategories();
    setView('add_products');
  };

  // Add product to pending (via popup)
  const handleProductTap = (product: Product) => {
    setQtyPopup({ product, qty: 1, comment: '' });
  };

  const confirmQtyPopup = () => {
    if (!qtyPopup) return;
    // Check if already in pendingItems
    const existingIdx = pendingItems.findIndex(p => p.productId === qtyPopup.product.id && p.comment === qtyPopup.comment);
    if (existingIdx >= 0) {
      updatePendingItem(existingIdx, { quantity: pendingItems[existingIdx].quantity + qtyPopup.qty });
    } else {
      addPendingItem(qtyPopup.product);
      // Update quantity and comment to match
      const newIdx = useTableStore.getState().pendingItems.length - 1;
      if (newIdx >= 0) {
        updatePendingItem(newIdx, { quantity: qtyPopup.qty, comment: qtyPopup.comment });
      }
    }
    setQtyPopup(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Confirm order (from add_products view)
  const handleConfirmOrder = async () => {
    if (!selectedTable || pendingItems.length === 0) return;
    await confirmOrder(selectedTable.id);
    setToast('🖨️ Pedido confirmado — comanda enviada');
    setView('table_detail');
  };

  // Open checkout (if no items, close table directly)
  const handleOpenCheckout = () => {
    if (!selectedTable) return;
    if (items.length === 0) {
      // No items — close immediately without checkout flow
      checkoutTable(selectedTable.id, 'Efectivo', 0, 0);
      setView('map');
      setSelectedTable(null);
      setToast('✅ Mesa cerrada');
      return;
    }
    setCheckoutPaymentMethod('Efectivo');
    setCheckoutPayment('');
    setView('checkout');
  };

  // Confirm checkout
  const handleConfirmCheckout = () => {
    if (!selectedTable) return;
    checkoutTable(selectedTable.id, checkoutPaymentMethod, payment || total, tipAmount);
    setView('map');
    setSelectedTable(null);
    setToast('✅ Mesa cerrada');
  };

  // Apply discount
  const handleApplyDiscount = async () => {
    if (!selectedTable) return;
    let d = 0;
    if (discountPercent) {
      d = Math.round(subtotal * parseFloat(discountPercent) / 100);
    } else if (discountAmount) {
      d = parseInt(discountAmount);
    }
    if (d > 0) {
      await applyDiscount(selectedTable.id, d);
      setToast(`✅ Descuento de $${d.toLocaleString('es-CO')} aplicado`);
    }
    setShowDiscount(false);
    setDiscountPercent('');
    setDiscountAmount('');
  };

  // Move table — uses correct PUT endpoint
  const handleMoveTable = async () => {
    if (!selectedTable || !moveTargetTableId) return;
    try {
      await axios.put(`/tables/tables/${selectedTable.id}/move-sale`, { targetTableId: moveTargetTableId });
      setToast('✅ Mesa movida');
      setShowMoveModal(false);
      setView('map');
      setSelectedTable(null);
    } catch (e: any) {
      setToast('❌ ' + (e.response?.data?.error || 'Error al mover'));
    }
  };

  // Edit comment
  const handleSaveComment = async () => {
    if (!selectedTable) return;
    try {
      await axios.post(`/tables/tables/${selectedTable.id}/status`, { status: 'OCCUPIED', comment: editComment });
      setToast('✅ Comentario actualizado');
      setShowEditCommentModal(false);
    } catch (e: any) {
      setToast('❌ ' + (e.response?.data?.error || 'Error al editar'));
    }
  };

  // Get available tables for move (free tables only)
  const allTables = rooms.flatMap(r => r.tables);
  const allOtherTables = allTables.filter(t => t.id !== selectedTable?.id);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  // ── Toast ──
  const renderToast = () => toast ? (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-[9999] text-sm font-medium animate-bounce">
      {toast}
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: MAP
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'map') {
    return (
      <div className="flex flex-col h-full w-full bg-white">
        {/* Mesas / Reservas tabs + Logout */}
        <div className="flex flex-shrink-0 border-b border-gray-200">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-[#ff5a5f] transition"
          >
            <UtensilsCrossed className="h-4 w-4" />
            Mesas
          </button>
          {(user?.role === 'ADMIN' || user?.role === 'CAJERO') && (
            <Link
              to="/reservas"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-gray-500 bg-gray-50 transition"
            >
              <CalendarDays className="h-4 w-4" />
              Reservas
            </Link>
          )}
          <button
            onClick={logout}
            className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-gray-400 bg-gray-50 border-l border-gray-200 transition active:bg-gray-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Room tabs */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto flex-shrink-0 border-b border-gray-100">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition ${
                (currentRoom?.id === room.id)
                  ? 'bg-[#ff5a5f] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {room.name}
            </button>
          ))}
          <button onClick={() => fetchRooms()} className="ml-auto p-1 text-gray-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="px-4 py-2 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
          <span className="text-sm text-gray-500">Ver mesas como</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 text-sm font-medium ${viewMode === 'grid' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              <Grid3X3 className="h-4 w-4" /> Mapa
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 text-sm font-medium ${viewMode === 'list' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              <List className="h-4 w-4" /> Lista
            </button>
          </div>
        </div>

        {/* Tables */}
        <div className="flex-1 overflow-y-auto p-2">
          {viewMode === 'grid' ? (() => {
            /* Map View — scale coordinates to fill the full container width */
            const xVals = tables.map(t => t.x);
            const yVals = tables.map(t => t.y);
            const minX = Math.min(...xVals);
            const maxX = Math.max(...xVals);
            const minY = Math.min(...yVals);
            const maxY = Math.max(...yVals);
            const rangeX = maxX - minX || 1;
            const rangeY = maxY - minY || 1;
            // Remap coordinates to fill 4%-96% of container
            const scaleX = (x: number) => 4 + ((x - minX) / rangeX) * 92;
            const scaleY = (y: number) => 4 + ((y - minY) / rangeY) * 92;

            return (
              <div className="relative w-full" style={{ paddingBottom: '120%' }}>
                {tables.map(table => {
                  const size = table.size === 'large' ? 48 : table.size === 'small' ? 32 : 40;
                  const isRound = table.shape === 'circle';
                  const hasUser = table.status !== 'FREE' && table.activeSale?.user?.username;
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableTap(table)}
                      className="absolute flex flex-col items-center justify-center text-white font-bold shadow-md"
                      style={{
                        left: `${scaleX(table.x)}%`,
                        top: `${scaleY(table.y)}%`,
                        width: size,
                        height: size,
                        backgroundColor: getStatusColor(table.status),
                        borderRadius: isRound ? '50%' : '6px',
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'manipulation',
                      }}
                    >
                      <span style={{ fontSize: size > 36 ? '13px' : '11px', lineHeight: 1 }}>{table.number}</span>
                      {hasUser && (
                        <span className="text-white/80 font-normal truncate w-full text-center px-0.5" style={{ fontSize: '7px', lineHeight: 1.1 }}>
                          {table.activeSale!.user!.username}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()
          : (
            /* List View — sorted by table number */
            <div className="flex flex-col gap-1">
              {[...tables].sort((a, b) => a.number - b.number).map(table => (
                <button
                  key={table.id}
                  onClick={() => handleTableTap(table)}
                  className="flex items-center justify-between py-3 px-6 rounded text-white font-bold text-lg"
                  style={{ backgroundColor: getStatusColor(table.status), touchAction: 'manipulation' }}
                >
                  <span>Mesa {table.number}</span>
                  {table.status !== 'FREE' && table.activeSale?.user?.username && (
                    <span className="text-sm font-normal text-white/80">{table.activeSale.user.username}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {renderToast()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: TABLE DETAIL
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'table_detail' && selectedTable) {
    const isFree = selectedTable.status === 'FREE';
    const headerColor = isFree ? '#4ecdc4' : '#e74c3c';
    const hasItems = items.length > 0;
    const hasPending = pendingItems.length > 0;

    return (
      <div className="flex flex-col h-full w-full bg-white">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-4 flex items-center gap-3" style={{ backgroundColor: headerColor }}>
          <button onClick={() => { setView('map'); setSelectedTable(null); clearPendingItems(); }} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex-1 text-center text-white">
            <div className="font-bold text-xl">Mesa {selectedTable.number}</div>
            <div className="text-sm opacity-90">{getStatusLabel(selectedTable.status)}</div>
          </div>
          <div className="w-6" />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isFree ? (
            /* ── FREE TABLE: open form ── */
            <div className="space-y-6">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Comentario</label>
                <textarea
                  value={openingComment}
                  onChange={e => setOpeningComment(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-28 focus:ring-2 focus:ring-orange-300 outline-none"
                  placeholder="Comentario opcional..."
                />
              </div>
              <button
                onClick={handleOpenTable}
                className="w-full py-3.5 bg-[#ff5a2d] text-white font-bold text-lg rounded-xl shadow-lg transition"
              >
                Abrir mesa
              </button>
            </div>
          ) : (
            /* ── OCCUPIED/BILLING TABLE: items + actions ── */
            <div className="space-y-4">
              {/* Opening comment & time */}
              {sale?.openingComment && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-700">
                  💬 {sale.openingComment}
                </div>
              )}
              {sale?.startedAt && (
                <div className="text-xs text-gray-400 text-center">
                  Abierta: {new Date(sale.startedAt).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              )}
              {sale?.user && (
                <div className="text-xs text-gray-400 text-center">
                  Abierta por: {sale.user.username}
                </div>
              )}

              {/* Items list */}
              {hasItems ? (
                <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-500 w-6">{item.quantity}</span>
                      <div className="flex-1 ml-2">
                        <span className="text-sm font-medium text-gray-800">{item.product.name}</span>
                        {item.comment && (
                          <div className="text-xs text-gray-400 mt-0.5 pl-2 border-l-2 border-gray-200">{item.comment}</div>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 mr-3">
                        ${(item.price * item.quantity).toLocaleString('es-CO')}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => deleteSaleItem(selectedTable.id, item.id)}
                          className="text-gray-300 hover:text-red-400 transition p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Pending items (not confirmed yet) */}
                  {hasPending && (
                    <>
                      <div className="px-4 py-2 bg-amber-50 text-xs font-bold text-amber-600 uppercase">Pendientes por confirmar</div>
                      {pendingItems.map((item, idx) => (
                        <div key={idx} className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0 bg-amber-50/50">
                          <span className="text-sm text-gray-500 w-6">{item.quantity}</span>
                          <span className="flex-1 ml-2 text-sm font-medium text-gray-800">{item.name}</span>
                          <span className="text-sm text-gray-600 mr-3">${(item.price * item.quantity).toLocaleString('es-CO')}</span>
                          <button onClick={() => removePendingItem(idx)} className="text-gray-300 hover:text-red-400 p-1">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                    <span className="font-bold text-gray-800">Total</span>
                    <span className="font-bold text-gray-800 text-lg">${(saleTotal + pendingTotal).toLocaleString('es-CO')}</span>
                  </div>
                </div>
              ) : !hasPending ? (
                <div className="bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center py-10">
                  <Info className="h-8 w-8 text-gray-300 mb-2" />
                  <span className="text-sm text-gray-400">Sin adiciones.</span>
                </div>
              ) : (
                /* Only pending, no confirmed items */
                <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2 bg-amber-50 text-xs font-bold text-amber-600 uppercase">Pendientes por confirmar</div>
                  {pendingItems.map((item, idx) => (
                    <div key={idx} className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-500 w-6">{item.quantity}</span>
                      <span className="flex-1 ml-2 text-sm font-medium text-gray-800">{item.name}</span>
                      <span className="text-sm text-gray-600 mr-3">${(item.price * item.quantity).toLocaleString('es-CO')}</span>
                      <button onClick={() => removePendingItem(idx)} className="text-gray-300 hover:text-red-400 p-1">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                    <span className="font-bold text-gray-800">Total pendiente</span>
                    <span className="font-bold text-gray-800">${pendingTotal.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              )}

              {/* Confirm pending items button */}
              {hasPending && (
                <button
                  onClick={async () => {
                    await confirmOrder(selectedTable.id);
                    setToast('🖨️ Pedido confirmado — comanda enviada');
                  }}
                  className="w-full py-3 bg-[#f97316] text-white font-bold rounded-xl shadow transition"
                >
                  Confirmar pedido ({pendingItems.length} items)
                </button>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {canManage && (
                  <button
                    onClick={() => setShowDiscount(!showDiscount)}
                    className="flex-1 flex flex-col items-center gap-1 py-3 bg-red-50 rounded-xl border border-red-100 text-red-500 active:bg-red-100 transition"
                  >
                    <Percent className="h-5 w-5" />
                    <span className="text-[11px] font-medium">Descuento</span>
                  </button>
                )}
                <button
                  onClick={handlePrintFactura}
                  className="flex-1 flex flex-col items-center gap-1 py-3 bg-red-50 rounded-xl border border-red-100 text-red-500 active:bg-red-100 transition"
                >
                  <Printer className="h-5 w-5" />
                  <span className="text-[11px] font-medium">Imprimir</span>
                </button>
                {canManage && (
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowEditMenu(!showEditMenu)}
                      className="w-full flex flex-col items-center gap-1 py-3 bg-red-50 rounded-xl border border-red-100 text-red-500 active:bg-red-100 transition"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Pencil className="h-5 w-5" />
                      <span className="text-[11px] font-medium">Editar</span>
                    </button>
                    {showEditMenu && (
                      <div className="absolute right-0 bottom-full mb-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 w-48 py-1 overflow-hidden">
                        <button
                          onClick={() => { setShowEditMenu(false); setEditComment(sale?.openingComment || ''); setShowEditCommentModal(true); }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4 text-gray-400" />
                          Editar Venta
                        </button>
                        <button
                          onClick={() => { setShowEditMenu(false); setShowMoveModal(true); setMoveTargetTableId(''); }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition flex items-center gap-2"
                        >
                          <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                          Mover Venta
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Discount section */}
              {showDiscount && canManage && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                  <span className="text-sm font-bold text-gray-700">Aplicar descuento</span>
                  <div className="flex gap-2">
                    <input
                      type="number" placeholder="% porcentaje"
                      value={discountPercent}
                      onChange={e => { setDiscountPercent(e.target.value); setDiscountAmount(''); }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <input
                      type="number" placeholder="$ monto"
                      value={discountAmount}
                      onChange={e => { setDiscountAmount(e.target.value); setDiscountPercent(''); }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                  <button onClick={handleApplyDiscount} className="w-full py-2 bg-orange-500 text-white rounded-lg font-bold text-sm transition">
                    Aplicar
                  </button>
                </div>
              )}

              {/* Close table button — available even without items */}
              {canManage && (
                <button
                  onClick={handleOpenCheckout}
                  className="w-full py-3.5 bg-[#3d3d6b] text-white font-bold rounded-xl shadow-lg transition text-lg"
                >
                  Cerrar mesa
                </button>
              )}
            </div>
          )}
        </div>

        {/* FAB - Add products */}
        {!isFree && (
          <button
            onClick={handleOpenAddProducts}
            className="fixed bottom-6 right-6 w-14 h-14 bg-[#ff5a2d] text-white rounded-full shadow-2xl flex items-center justify-center transition z-50"
          >
            <Plus className="h-7 w-7" />
          </button>
        )}

        {/* Move modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-800">Mover venta — Mesa {selectedTable.number}</div>
              <div className="p-5 max-h-60 overflow-y-auto space-y-2">
                {[...allOtherTables].sort((a, b) => a.number - b.number).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setMoveTargetTableId(t.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm border transition ${moveTargetTableId === t.id ? 'border-orange-400 bg-orange-50 font-bold' : 'border-gray-100 hover:bg-gray-50'}`}
                  >
                    Mesa {t.number} ({getStatusLabel(t.status)})
                  </button>
                ))}
              </div>
              <div className="flex gap-2 p-4 border-t border-gray-100">
                <button onClick={() => setShowMoveModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={handleMoveTable} disabled={!moveTargetTableId} className="flex-1 py-2.5 bg-[#ff5a2d] text-white rounded-lg text-sm font-bold disabled:opacity-40">Mover</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit comment modal */}
        {showEditCommentModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-800">Editar comentario</div>
              <div className="p-5">
                <textarea
                  value={editComment}
                  onChange={e => setEditComment(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-28 outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="Comentario de la mesa..."
                  autoFocus
                />
              </div>
              <div className="flex gap-2 p-4 border-t border-gray-100">
                <button onClick={() => setShowEditCommentModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={handleSaveComment} className="flex-1 py-2.5 bg-[#ff5a2d] text-white rounded-lg text-sm font-bold">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {renderToast()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: ADD PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'add_products') {
    const displayProducts = searchQuery.length > 1 ? searchResults : categoryProducts;

    return (
      <div className="flex flex-col h-full w-full bg-white" style={{ touchAction: 'manipulation' }}>
        {/* Header with search */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-3 flex items-center gap-2">
          <button onClick={() => setView('table_detail')} className="text-gray-600 p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 relative">
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="Buscar producto..."
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categories + Products split — pb-16 accounts for fixed footer */}
        <div className="flex flex-1 overflow-hidden min-h-0 pb-16">
          {/* Categories sidebar */}
          {searchQuery.length <= 1 && (
            <div className="w-1/3 max-w-[140px] bg-gray-50 overflow-y-auto border-r border-gray-100 flex-shrink-0">
              <button
                onClick={() => setSelectedCategoryId('favorites')}
                className={`w-full text-left px-3 py-3.5 text-sm font-medium border-b border-gray-100 transition ${selectedCategoryId === 'favorites' ? 'bg-[#ffd900] font-bold text-gray-900' : 'text-gray-600'}`}
              >
                Favoritos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full text-left px-3 py-3.5 text-sm font-medium border-b border-gray-100 transition ${selectedCategoryId === cat.id ? 'bg-[#ffd900] font-bold text-gray-900' : 'text-gray-600'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Products list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="bg-white rounded-lg m-2">
              {displayProducts.length > 0 ? displayProducts.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => handleProductTap(prod)}
                  className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 last:border-0 text-left active:bg-orange-50 transition"
                  style={{ touchAction: 'manipulation' }}
                >
                  <span className="text-sm font-medium text-gray-800">{prod.name}</span>
                  <span className="text-sm text-gray-500">${prod.price.toLocaleString('es-CO')}</span>
                </button>
              )) : (
                <div className="p-8 text-center text-sm text-gray-400">
                  {searchQuery.length > 1 ? 'No se encontraron productos' : 'Selecciona una categoría'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer — fixed at bottom so it never scrolls away */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 z-40">
          <button
            onClick={() => { clearPendingItems(); setView('table_detail'); }}
            className="flex-1 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 active:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmOrder}
            disabled={pendingItems.length === 0}
            className="flex-1 py-3 bg-[#ff5a2d] text-white rounded-lg text-sm font-bold transition disabled:opacity-40"
          >
            Confirmar {pendingItems.length > 0 ? `(${pendingItems.length})` : ''}
          </button>
        </div>

        {/* Quantity popup — fixed overlay */}
        {qtyPopup && (
          <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-800">{qtyPopup.product.name}</h3>
              </div>
              <div className="p-5 space-y-4">
                {/* Quantity stepper */}
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={() => setQtyPopup({ ...qtyPopup, qty: Math.max(1, qtyPopup.qty - 1) })}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-2xl text-gray-500 active:bg-gray-100 transition"
                  >
                    −
                  </button>
                  <span className="text-4xl font-bold text-gray-800 w-12 text-center">{qtyPopup.qty}</span>
                  <button
                    onClick={() => setQtyPopup({ ...qtyPopup, qty: qtyPopup.qty + 1 })}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-2xl text-gray-500 active:bg-gray-100 transition"
                  >
                    +
                  </button>
                </div>
                {/* Comment */}
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">Comentario</label>
                  <textarea
                    value={qtyPopup.comment}
                    onChange={e => setQtyPopup({ ...qtyPopup, comment: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-orange-300"
                    placeholder="Ej: sin cebolla..."
                  />
                </div>
              </div>
              <div className="flex gap-2 p-4 border-t border-gray-100">
                <button onClick={() => setQtyPopup(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium">
                  Cancelar
                </button>
                <button onClick={confirmQtyPopup} className="flex-1 py-2.5 bg-[#ff5a2d] text-white rounded-lg text-sm font-bold transition">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {renderToast()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: CHECKOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'checkout' && selectedTable && sale) {
    return (
      <div className="flex flex-col h-full w-full bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 bg-[#3d3d6b] px-4 py-4 flex items-center gap-3">
          <button onClick={() => setView('table_detail')} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <span className="text-white font-bold text-lg">Cerrar mesa {selectedTable.number}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-sm text-gray-600">Resumen</span>
            </div>
            {items.length > 0 ? items.map(item => (
              <div key={item.id} className="px-4 py-2.5 flex items-start border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500 w-6">{item.quantity}</span>
                <div className="flex-1 ml-1">
                  <span className="text-sm text-gray-800">{item.product.name}</span>
                  {item.comment && <div className="text-xs text-gray-400 pl-2 border-l-2 border-gray-200 mt-0.5">{item.comment}</div>}
                </div>
                <span className="text-sm text-gray-700">${(item.price * item.quantity).toLocaleString('es-CO')}</span>
              </div>
            )) : (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Sin productos</div>
            )}
          </div>

          {/* Total card */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-2">
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Descuento</span>
                <span className="text-red-500">-${discount.toLocaleString('es-CO')}</span>
              </div>
            )}
            {tipAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Propina ({tipPercent}%)</span>
                <span className="text-gray-600">${tipAmount.toLocaleString('es-CO')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-bold text-gray-800">Total</span>
              <span className="font-bold text-gray-800 text-lg">${total.toLocaleString('es-CO')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Falta cobrar</span>
              <span className="text-gray-600">${Math.max(0, total - payment).toLocaleString('es-CO')}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-3">
            <span className="font-bold text-sm text-gray-600">Pagos</span>
            <div className="flex gap-2 items-center">
              <select
                value={checkoutPaymentMethod}
                onChange={e => setCheckoutPaymentMethod(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 bg-white"
              >
                <option>Efectivo</option>
                <option>Bold</option>
                <option>QR</option>
              </select>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={checkoutPayment}
                onChange={e => setCheckoutPayment(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={total.toString()}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300 text-right"
              />
            </div>
          </div>

          {/* Change */}
          {payment > 0 && change > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex justify-between">
              <span className="text-gray-600">Vuelto</span>
              <span className="font-bold text-gray-800">${change.toLocaleString('es-CO')}</span>
            </div>
          )}
        </div>

        {/* Footer — fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 z-40">
          <button
            onClick={() => setView('table_detail')}
            className="flex-1 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmCheckout}
            className="flex-1 py-3 bg-[#ff5a2d] text-white rounded-lg text-sm font-bold transition"
          >
            Confirmar
          </button>
        </div>

        {renderToast()}
      </div>
    );
  }

  // Fallback
  return <div className="flex items-center justify-center h-full w-full text-gray-400">Cargando...</div>;
};

export default MobileTableMap;
