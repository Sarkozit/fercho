import React, { useEffect, useState } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import { Trash2, Plus, Wallet, Calendar, X } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Gasto',
  'Arriendo',
  'Publicidad',
  'Seguros',
  'Inversiones',
  'Reparaciones',
  'Nómina Bar',
  'Nómina Cocina',
  'Nómina Cabalgatas',
  'Inventario Bar',
  'Inventario Cocina',
  'Inventario Tienda',
  'Servicios Públicos'
];

const getLocalYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const quickFilters = [
  { label: 'Hoy', getValue: () => { const d = new Date(); return { start: getLocalYMD(d), end: getLocalYMD(d) }; } },
  { label: 'Ayer', getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = getLocalYMD(d); return { start: s, end: s }; } },
  { label: 'Última semana', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 7); return { start: getLocalYMD(start), end: getLocalYMD(end) }; } },
  { label: 'Último mes', getValue: () => { const end = new Date(); const start = new Date(); start.setMonth(start.getMonth() - 1); return { start: getLocalYMD(start), end: getLocalYMD(end) }; } },
  { label: 'Este año', getValue: () => { const d = new Date(); return { start: `${d.getFullYear()}-01-01`, end: getLocalYMD(d) }; } },
  { label: 'El año pasado', getValue: () => { const y = new Date().getFullYear() - 1; return { start: `${y}-01-01`, end: `${y}-12-31` }; } }
];

const Expenses: React.FC = () => {
  const { expenses, dailyBalance, loading, fetchExpenses, fetchDailyBalance, createExpense, deleteExpense } = useExpenseStore();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchExpenses();
    fetchDailyBalance();
  }, [fetchExpenses, fetchDailyBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !category) return;

    setSubmitting(true);
    try {
      await createExpense(description, parseFloat(amount), category);
      setDescription('');
      setAmount('');
      setCategory(EXPENSE_CATEGORIES[0]);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const applyFilter = () => {
    fetchExpenses(dateRange.start, dateRange.end);
  };

  const clearFilter = () => {
    setDateRange({ start: '', end: '' });
    fetchExpenses();
  };

  const filteredTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="flex-1 flex bg-gray-50 overflow-hidden h-full">
      {/* LEFT PANEL: Expenses List */}
      <div className="flex-1 flex flex-col h-full bg-white relative max-w-[70%]">
        {/* Header */}
        <div className="h-20 border-b border-gray-100 flex items-center justify-between px-8 bg-white z-10">
          <div className="flex items-center space-x-4">
            <div className="bg-red-50 text-red-500 p-2.5 rounded-xl">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-black text-gray-800 tracking-tight">
                {dateRange.start || dateRange.end ? 'Historial de Gastos' : 'Gastos del Día'}
                {expenses.length > 0 && (
                  <span className="text-base font-bold bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100">
                    Total: ${filteredTotal.toLocaleString('es-CO')}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-400 font-medium mt-1">Gestiona y consulta los egresos de la jornada</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg p-1 text-sm transition-all focus-within:ring-2 focus-within:ring-red-500 focus-within:bg-white">
              <Calendar className="h-4 w-4 text-gray-400 ml-2" />
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent border-none text-gray-600 outline-none focus:ring-0 text-sm w-[120px]" 
              />
              <span className="text-gray-300 font-bold">-</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent border-none text-gray-600 outline-none focus:ring-0 text-sm w-[120px]" 
              />
            </div>
            <button 
              onClick={applyFilter} 
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition active:scale-95"
            >
              Filtrar
            </button>
            {(dateRange.start || dateRange.end) && (
              <button 
                onClick={clearFilter} 
                className="p-2 text-red-500 hover:bg-red-50 font-semibold rounded-lg transition active:scale-95" 
                title="Limpiar filtro"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filters Sub-header */}
        <div className="bg-[#f8f9fc] border-b border-gray-100 flex items-center px-8 py-3.5 gap-3 overflow-x-auto hidden-scrollbar">
          {quickFilters.map((qf) => {
            return (
              <button
                key={qf.label}
                onClick={() => {
                  const dates = qf.getValue();
                  setDateRange(dates);
                  fetchExpenses(dates.start, dates.end);
                }}
                className="whitespace-nowrap rounded-full border border-[#e4e7f3] bg-white px-5 py-1.5 text-[14px] font-medium text-[#8590c8] hover:bg-[#eff1f8] hover:text-[#6a7bc0] transition-colors"
              >
                {qf.label}
              </button>
            );
          })}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
            </div>
          ) : expenses.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-10 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200">
              <div className="bg-white p-4 justify-center items-center rounded-full mb-4 shadow-sm h-16 w-16 text-gray-300">
                <Wallet className="h-8 w-8" />
              </div>
              <p className="text-gray-500 font-medium text-lg mb-2">
                {dateRange.start || dateRange.end ? 'No se encontraron gastos en estas fechas.' : 'No hay gastos registrados hoy.'}
              </p>
              <p className="text-gray-400 text-sm">Registra un nuevo gasto en el panel derecho.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="bg-white border hover:border-red-200 border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group flex items-center justify-between relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-lg">{expense.description}</span>
                    <span className="text-xs text-gray-400 font-medium tracking-wide">
                      <span className="inline-block bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold mr-2">
                        {expense.category}
                      </span>
                      {new Date(expense.date).toLocaleDateString()} {new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {expense.user?.name && ` • Registrado por: ${expense.user.name}`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-6">
                    <span className="font-black text-red-600 text-xl tracking-tight">
                      -${expense.amount.toLocaleString('es-CO')}
                    </span>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Eliminar gasto"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Balance & Add Expense */}
      <div className="w-[30%] min-w-[320px] bg-white border-l border-gray-100 flex flex-col h-full shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-20">

        {/* Daily Summary Card */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Resumen del Día</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Ventas brutas</span>
              <span className="font-semibold text-gray-700">${dailyBalance.totalSales.toLocaleString('es-CO')}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Gastos</span>
              <span className="font-semibold text-red-500">-${dailyBalance.totalExpenses.toLocaleString('es-CO')}</span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-gray-600 font-bold">Balance Neto</span>
              <span className={`font-black text-xl tracking-tight ${dailyBalance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${dailyBalance.balance.toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>

        {/* Add Expense Form */}
        <div className="p-6 flex-1 overflow-y-auto">
          <h2 className="text-sm font-bold text-gray-800 mb-6 flex items-center">
            <Plus className="h-4 w-4 mr-2 text-red-500" />
            Registrar Nuevo Gasto
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Concepto</label>
              <input
                type="text"
                placeholder="Ej. Insumos cocina, Limpieza..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-medium appearance-none"
                required
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monto</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-bold"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !description || !amount || !category}
              className="w-full py-3.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-xl font-bold shadow-md shadow-red-500/20 transform active:scale-[0.98] transition-all flex items-center justify-center space-x-2 mt-4"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  <span>Guardar Gasto</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
