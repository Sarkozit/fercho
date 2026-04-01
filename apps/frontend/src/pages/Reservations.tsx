import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw,
  Phone,
  Clock,
  Users,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
  Beef,
  Wine,
  Bus,
  MessageSquare,
  X,
  Flame,
  CircleDot,
  Printer,
} from 'lucide-react';
import { useReservationStore, type Reservation } from '../store/reservationStore';

// ── Constants ──
const AUTO_REFRESH_MS = 3 * 60 * 1000; // 3 minutes

const STATUS_CONFIG = {
  PENDIENTE: {
    label: 'Pendiente',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
    cardBorder: 'border-l-amber-400',
  },
  LLEGO: {
    label: 'Llegó',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    cardBorder: 'border-l-emerald-500',
  },
  EN_RUTA: {
    label: 'En Ruta',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    cardBorder: 'border-l-blue-500',
  },
};

// ── Helper: Parse time string "HH:MM" to today's Date ──
function parseTimeToday(timeStr: string): Date | null {
  if (!timeStr) return null;
  // Handle "HH:MM" format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const d = new Date();
    d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
    return d;
  }
  // Handle "HH:MM AM/PM" format
  const matchAmPm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (matchAmPm) {
    let hours = parseInt(matchAmPm[1]);
    const minutes = parseInt(matchAmPm[2]);
    const ampm = matchAmPm[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  return null;
}

// ── Helper: Format currency ──
function formatMoney(value: number): string {
  return '$' + value.toLocaleString('es-CO');
}

// ── Helper: Check if reservation is today ──
function isToday(fechaStr: string): boolean {
  if (!fechaStr) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return fechaStr === todayStr;
}

// ── Helper: Should this reservation be visible? ──
// Hide if departure was > 2 hours ago
function isVisible(r: Reservation): boolean {
  if (!isToday(r.fecha)) return false;
  const departure = parseTimeToday(r.horaSalida);
  if (!departure) return true;
  const now = new Date();
  const twoHoursAfter = new Date(departure.getTime() + 2 * 60 * 60 * 1000);
  return now <= twoHoursAfter;
}

// ── Helper: Calculate BBQ time ──
function calculateBbqTime(horaSalida: string, horasCabalgata: number): Date | null {
  const departure = parseTimeToday(horaSalida);
  if (!departure || !horasCabalgata) return null;
  return new Date(departure.getTime() + horasCabalgata * 60 * 60 * 1000);
}

function formatTimeDisplay(date: Date): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

// ── Helper: Convert "HH:MM" (24h) to "h:mm AM/PM" ──
function formatTime12h(timeStr: string): string {
  if (!timeStr) return '--:--';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${minutes} ${ampm}`;
}

// ═══════════════════════════════════════════════════
// Meat Note Modal
// ═══════════════════════════════════════════════════
const MeatNoteModal: React.FC<{
  reservation: Reservation;
  onClose: () => void;
  onSave: (note: string) => void;
}> = ({ reservation, onClose, onSave }) => {
  const [note, setNote] = useState(reservation.localNote.meatNote || '');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[95vw] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Beef className="w-6 h-6 text-white" />
            <div>
              <h3 className="text-white font-black text-lg">Nota de Carne</h3>
              <p className="text-white/80 text-sm">{reservation.nombre} — {reservation.asados} asado(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Escribe el tipo de carne que eligió cada persona. Ej: "2 Res, 1 Cerdo, 1 Pollo"
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ej: 3 Res, 1 Cerdo, 1 Pollo"
            className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-none h-28 font-medium"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-500 font-semibold rounded-lg hover:bg-gray-100 transition text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(note)}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition text-sm shadow-md active:scale-95"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// Póliza Detail Modal
// ═══════════════════════════════════════════════════
const PolizaModal: React.FC<{
  reservation: Reservation;
  onClose: () => void;
}> = ({ reservation, onClose }) => {
  const { polizas } = reservation;
  const allSent = polizas.enviadas >= polizas.requeridas;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-w-[95vw] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`p-5 flex items-center justify-between ${allSent ? 'bg-emerald-500' : 'bg-red-500'}`}>
          <div className="flex items-center gap-3">
            {allSent ? <ShieldCheck className="w-6 h-6 text-white" /> : <ShieldAlert className="w-6 h-6 text-white" />}
            <div>
              <h3 className="text-white font-black text-lg">Póliza de Seguro</h3>
              <p className="text-white/80 text-sm">
                {reservation.nombre} — {polizas.enviadas}/{polizas.requeridas} enviadas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
          {polizas.detalles.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="font-semibold">No se han recibido pólizas</p>
              <p className="text-sm mt-1">Los participantes aún no han enviado sus datos</p>
            </div>
          ) : (
            polizas.detalles.map((p, idx) => {
              const isActivada = (p.estado || '').trim().toLowerCase() === 'activada';
              return (
                <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border ${
                  isActivada
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-red-50 border-red-100'
                }`}>
                  <div className={`rounded-full p-2 ${
                    isActivada
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-red-100 text-red-500'
                  }`}>
                    {isActivada
                      ? <ShieldCheck className="w-4 h-4" />
                      : <ShieldAlert className="w-4 h-4" />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-sm">{p.nombre} {p.apellido}</p>
                    <p className="text-gray-400 text-xs">CC: {p.identificacion}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    isActivada
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {isActivada ? '✅ Activada' : '❌ ' + (p.estado || 'Sin activar')}
                  </span>
                </div>
              );
            })
          )}
          {polizas.enviadas < polizas.requeridas && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-3">
              <p className="text-red-600 font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Faltan {polizas.requeridas - polizas.enviadas} persona(s) por enviar sus datos
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// Reservation Card
// ═══════════════════════════════════════════════════
const ReservationCard: React.FC<{
  reservation: Reservation;
  onUpdateStatus: (id: string, status: 'PENDIENTE' | 'LLEGO' | 'EN_RUTA') => void;
  onTogglePaid: (id: string, paid: boolean) => void;
  onEditMeatNote: (reservation: Reservation) => void;
  onViewPoliza: (reservation: Reservation) => void;
}> = ({ reservation, onUpdateStatus, onTogglePaid, onEditMeatNote, onViewPoliza }) => {
  const [expanded, setExpanded] = useState(false);
  const r = reservation;
  const status = r.localNote.status;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDIENTE;
  const hasPendingPayment = r.saldoPendiente > 0 && !r.localNote.paidBalance;
  const polizasOk = r.polizas.enviadas >= r.polizas.requeridas;

  const hasExtras = r.asados > 0 || r.mediasLicor > 0 || (r.ponchoSombrero && r.ponchoSombrero !== '0' && r.ponchoSombrero !== '') || (r.transporte && r.transporte !== '0' && r.transporte !== '');

  return (
    <div className={`bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 border-l-[5px] ${config.cardBorder} overflow-hidden transition-all hover:shadow-xl`}>
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xl font-black text-gray-800">{formatTime12h(r.horaSalida)}</span>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${config.color} flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
              {config.label}
            </span>
          </div>
          {hasPendingPayment && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Debe {formatMoney(r.saldoPendiente)}
            </span>
          )}
          {r.localNote.paidBalance && r.saldoPendiente > 0 && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Saldo pagado
            </span>
          )}
        </div>

        {/* Name & Phone */}
        <h3 className="font-black text-gray-800 text-lg mb-1 tracking-tight">{r.nombre || 'Sin nombre'}</h3>
        {r.telefono && (
          <a href={`tel:${r.telefono}`} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-500 transition font-medium mb-3">
            <Phone className="w-3.5 h-3.5" />
            {r.telefono}
          </a>
        )}

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg">
            <Users className="w-3.5 h-3.5" />
            {r.caballos} caballo{r.caballos !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            {r.horasCabalgata}h ruta
          </span>
          {hasExtras && (
            <>
              {r.asados > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold bg-orange-50 text-orange-600 px-2.5 py-1.5 rounded-lg">
                  🍖 {r.asados} asado{r.asados !== 1 ? 's' : ''}
                </span>
              )}
              {r.mediasLicor > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold bg-purple-50 text-purple-600 px-2.5 py-1.5 rounded-lg">
                  <Wine className="w-3.5 h-3.5" />
                  {r.mediasLicor} media{r.mediasLicor !== 1 ? 's' : ''}
                </span>
              )}
              {r.ponchoSombrero && r.ponchoSombrero !== '0' && r.ponchoSombrero !== '' && (
                <span className="text-xs font-bold bg-yellow-50 text-yellow-700 px-2.5 py-1.5 rounded-lg">🤠 Poncho</span>
              )}
              {r.transporte && r.transporte !== '0' && r.transporte !== '' && (
                <span className="flex items-center gap-1 text-xs font-bold bg-sky-50 text-sky-600 px-2.5 py-1.5 rounded-lg">
                  <Bus className="w-3.5 h-3.5" />
                  Transporte
                </span>
              )}
            </>
          )}
        </div>

        {/* Asignación (proveedores) */}
        {r.asignacion && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
            <span className="font-bold text-gray-600">📦 Asignación:</span>
            <span className="font-medium">{r.asignacion}</span>
          </div>
        )}

        {/* Póliza indicator */}
        <button
          onClick={() => onViewPoliza(r)}
          className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border transition w-full justify-center ${
            polizasOk
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
              : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 animate-pulse'
          }`}
        >
          {polizasOk ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          Póliza: {r.polizas.enviadas}/{r.polizas.requeridas}
          {!polizasOk && <span className="ml-1">⚠️ Faltan {r.polizas.requeridas - r.polizas.enviadas}</span>}
        </button>
      </div>

      {/* Expandable Details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-400 hover:bg-gray-100 transition"
      >
        <span className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5" />
          Total: {formatMoney(r.total)} {r.adelanto > 0 && `· Adelanto: ${formatMoney(r.adelanto)}`}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 space-y-3">
          {/* Financial details */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</p>
              <p className="text-sm font-black text-gray-800">{formatMoney(r.total)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Adelanto</p>
              <p className="text-sm font-black text-emerald-600">{formatMoney(r.adelanto)}</p>
            </div>
            <div className={`rounded-lg p-3 border ${hasPendingPayment ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saldo</p>
              <p className={`text-sm font-black ${hasPendingPayment ? 'text-red-600' : 'text-gray-800'}`}>
                {formatMoney(r.saldoPendiente)}
              </p>
            </div>
          </div>

          {/* Meat note */}
          {r.asados > 0 && (
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Beef className="w-3 h-3" /> Nota de carne
                </p>
                <button
                  onClick={() => onEditMeatNote(r)}
                  className="text-[10px] font-bold text-orange-500 hover:text-orange-600 transition"
                >
                  ✏️ Editar
                </button>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {r.localNote.meatNote || <span className="text-gray-300 italic">Sin asignar — clic en Editar</span>}
              </p>
            </div>
          )}

          {/* Reservation ID */}
          <p className="text-[10px] text-gray-300 text-center font-mono">ID: {r.id}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
        {status === 'PENDIENTE' && (
          <button
            onClick={() => onUpdateStatus(r.id, 'LLEGO')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition active:scale-95 shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Llegó
          </button>
        )}
        {status === 'LLEGO' && (
          <>
            <button
              onClick={() => onUpdateStatus(r.id, 'EN_RUTA')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-lg transition active:scale-95 shadow-sm"
            >
              <CircleDot className="w-3.5 h-3.5" />
              En Ruta
            </button>
            <button
              onClick={() => onUpdateStatus(r.id, 'PENDIENTE')}
              className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-xs rounded-lg transition active:scale-95"
            >
              ↩ Deshacer
            </button>
          </>
        )}
        {status === 'EN_RUTA' && (
          <button
            onClick={() => onUpdateStatus(r.id, 'LLEGO')}
            className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-xs rounded-lg transition active:scale-95"
          >
            ↩ Deshacer
          </button>
        )}
        {hasPendingPayment && (
          <button
            onClick={() => onTogglePaid(r.id, true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-xs rounded-lg transition active:scale-95 shadow-sm"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Pagó saldo
          </button>
        )}
        {r.localNote.paidBalance && r.saldoPendiente > 0 && (
          <button
            onClick={() => onTogglePaid(r.id, false)}
            className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-xs rounded-lg transition active:scale-95"
          >
            ↩ Deshacer pago
          </button>
        )}
        {r.asados > 0 && (
          <button
            onClick={() => onEditMeatNote(r)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold text-xs rounded-lg transition active:scale-95"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Nota 🥩
          </button>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// BBQ Card (Próximos Asados)
// ═══════════════════════════════════════════════════
const BbqCard: React.FC<{
  reservation: Reservation;
  bbqTime: Date;
  onEditMeatNote: (r: Reservation) => void;
  onUpdateBbqTime: (id: string, time: string) => void;
}> = ({ reservation, bbqTime, onEditMeatNote, onUpdateBbqTime }) => {
  const r = reservation;
  const now = new Date();
  
  // Use override time if available
  const effectiveBbqTime = r.localNote.bbqTimeOverride 
    ? (() => {
        const d = new Date();
        const [h, m] = r.localNote.bbqTimeOverride.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        return d;
      })()
    : bbqTime;

  const isPast = now > effectiveBbqTime;
  const minutesUntil = Math.round((effectiveBbqTime.getTime() - now.getTime()) / 60000);
  const [editingTime, setEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState(
    `${effectiveBbqTime.getHours().toString().padStart(2, '0')}:${effectiveBbqTime.getMinutes().toString().padStart(2, '0')}`
  );
  const hasMeatNote = !!r.localNote.meatNote;

  const handlePrintBbqComanda = () => {
    if (!hasMeatNote) return;
    
    const { printAgent } = require('../services/printAgent');
    if (printAgent.getStatus() !== 'connected') {
      alert('Impresora no conectada');
      return;
    }

    const arrivalTime = formatTimeDisplay(effectiveBbqTime);
    
    // Send as comanda with structured format:
    // Normal text intro + large text for time and order
    printAgent.printComanda('Cocina', {
      tableNumber: 'Pedido Asado',
      items: [
        { 
          qty: 0, 
          name: 'INTRO_ASADO',
          comment: `Se ha realizado un pedido de asados para cabalgata.\n\nDatos del pedido:`
        },
        {
          qty: 0,
          name: arrivalTime
        },
        {
          qty: 0,
          name: r.localNote.meatNote
        },
      ],
    });
  };

  return (
    <div className={`bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden transition-all hover:shadow-lg ${
      isPast ? 'border-l-[5px] border-l-orange-500' : 'border-l-[5px] border-l-amber-400'
    }`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isPast ? 'bg-orange-100' : 'bg-amber-50'}`}>
              <Flame className={`w-5 h-5 ${isPast ? 'text-orange-600' : 'text-amber-500'}`} />
            </div>
            <div>
              {editingTime ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={timeInput}
                    onChange={e => setTimeInput(e.target.value)}
                    className="text-lg font-black text-gray-800 border border-blue-300 rounded px-2 py-0.5 w-28 focus:ring-2 focus:ring-blue-400 outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      onUpdateBbqTime(r.id, timeInput);
                      setEditingTime(false);
                    }}
                    className="text-xs font-bold bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setEditingTime(false)}
                    className="text-xs font-bold text-gray-400 hover:text-gray-600 transition"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <p 
                  className="text-lg font-black text-gray-800 cursor-pointer hover:text-blue-600 transition"
                  onClick={() => setEditingTime(true)}
                  title="Clic para editar hora"
                >
                  {formatTimeDisplay(effectiveBbqTime)}
                  {r.localNote.bbqTimeOverride && <span className="text-[10px] text-blue-500 ml-1">✏️</span>}
                </p>
              )}
              <p className="text-xs font-semibold text-gray-400">
                {isPast ? '⏰ Ya deberían haber llegado' : `En ~${minutesUntil} min`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Print BBQ Comanda Icon */}
            <button
              onClick={handlePrintBbqComanda}
              disabled={!hasMeatNote}
              className={`p-2 rounded-lg border transition ${
                hasMeatNote
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 cursor-pointer'
                  : 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
              }`}
              title={hasMeatNote ? 'Imprimir comanda de asado' : 'Asigna el tipo de carne primero'}
            >
              <Printer className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold bg-orange-50 text-orange-600 px-2.5 py-1.5 rounded-lg">
              🍖 {r.asados} asado{r.asados !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <h4 className="font-bold text-gray-700 mb-2">{r.nombre}</h4>
        <p className="text-xs text-gray-400 mb-3">
          Salida: {formatTime12h(r.horaSalida)} · Ruta: {r.horasCabalgata}h · {r.caballos} caballo(s)
        </p>

        {/* Meat note */}
        <div className={`rounded-xl p-3 border ${r.localNote.meatNote ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Beef className={`w-4 h-4 ${r.localNote.meatNote ? 'text-emerald-600' : 'text-amber-500'}`} />
              <span className={`text-sm font-bold ${r.localNote.meatNote ? 'text-emerald-700' : 'text-amber-600'}`}>
                {r.localNote.meatNote || 'Sin tipo de carne asignado'}
              </span>
            </div>
            <button
              onClick={() => onEditMeatNote(r)}
              className="text-xs font-bold text-gray-400 hover:text-orange-500 transition px-2 py-1 rounded hover:bg-orange-50"
            >
              ✏️
            </button>
          </div>
        </div>

        {/* Licor info */}
        {r.mediasLicor > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-purple-600 font-bold">
            <Wine className="w-3.5 h-3.5" />
            {r.mediasLicor} media{r.mediasLicor !== 1 ? 's' : ''} de licor
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
const Reservations: React.FC = () => {
  const {
    reservations,
    loading,
    lastUpdated,
    error,
    fetchReservations,
    forceRefresh,
    updateStatus,
    togglePaid,
    updateNote,
  } = useReservationStore();

  const [meatModalReservation, setMeatModalReservation] = useState<Reservation | null>(null);
  const [polizaModalReservation, setPolizaModalReservation] = useState<Reservation | null>(null);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Auto-refresh every 3 minutes while on this page
  useEffect(() => {
    refreshInterval.current = setInterval(() => {
      fetchReservations();
    }, AUTO_REFRESH_MS);

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [fetchReservations]);

  const handleSaveMeatNote = useCallback(async (note: string) => {
    if (meatModalReservation) {
      await updateNote(meatModalReservation.id, note);
      setMeatModalReservation(null);
    }
  }, [meatModalReservation, updateNote]);

  // Filter: only today's visible reservations
  const todayReservations = reservations
    .filter(isVisible)
    .sort((a, b) => {
      const tA = parseTimeToday(a.horaSalida);
      const tB = parseTimeToday(b.horaSalida);
      if (!tA || !tB) return 0;
      return tA.getTime() - tB.getTime();
    });

  // BBQ section: reservations with asados, sorted by estimated BBQ time
  const bbqReservations = reservations
    .filter(r => isToday(r.fecha) && r.asados > 0)
    .map(r => ({
      reservation: r,
      bbqTime: calculateBbqTime(r.horaSalida, r.horasCabalgata),
    }))
    .filter(item => {
      if (!item.bbqTime) return false;
      // Hide BBQ card 1 hour after estimated BBQ time
      const now = new Date();
      const oneHourAfterBbq = new Date(item.bbqTime.getTime() + 60 * 60 * 1000);
      return now <= oneHourAfterBbq;
    })
    .sort((a, b) => a.bbqTime!.getTime() - b.bbqTime!.getTime());

  // Summary counts
  const pendingCount = todayReservations.filter(r => r.localNote.status === 'PENDIENTE').length;
  const arrivedCount = todayReservations.filter(r => r.localNote.status === 'LLEGO').length;
  const enRouteCount = todayReservations.filter(r => r.localNote.status === 'EN_RUTA').length;
  const totalHorses = todayReservations.reduce((sum, r) => sum + (r.caballos || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-[#F3F4F6] overflow-y-auto h-full">

      {/* ── HEADER ── */}
      <div className="p-8 pb-0">
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
              <span className="text-2xl">🐴</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-800 tracking-tight">
                Reservas de Cabalgatas
              </h1>
              <p className="text-sm text-gray-400 font-medium mt-1">
                Próximas salidas del día · {todayReservations.length} reserva{todayReservations.length !== 1 ? 's' : ''} activa{todayReservations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[11px] text-gray-400 font-medium">
                Última sync: {new Date(lastUpdated).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={forceRefresh}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg text-sm shadow-md transition active:scale-95 ${loading ? 'opacity-70' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl mb-6 text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pendientes</p>
            <p className="text-2xl font-black text-amber-500">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Llegaron</p>
            <p className="text-2xl font-black text-emerald-500">{arrivedCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">En Ruta</p>
            <p className="text-2xl font-black text-blue-500">{enRouteCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Caballos Hoy</p>
            <p className="text-2xl font-black text-gray-700">{totalHorses}</p>
          </div>
        </div>
      </div>

      {/* ── RESERVATIONS GRID ── */}
      <div className="px-8 pb-4">
        {todayReservations.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-100 shadow-sm">
            <span className="text-6xl mb-4 block">🐴</span>
            <h3 className="text-xl font-black text-gray-400 mb-2">No hay reservas para hoy</h3>
            <p className="text-gray-400 text-sm">Las reservas del día aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {todayReservations.map(r => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onUpdateStatus={updateStatus}
                onTogglePaid={togglePaid}
                onEditMeatNote={setMeatModalReservation}
                onViewPoliza={setPolizaModalReservation}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── PRÓXIMOS ASADOS ── */}
      {bbqReservations.length > 0 && (
        <div className="px-8 pb-8">
          <div className="flex items-center gap-3 mb-5 mt-4">
            <div className="h-px bg-gray-200 flex-1"></div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2.5 rounded-full shadow-md">
              <Flame className="w-5 h-5" />
              <span className="text-sm font-black uppercase tracking-wider">Próximos Asados</span>
            </div>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {bbqReservations.map(({ reservation, bbqTime }) => (
              <BbqCard
                key={`bbq-${reservation.id}`}
                reservation={reservation}
                bbqTime={bbqTime!}
                onEditMeatNote={setMeatModalReservation}
                onUpdateBbqTime={(id, time) => updateNote(id, undefined, undefined, time)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Loading overlay ── */}
      {loading && reservations.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-400 font-medium">Cargando reservas desde Google Sheets...</p>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {meatModalReservation && (
        <MeatNoteModal
          reservation={meatModalReservation}
          onClose={() => setMeatModalReservation(null)}
          onSave={handleSaveMeatNote}
        />
      )}
      {polizaModalReservation && (
        <PolizaModal
          reservation={polizaModalReservation}
          onClose={() => setPolizaModalReservation(null)}
        />
      )}
    </div>
  );
};

export default Reservations;
