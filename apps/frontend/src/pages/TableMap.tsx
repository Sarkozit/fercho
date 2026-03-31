import React, { useEffect, useRef, useState } from 'react';
import { useTableStore, type Product } from '../store/tableStore';
import axios from '../api/axios';
import { Plus, Minus, X, MessageSquare, CheckSquare, Edit2, Maximize2, Minimize2, Circle, Square, Trash2, ZoomIn, Menu } from 'lucide-react';

const TableMap: React.FC = () => {
  const {
    rooms,
    favorites,
    selectedRoomId,
    selectedTableId,
    pendingItems,
    loading,
    fetchRooms,
    fetchFavorites,
    setSelectedRoom,
    setSelectedTable,
    addPendingItem,
    removePendingItem,
    updatePendingItem,
    openTable,
    confirmOrder,
    initSocket,
    checkoutTable,
    updateTableCoordinates,
    updateTableShape,
    updateTableSize,
    createTable,
    deleteTable,
    createRoom,
    updateRoom,
    deleteRoom,
    updateRoomZoom,
    deleteSaleItem,
    tableTips,
    setTableTip
  } = useTableStore();

  const [openingComment, setOpeningComment] = useState('');
  const [isEditingOpeningComment, setIsEditingOpeningComment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingPendingIdx, setEditingPendingIdx] = useState<number | null>(null);
  const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(5);
  const [activeDragTable, setActiveDragTable] = useState<{ id: string, initialX: number, initialY: number, currentX: number, currentY: number } | null>(null);
  const [roomModal, setRoomModal] = useState<{ mode: 'create' | 'edit' | 'delete' | null, value: string }>({ mode: null, value: '' });
  const [deleteItemModal, setDeleteItemModal] = useState<{ type: 'pending' | 'confirmed' | null, name: string, index?: number, itemId?: string }>({ type: null, name: '' });
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPayment, setCheckoutPayment] = useState('');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('Efectivo');
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const lastPriceInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the last pending item's price input when items are added
  useEffect(() => {
    if (pendingItems.length > 0) {
      const lastIdx = pendingItems.length - 1;
      setEditingPriceIdx(lastIdx);
      setTempPrice((pendingItems[lastIdx].price * pendingItems[lastIdx].quantity).toString());
      setTimeout(() => lastPriceInputRef.current?.focus(), 50);
    } else {
      setEditingPriceIdx(null);
    }
  }, [pendingItems.length]);

  useEffect(() => {
    fetchRooms();
    fetchFavorites();
    initSocket();
  }, [fetchRooms, fetchFavorites, initSocket]);

  // Search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 1) {
        setSearching(true);
        try {
          const response = await axios.get(`/products?search=${searchQuery}`);
          setSearchResults(response.data);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleCreateRoom = () => setRoomModal({ mode: 'create', value: '' });

  const handleUpdateRoom = () => {
    const currentRoom = rooms.find(r => r.id === selectedRoomId);
    if (currentRoom) setRoomModal({ mode: 'edit', value: currentRoom.name });
  };

  const handleDeleteRoom = () => {
    const currentRoom = rooms.find(r => r.id === selectedRoomId);
    if (currentRoom) setRoomModal({ mode: 'delete', value: currentRoom.name });
  };

  const confirmRoomAction = async () => {
    if (roomModal.mode === 'create' && roomModal.value.trim()) {
      await createRoom(roomModal.value.trim());
    } else if (roomModal.mode === 'edit' && selectedRoomId && roomModal.value.trim()) {
      await updateRoom(selectedRoomId, roomModal.value.trim());
    } else if (roomModal.mode === 'delete' && selectedRoomId) {
      await deleteRoom(selectedRoomId);
    }
    setRoomModal({ mode: null, value: '' });
  };

  // Sync zoomLevel when room changes
  useEffect(() => {
    const currentRoom = rooms.find(r => r.id === selectedRoomId);
    if (currentRoom) {
      setZoomLevel(currentRoom.zoom || 5);
    }
  }, [selectedRoomId, rooms]);

  // Save zoomLevel when it changes (debounced)
  useEffect(() => {
    if (!selectedRoomId || !isEditMode) return;
    const timeout = setTimeout(() => {
      const currentRoom = rooms.find(r => r.id === selectedRoomId);
      if (currentRoom && Math.abs((currentRoom.zoom || 5) - zoomLevel) > 0.01) {
        updateRoomZoom(selectedRoomId, zoomLevel);
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [zoomLevel, selectedRoomId, isEditMode, rooms, updateRoomZoom]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const selectedTable = selectedRoom?.tables.find((t) => t.id === selectedTableId);

  const pendingTotal = pendingItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff5a5f]"></div>
      </div>
    );
  }

  const zoomFactor = 1 + (zoomLevel - 5) * 0.13;

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* 65% Map Area */}
      <div className="w-[65%] bg-gray-100 flex flex-col h-full relative overflow-hidden">
        <div className="p-4 flex items-center justify-between bg-[#666666] shadow-md z-10">
          <div className="flex space-x-2 items-center">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={`px-6 py-2 rounded font-bold transition-all shadow-sm ${selectedRoomId === room.id
                    ? 'bg-white text-black'
                    : 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {room.name}
              </button>
            ))}
          </div>
          <div className="flex space-x-3 items-center">
            {!isEditMode ? (
              <button onClick={() => setIsEditMode(true)} className="text-white/80 hover:text-white transition">
                <Menu className="w-7 h-7" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleCreateRoom}
                  className="px-4 py-1.5 bg-[#4b5563] hover:bg-[#374151] text-white text-sm font-bold rounded shadow-sm flex items-center space-x-2 border border-white/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Sala</span>
                </button>
                <button onClick={() => setIsEditMode(false)} className="px-4 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white text-sm font-bold rounded shadow-sm flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4" />
                  <span>Salir</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 relative pt-0 px-4 pb-4 md:pt-0 md:px-8 md:pb-8 overflow-auto bg-[#f8f9fa] flex items-start justify-start">
          <div
            ref={mapRef}
            className={`aspect-square relative ${isEditMode ? 'bg-white shadow-sm' : ''}`}
            style={{
              width: `${zoomFactor * 100}%`,
              minWidth: `${zoomFactor * 800}px`,
              backgroundImage: isEditMode ? `
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              ` : 'none',
              backgroundSize: isEditMode ? '12.5% 12.5%' : 'auto', // 8 columns, 8 rows
              backgroundPosition: '0 0'
            }}
            onClick={(e) => {
              if (!isEditMode || !mapRef.current || !selectedRoomId) return;
              if ((e.target as HTMLElement).closest('.table-node')) return;

              const rect = mapRef.current.getBoundingClientRect();
              const xPct = ((e.clientX - rect.left) / rect.width) * 100;
              const yPct = ((e.clientY - rect.top) / rect.height) * 100;

              const gridX = 12.5;
              const gridY = 12.5;
              const snappedX = Math.round((xPct - gridX / 2) / gridX) * gridX + gridX / 2;
              const snappedY = Math.round((yPct - gridY / 2) / gridY) * gridY + gridY / 2;

              // Overlap Prevention: Check if a table already exists at this snapped coordinate in the current room
              const tableAtPos = selectedRoom?.tables.find(t =>
                Math.abs(t.x - snappedX) < 0.1 && Math.abs(t.y - snappedY) < 0.1
              );

              if (tableAtPos) {
                setSelectedTable(tableAtPos.id);
                return;
              }

              // Gap Filling: Find the first available number in the global sequence (1, 2, 3...)
              const allNumbers = rooms.flatMap((room) => room.tables).map(t => t.number).sort((a, b) => a - b);
              let nextNumber = 1;
              for (const num of allNumbers) {
                if (num === nextNumber) {
                  nextNumber++;
                } else if (num > nextNumber) {
                  break;
                }
              }

              createTable(nextNumber, snappedX, snappedY, selectedRoomId);
            }}
            onPointerMove={(e) => {
              if (!isEditMode || !activeDragTable || !mapRef.current) return;
              e.preventDefault();
              const rect = mapRef.current.getBoundingClientRect();
              const xPct = ((e.clientX - rect.left) / rect.width) * 100;
              const yPct = ((e.clientY - rect.top) / rect.height) * 100;

              const gridX = 12.5;
              const gridY = 12.5;
              const snappedX = Math.round((xPct - gridX / 2) / gridX) * gridX + gridX / 2;
              const snappedY = Math.round((yPct - gridY / 2) / gridY) * gridY + gridY / 2;

              setActiveDragTable({ ...activeDragTable, currentX: snappedX, currentY: snappedY });
            }}
            onPointerUp={() => {
              if (!isEditMode || !activeDragTable) return;
              if (activeDragTable.currentX !== activeDragTable.initialX || activeDragTable.currentY !== activeDragTable.initialY) {
                updateTableCoordinates(activeDragTable.id, activeDragTable.currentX, activeDragTable.currentY);
              }
              setActiveDragTable(null);
            }}
            onPointerLeave={() => {
              if (activeDragTable && isEditMode) {
                updateTableCoordinates(activeDragTable.id, activeDragTable.currentX, activeDragTable.currentY);
                setActiveDragTable(null);
              }
            }}
          >

            {selectedRoom?.tables.map((table) => {
              const isSquare = table.shape?.toUpperCase() === 'SQUARE';
              const isSmall = table.size === 'small';
              const baseSizeClass = isSmall ? 'w-[8.5%]' : 'w-[11.2%]';
              const shapeClass = isSquare ? `${baseSizeClass} aspect-square rounded-lg` : `${baseSizeClass} aspect-square rounded-full`;

              const isBeingDragged = activeDragTable?.id === table.id;
              const currentX = isBeingDragged ? activeDragTable.currentX : table.x;
              const currentY = isBeingDragged ? activeDragTable.currentY : table.y;

              let bgClass = table.status === 'OCCUPIED' ? 'bg-[#ff5a5f]' : 'bg-[#5fcc9c]';
              if (isEditMode) {
                bgClass = 'bg-[#a3a3a3] shadow-md border-[2px] border-black/10 hover:border-black/30 hover:shadow-lg focus:outline-none';
              }

              const borderClass = (!isEditMode && selectedTableId === table.id) ? 'ring-[0.3vw] ring-orange-300 shadow-[0_0_2vw_rgba(253,186,116,0.9)] scale-110 z-10' : '';

              return (
                <div
                  key={table.id}
                  onPointerDown={(e) => {
                    if (!isEditMode) return;
                    e.preventDefault();
                    e.stopPropagation();
                    // Initialize drag token
                    setActiveDragTable({ id: table.id, initialX: table.x, initialY: table.y, currentX: table.x, currentY: table.y });
                  }}
                  style={{ left: `${currentX}%`, top: `${currentY}%`, touchAction: isEditMode ? 'none' : 'auto' }}
                  onClick={() => {
                    if (isEditMode) {
                      setSelectedTable(table.id === selectedTableId ? null : table.id);
                    } else {
                      setSelectedTable(table.id);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isEditMode && table.status === 'FREE') openTable(table.id, '');
                  }}
                  className={`absolute group table-node flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-shadow ${isEditMode ? 'cursor-grab active:cursor-grabbing z-50' : 'cursor-pointer'}
                    ${shapeClass}
                    ${bgClass}
                    ${borderClass}
                  `}
                >
                  <div className="flex flex-col items-center text-white font-bold" style={{ fontSize: 'min(1.5vw, 24px)' }}>
                    <span>{table.number}</span>
                  </div>

                  {/* Hover Icons in Edit Mode */}
                  {isEditMode && (
                    <div className="absolute -top-8 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded shadow-md z-50">
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTableShape(table.id, isSquare ? 'circle' : 'square');
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-700"
                        title="Cambiar Forma"
                      >
                        {isSquare ? <Circle className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTableSize(table.id, isSmall ? 'large' : 'small');
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-700"
                        title="Cambiar Tamaño"
                      >
                        {isSmall ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>      {/* 35% Side Panel */}
      <div className="w-[35%] bg-white shadow-xl flex flex-col h-full border-l relative overflow-hidden">
        <div className="flex-1 overflow-y-auto flex flex-col">
          {isEditMode ? (
            <div className="flex flex-col flex-1 bg-gray-50 font-sans">
              {/* Zoom Controls ONLY in Edit Mode */}
              <div className="bg-white border-b border-gray-100 p-4 py-3 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center space-x-2 text-gray-400">
                  <ZoomIn className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#f97316]">Zoom Salon</span>
                </div>
                <div className="flex items-center bg-gray-100 rounded-lg px-2 py-1 space-x-3">
                  <button
                    onClick={() => setZoomLevel(z => Math.max(1, z - 1))}
                    className="text-gray-400 hover:text-orange-500 transition p-1"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold w-4 text-center text-gray-700">{zoomLevel}</span>
                  <button
                    onClick={() => setZoomLevel(z => Math.min(10, z + 1))}
                    className="text-gray-400 hover:text-orange-500 transition p-1"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-[#f97316] text-white p-4 font-bold text-xl flex items-center justify-between shadow-sm z-10 w-full mb-px border-b border-orange-600/20">
                <span className="tracking-wide">{selectedRoom?.name?.toUpperCase() || 'SALA'}</span>
                <div className="flex space-x-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUpdateRoom(); }}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Editar Sala"
                  >
                    <Edit2 className="w-5 h-5 cursor-pointer opacity-90" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteRoom(); }}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Eliminar Sala"
                  >
                    <Trash2 className="w-5 h-5 cursor-pointer opacity-90" />
                  </button>
                </div>
              </div>

              {selectedTable ? (
                <div className="flex flex-col">
                  <div className="bg-[#9ca3af] text-white p-4 font-bold text-xl flex items-center justify-between shadow-sm z-10">
                    <span className="tracking-wide">MESA {selectedTable.number}</span>
                    <div className="flex space-x-4">
                      <Edit2 className="w-5 h-5 cursor-pointer opacity-80 hover:opacity-100" />
                      <Trash2
                        className={`w-5 h-5 cursor-pointer transition shadow-sm ${showDeleteConfirm ? 'text-red-500 scale-125' : 'opacity-80 hover:opacity-100'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(!showDeleteConfirm);
                        }}
                      />
                    </div>
                  </div>

                  {showDeleteConfirm ? (
                    <div className="p-6 bg-red-50 border-b border-red-100 flex flex-col items-center text-center space-y-4">
                      <p className="text-red-800 font-semibold text-sm">¿Estás seguro de eliminar esta mesa? Los pedidos históricos se mantendrán.</p>
                      <div className="flex space-x-3 w-full">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTable(selectedTable.id);
                            setSelectedTable(null);
                            setShowDeleteConfirm(false);
                          }}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-sm shadow-sm transition"
                        >
                          Sí, Eliminar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(false);
                          }}
                          className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-bold text-sm transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 flex flex-col space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 text-sm">Número</span><span className="font-bold text-gray-800">{selectedTable.number}</span></div>
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 text-sm">Sala</span><span className="font-bold text-gray-800">{selectedRoom?.name || 'Salón'}</span></div>
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 text-sm">Forma</span><span className="font-bold text-gray-800">{selectedTable.shape?.toUpperCase() === 'SQUARE' ? 'Cuadrada' : 'Redonda'}</span></div>
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 text-sm">Tamaño</span><span className="font-bold text-gray-800">{selectedTable.size === 'small' ? 'Chica' : 'Grande'}</span></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 px-8 mt-2 p-4 bg-orange-50 border border-orange-100 rounded-md text-orange-800 text-sm mx-8 mt-10 shadow-sm font-sans">
                  <p className="font-semibold mb-1">Guía Rápida:</p>
                  <ul className="list-disc list-inside space-y-1 text-orange-700/80">
                    <li>Haz clic en un cuadro vacío para <b>crear una mesa</b>.</li>
                    <li><b>Arrastra</b> una mesa a una nueva celda para moverla.</li>
                    <li>Pasa el cursor sobre una mesa para ver los íconos de <b>cambio de forma y tamaño</b>.</li>
                    <li>Da <b>clic</b> a una mesa para ver y editar sus detalles desde este panel.</li>
                  </ul>
                </div>
              )}
            </div>
          ) : selectedTable ? (
            <div className="flex flex-col flex-1 bg-white font-sans">
              <div className={`p-3 text-white font-bold text-lg flex items-center justify-between ${selectedTable.status === 'OCCUPIED' ? 'bg-[#ef4444]' : 'bg-[#5fcc9c]'}`}>
                <span>MESA {selectedTable.number}</span>
                <div className="flex space-x-3">
                  <CheckSquare className="h-5 w-5 opacity-90 cursor-pointer hover:opacity-100 transition" />
                  <Edit2
                    className="h-5 w-5 opacity-90 cursor-pointer hover:opacity-100 transition"
                    onClick={() => {
                      setOpeningComment(selectedTable.activeSale?.openingComment || '');
                      setIsEditingOpeningComment(!isEditingOpeningComment);
                    }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Header Info */}
                <div className="px-4 py-3 border-b border-gray-200 text-sm text-gray-800 font-medium bg-white">
                  {selectedTable.status === 'OCCUPIED' ? (
                    isEditingOpeningComment ? (
                      <div className="flex flex-col space-y-2">
                        <input
                          className="w-full text-sm p-2 border border-gray-300 rounded focus:border-red-400 outline-none"
                          value={openingComment}
                          onChange={e => setOpeningComment(e.target.value)}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            openTable(selectedTable.id, openingComment);
                            setIsEditingOpeningComment(false);
                          }}
                          className="self-end px-4 py-1.5 bg-[#ef4444] text-white rounded text-xs font-bold"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <div>{selectedTable.activeSale?.openingComment || 'Sin comentario'}</div>
                    )
                  ) : (
                    <div className="italic text-gray-400">Mesa libre - Pendiente de apertura</div>
                  )}
                </div>

                {selectedTable.status === 'FREE' ? (
                  <div className="p-6 space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Comentario</label>
                      <textarea
                        className="w-full h-24 p-3 border border-gray-300 rounded focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition resize-none"
                        placeholder="Agregue un comentario..."
                        value={openingComment}
                        onChange={(e) => setOpeningComment(e.target.value)}
                      ></textarea>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => {
                          openTable(selectedTable.id, openingComment);
                          setOpeningComment('');
                        }}
                        className="px-6 py-2 bg-[#ffdbcd] hover:bg-[#ffc6ad] text-[#d9531e] font-semibold rounded text-sm transition-colors"
                      >
                        Abrir mesa
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1">
                    {/* ADICIONAR SECTION */}
                    <div className="bg-[#999999] px-4 py-2 flex items-center justify-between text-white font-bold text-sm tracking-wide">
                      <span>ADICIONAR</span>
                    </div>

                    <div className="p-3 bg-gray-100 space-y-3">
                      <div className="relative flex-1">
                        <input
                          className="w-full pl-3 pr-8 py-2 border border-orange-200 rounded shadow-sm focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none text-sm text-gray-700"
                          placeholder="Buscar producto..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (searchResults.length > 0) {
                                addPendingItem(searchResults[0]);
                                setSearchQuery('');
                              } else if (searchQuery.length > 1) {
                                // If Enter is pressed but results haven't loaded, try to add first exact match if possible
                                // But for now, just clearing to avoid confusion
                                setSearchQuery('');
                              }
                            }
                          }}
                          onBlur={() => setTimeout(() => setSearchQuery(''), 200)}
                        />
                        {searching && (
                          <div className="absolute right-2 top-2.5 animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                        )}

                        {/* Search Results Dropdown */}
                        {searchQuery.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-300 rounded shadow-xl z-50 max-h-60 overflow-y-auto">
                            {searchResults.length > 0 ? (
                              searchResults.map((prod, idx) => (
                                <div
                                  key={prod.id}
                                  onClick={() => {
                                    addPendingItem(prod);
                                    setSearchQuery('');
                                  }}
                                  className={`px-4 py-2 text-sm cursor-pointer flex items-center space-x-2 border-b border-gray-100 last:border-0 hover:bg-[#ffdc77]/30 ${idx === 0 ? 'bg-[#ffdc77]/20' : ''}`}
                                >
                                  <span className="text-gray-400">-</span>
                                  <span className="text-gray-800 font-medium">{prod.name}</span>
                                </div>
                              ))
                            ) : !searching && (
                              <div className="px-4 py-3 text-sm text-gray-400 italic">No se encontraron productos</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Products Grid (Favorites only now) */}
                    <div className="px-3 pb-3">
                      <div className="grid grid-cols-4 gap-1.5">
                        {favorites.slice(0, 8).map((prod) => (
                          <button
                            key={prod.id}
                            onClick={() => addPendingItem(prod)}
                            className="h-10 bg-[#e5e7eb] hover:bg-[#d1d5db] border border-gray-300 rounded-sm text-[11px] font-medium leading-tight text-[#4b5563] transition shadow-sm overflow-hidden px-1 whitespace-nowrap overflow-ellipsis"
                          >
                            <span className="truncate block w-full text-center px-0.5">{prod.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* PENDING ITEMS - YELLOW ZONE */}
                    {pendingItems.length > 0 && (
                      <div className="border-b border-gray-200 flex flex-col">
                        <div className="w-full bg-gray-50 border-y border-gray-200">
                          {pendingItems.map((item, idx) => (
                            <div key={idx} className={`bg-[#ffdc77] border-b border-[#f0c850] border-l-[6px] border-l-[#f97316] px-4 flex flex-col justify-center shadow-sm ${item.comment ? 'py-3 min-h-[64px]' : 'py-[7px] min-h-[48px]'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4 w-[60%]">
                                  <div className="flex items-center border border-[#d97706] rounded-md overflow-hidden bg-[#ffdc77] shadow-sm">
                                    <button onClick={() => updatePendingItem(idx, { quantity: Math.max(1, item.quantity - 1) })} className="px-3 py-1.5 hover:bg-[#f6d168] text-gray-800 border-r border-[#d97706] transition active:bg-[#f0c850]"><Minus className="h-4 w-4" /></button>
                                    <span className="font-bold w-10 text-center text-[15px] text-gray-800">{item.quantity}</span>
                                    <button onClick={() => updatePendingItem(idx, { quantity: item.quantity + 1 })} className="px-3 py-1.5 hover:bg-[#f6d168] text-gray-800 border-l border-[#d97706] transition active:bg-[#f0c850]"><Plus className="h-4 w-4" /></button>
                                  </div>
                                  <span className="font-bold text-[13px] leading-[34px] text-gray-900 truncate">{item.name}</span>
                                </div>
                                <div className="flex items-center justify-end space-x-3 w-[40%]">
                                  <span className="text-[14px] font-bold text-gray-800">$</span>
                                  <input
                                    ref={idx === pendingItems.length - 1 ? lastPriceInputRef : undefined}
                                    className={`px-3 py-1.5 rounded-md font-bold text-[15px] w-[90px] text-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] border outline-none transition-colors ${editingPriceIdx === idx ? 'bg-white border-blue-400 text-gray-900 ring-2 ring-blue-100' : 'bg-[#f6d168] border-[#d97706] text-gray-800 hover:bg-[#fbdc80] cursor-pointer'}`}
                                    value={editingPriceIdx === idx ? tempPrice : (item.price * item.quantity).toLocaleString('es-CO')}
                                    onFocus={(e) => {
                                      setEditingPriceIdx(idx);
                                      setTempPrice((item.price * item.quantity).toString());
                                      e.target.select();
                                    }}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      setTempPrice(val);
                                    }}
                                    onBlur={() => {
                                      const newTotal = parseInt(tempPrice, 10);
                                      if (!isNaN(newTotal) && newTotal >= 0) {
                                        updatePendingItem(idx, { price: newTotal / item.quantity });
                                      }
                                      setEditingPriceIdx(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'ArrowRight') {
                                        e.preventDefault();
                                        const newQty = item.quantity + 1;
                                        updatePendingItem(idx, { quantity: newQty });
                                        setTempPrice((item.price * newQty).toString());
                                      } else if (e.key === 'ArrowLeft') {
                                        e.preventDefault();
                                        const newQty = Math.max(1, item.quantity - 1);
                                        updatePendingItem(idx, { quantity: newQty });
                                        setTempPrice((item.price * newQty).toString());
                                      } else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                        confirmOrder(selectedTable.id);
                                      }
                                    }}
                                  />
                                  <MessageSquare
                                    className="h-5.5 w-5.5 text-[#a16207] cursor-pointer hover:text-black transition"
                                    onClick={() => setEditingPendingIdx(editingPendingIdx === idx ? null : idx)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePendingItem(idx)}
                                    className="p-1.5 hover:bg-red-50 rounded-full transition-colors group"
                                    title="Quitar ítem"
                                  >
                                    <X className="h-5 w-5 text-[#a16207] group-hover:text-red-700" />
                                  </button>
                                </div>
                              </div>
                              {/* Inline comment editing */}
                              {editingPendingIdx === idx && (
                                <div className="mt-2 pl-[1px] mb-1 pr-1">
                                  <input
                                    className="w-full bg-white border border-gray-300 text-sm py-1.5 px-2 rounded text-gray-800 outline-none placeholder:text-gray-400 focus:border-orange-400 shadow-sm"
                                    placeholder="Agrega un comentario aquí..."
                                    value={item.comment || ''}
                                    onChange={(e) => updatePendingItem(idx, { comment: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        confirmOrder(selectedTable.id); // This will confirm the order when Enter is pressed in the comment input
                                        setEditingPendingIdx(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                </div>
                              )}
                              {item.comment && editingPendingIdx !== idx && (
                                <div className="mt-1 text-[13px] text-gray-700 ml-1 font-medium bg-[#fde68a] inline-block px-1 rounded self-start">
                                  {item.comment}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="px-4 py-3 bg-white space-y-3 z-10 shadow-sm">
                          <div className="text-sm text-gray-600 font-medium pb-2 border-b border-gray-100">
                            Total a confirmar: <span className="font-bold text-gray-800">${pendingTotal.toLocaleString('es-CO')}</span>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button onClick={() => useTableStore.getState().clearPendingItems()} className="px-6 py-2 border border-gray-300 bg-white rounded font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm text-sm">Cancelar</button>
                            <button onClick={() => confirmOrder(selectedTable.id)} className="px-6 py-2 bg-[#f97316] text-white rounded font-bold hover:bg-[#ea580c] transition shadow-sm text-sm">Confirmar</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto bg-gray-50">
                      {selectedTable.activeSale?.items?.map((item) => (
                        <div key={item.id} className="border-b border-gray-200 flex flex-col bg-white hover:bg-gray-50 transition">
                          <div className={`px-4 flex items-center justify-between border-l-4 border-[#f97316] ${item.comment ? 'py-3' : 'py-[7px]'}`}>
                            <div className="flex flex-col justify-center space-y-1 w-[65%]">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-800 w-4 text-[13px] leading-[34px]">{item.quantity}</span>
                                <span className="font-bold text-gray-800 text-[13px] leading-[34px] truncate">{item.product.name}</span>
                              </div>
                              {item.comment && (
                                <span className="text-[13px] text-gray-500 ml-7">{item.comment}</span>
                              )}
                            </div>
                            <div className="flex items-center justify-end space-x-3 w-[35%] text-right font-sans">
                              <span className="text-[13px] leading-[34px] text-gray-800 font-bold">${(item.price * item.quantity).toLocaleString('es-CO')}</span>
                              <button
                                type="button"
                                onClick={() => setDeleteItemModal({ type: 'confirmed', name: item.product.name, itemId: item.id })}
                                className="p-1 hover:bg-red-50 rounded-full transition-colors group ml-2"
                                title="Eliminar producto"
                              >
                                <X className="h-4 w-4 text-gray-400 group-hover:text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* FOOTER - FIXED AT BOTTOM of occupied sidebar */}
                    <div className="mt-auto border-t border-gray-100 bg-white shadow-[0_-3px_10px_rgba(0,0,0,0.1)]">
                      <div className="px-4 bg-[#555555] text-white flex justify-between items-center h-12">
                        <span className="font-normal text-[16px] leading-[48px] text-white/90">Total:</span>
                        <span className="font-bold text-[19px] leading-[48px] text-white">${(selectedTable.activeSale?.total || 0).toLocaleString('es-CO')}</span>
                      </div>
                      <div className="p-4 bg-white flex justify-between items-center space-x-4">
                        <button className="flex-1 py-1 px-2 border border-gray-200 bg-gray-50 rounded font-normal text-gray-400 text-[12px] leading-normal cursor-not-allowed uppercase tracking-wider">
                          % Aplicar Descuento
                        </button>
                        <button
                          onClick={() => {
                            const items = selectedTable.activeSale?.items ?? [];
                            if (items.length === 0) {
                              // No products — close directly without payment modal
                              checkoutTable(selectedTable.id, 'Efectivo', 0);
                              setSelectedTable(null);
                              return;
                            }
                            setShowCheckout(true);
                            setCheckoutPayment('');
                            setCheckoutPaymentMethod('Efectivo');
                            setTimeout(() => paymentInputRef.current?.focus(), 100);
                          }}
                          className="py-1 px-8 bg-[#333333] text-white rounded font-normal hover:bg-black transition text-[13px] leading-[21px] shadow-md uppercase tracking-wider h-[40px] flex items-center justify-center"
                        >
                          Cerrar mesa {selectedTable.number}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-300 space-y-6 bg-white">
              <div className="h-32 w-32 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-100">
                <div className="h-20 w-2 arrow-right opacity-10"></div>
              </div>
              <p className="text-center font-bold text-lg max-w-[200px] text-gray-400">Selecciona una mesa para ver detalles</p>
            </div>
          )}
        </div>
      </div>

      {/* ROOM MANAGEMENT MODAL */}
      {roomModal.mode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className={`p-6 text-white font-bold text-lg flex items-center space-x-3 ${roomModal.mode === 'delete' ? 'bg-red-500' : 'bg-[#f97316]'}`}>
              {roomModal.mode === 'create' && <Plus className="w-6 h-6" />}
              {roomModal.mode === 'edit' && <Edit2 className="w-5 h-5" />}
              {roomModal.mode === 'delete' && <Trash2 className="w-5 h-5" />}
              <span className="tracking-wide">
                {roomModal.mode === 'create' ? 'Nueva Sala' : roomModal.mode === 'edit' ? 'Editar Sala' : 'Eliminar Sala'}
              </span>
            </div>

            <div className="p-8">
              {roomModal.mode === 'delete' ? (
                <div className="space-y-4">
                  <p className="text-gray-700 text-lg leading-relaxed">
                    ¿Estás seguro de eliminar la sala <span className="font-bold text-red-600">"{roomModal.value}"</span>?
                  </p>
                  <p className="text-gray-500 text-sm italic">
                    Todas las mesas de esta sala serán eliminadas permanentemente.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider">Nombre de la Sala</label>
                  <input
                    autoFocus
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg outline-none focus:border-[#f97316] transition-colors text-lg font-medium"
                    placeholder="Ej: Terraza, Piso 2..."
                    value={roomModal.value}
                    onChange={(e) => setRoomModal({ ...roomModal, value: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && confirmRoomAction()}
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
              <button
                onClick={() => setRoomModal({ mode: null, value: '' })}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-600 rounded-lg font-bold hover:bg-gray-100 transition shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRoomAction}
                className={`px-8 py-2.5 text-white rounded-lg font-bold shadow-md transform active:scale-95 transition ${roomModal.mode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#f97316] hover:bg-[#ea580c]'}`}
              >
                {roomModal.mode === 'delete' ? 'Eliminar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ITEM CONFIRMATION MODAL */}
      {deleteItemModal.type && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-red-500 text-white font-bold text-lg flex items-center space-x-3">
              <Trash2 className="w-5 h-5" />
              <span className="tracking-wide">Eliminar Producto</span>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-gray-700 text-base leading-relaxed">
                ¿Estás seguro de eliminar <span className="font-bold text-red-600">"{deleteItemModal.name}"</span> de la mesa?
              </p>
              <p className="text-gray-500 text-sm italic">Este producto ya fue confirmado y se eliminará de la cuenta.</p>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
              <button
                onClick={() => setDeleteItemModal({ type: null, name: '' })}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-600 rounded-lg font-bold hover:bg-gray-100 transition shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deleteItemModal.itemId && selectedTable) {
                    deleteSaleItem(selectedTable.id, deleteItemModal.itemId);
                  }
                  setDeleteItemModal({ type: null, name: '' });
                }}
                className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transform active:scale-95 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CHECKOUT MODAL */}
      {showCheckout && selectedTable && (() => {
        const activeSale = selectedTable.activeSale;
        const items = activeSale?.items ?? [];
        const subtotal = activeSale?.total ?? 0;
        const checkoutTipEnabled = tableTips[selectedTable.id] ?? true;
        const tipPercent = 10;
        const tipAmount = checkoutTipEnabled ? Math.round(subtotal * tipPercent / 100) : 0;
        const total = subtotal + tipAmount;
        const payment = parseInt(checkoutPayment.replace(/\D/g, ''), 10) || 0;
        const change = payment - total;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowCheckout(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col overflow-hidden animate-in" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-[#333333] text-white px-6 py-4 flex items-center justify-between">
                <span className="font-bold text-lg tracking-wide uppercase">Cerrar Mesa {selectedTable.number}</span>
                <button onClick={() => setShowCheckout(false)} className="hover:bg-white/20 rounded-full p-1 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <div key={item.id} className={`px-6 py-3 flex items-center justify-between ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}`}>
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-500 font-bold text-sm w-6 text-center">{item.quantity}</span>
                        <span className="font-medium text-gray-800 text-[15px]">{item.product.name}</span>
                      </div>
                      <span className="font-bold text-gray-700 text-[15px]">${(item.price * item.quantity).toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>

                {/* Subtotal */}
                <div className="border-t-2 border-gray-200 px-6 py-3 flex justify-between items-center bg-gray-50">
                  <span className="font-semibold text-gray-600 text-[15px]">Subtotal</span>
                  <span className="font-bold text-gray-800 text-[17px]">${subtotal.toLocaleString('es-CO')}</span>
                </div>

                {/* Propina */}
                <div className="border-t border-gray-200 px-6 py-3 flex justify-between items-center bg-white">
                  <div className="flex items-center space-x-2">
                    <span className={`font-semibold text-[15px] ${checkoutTipEnabled ? 'text-green-700' : 'text-gray-400 line-through'}`}>
                      Propina {tipPercent}%
                    </span>
                    {checkoutTipEnabled && (
                      <button
                        onClick={() => setTableTip(selectedTable.id, false)}
                        className="p-1 hover:bg-red-50 rounded-full transition group"
                        title="Quitar propina"
                      >
                        <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                      </button>
                    )}
                    {!checkoutTipEnabled && (
                      <button
                        onClick={() => setTableTip(selectedTable.id, true)}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium transition"
                      >
                        Restaurar
                      </button>
                    )}
                  </div>
                  <span className={`font-bold text-[17px] ${checkoutTipEnabled ? 'text-green-700' : 'text-gray-400'}`}>
                    ${tipAmount.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="bg-[#444444] text-white px-6 py-4 flex justify-between items-center">
                <span className="font-bold text-lg">TOTAL</span>
                <span className="font-black text-2xl">${total.toLocaleString('es-CO')}</span>
              </div>

              {/* Payment Section */}
              <div className="px-6 py-4 bg-white border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700 text-[15px]">Pago del cliente</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500 font-bold">$</span>
                    <input
                      ref={paymentInputRef}
                      type="text"
                      value={checkoutPayment}
                      onChange={(e) => setCheckoutPayment(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && payment >= total) {
                          checkoutTable(selectedTable.id, checkoutPaymentMethod, subtotal);
                          setShowCheckout(false);
                        }
                      }}
                      placeholder={total.toLocaleString('es-CO')}
                      className="w-[140px] px-3 py-2 border-2 border-gray-300 rounded-lg text-right font-bold text-lg focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition"
                    />
                  </div>
                </div>

                {/* Change */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${payment > 0 && change >= 0
                    ? 'bg-green-50 border border-green-200'
                    : payment > 0 && change < 0
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                  <span className={`font-semibold text-[15px] ${payment > 0 && change >= 0 ? 'text-green-700' : payment > 0 && change < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                    {payment > 0 && change < 0 ? 'Falta' : 'Vuelto'}
                  </span>
                  <span className={`font-black text-xl ${payment > 0 && change >= 0 ? 'text-green-700' : payment > 0 && change < 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                    ${Math.abs(payment > 0 ? change : 0).toLocaleString('es-CO')}
                  </span>
                </div>

                {/* Payment Method */}
                <div className="pt-2 border-t border-gray-100 mt-2">
                  <span className="font-semibold text-gray-700 text-[14px] mb-2 block">Método de pago</span>
                  <div className="flex gap-3">
                    {['Efectivo', 'QR', 'Bold'].map(method => (
                      <button
                        key={method}
                        onClick={() => setCheckoutPaymentMethod(method)}
                        className={`flex-1 py-2.5 rounded-full text-sm font-bold border-2 transition ${checkoutPaymentMethod === method
                            ? 'bg-orange-50 border-orange-500 text-orange-600'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300 cursor-pointer'
                          }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-600 rounded-lg font-bold hover:bg-gray-100 transition shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    checkoutTable(selectedTable.id, checkoutPaymentMethod, subtotal);
                    setShowCheckout(false);
                  }}
                  className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold shadow-md transform active:scale-95 transition uppercase tracking-wide"
                >
                  Cerrar Mesa {selectedTable.number}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TableMap;
