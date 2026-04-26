import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface CountItem {
  id: string;
  type: 'product' | 'inventory_item';
  name: string;
  category: string;
  unit: string;
  lastCount: number | null;
  lastCountDate: string | null;
}

interface Section {
  key: string;
  label: string;
  icon: string;
  description: string;
  items: CountItem[];
}

type Step = 'section' | 'count' | 'success';

const InventoryCountForm: React.FC = () => {
  const [step, setStep] = useState<Step>('section');
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ saved: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/public/count-form`);
      setSections(res.data.sections);
    } catch (err) {
      setError('No se pudo cargar el formulario. Intenta de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSection = (section: Section) => {
    setSelectedSection(section);
    // Pre-fill with last count values
    const pre: Record<string, string> = {};
    section.items.forEach(item => {
      if (item.lastCount !== null) {
        pre[item.id] = String(item.lastCount);
      }
    });
    setCounts(pre);
    setStep('count');
    setTimeout(() => contentRef.current?.scrollTo(0, 0), 50);
  };

  const handleSubmit = async () => {
    if (!selectedSection) return;
    setSubmitting(true);
    setError('');

    const entries = selectedSection.items
      .filter(item => counts[item.id] !== undefined && counts[item.id] !== '')
      .map(item => ({
        id: item.id,
        type: item.type,
        stock: parseInt(counts[item.id]) || 0,
      }));

    if (entries.length === 0) {
      setError('Debes llenar al menos un producto.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await axios.post(`${API}/public/count-form`, { counts: entries });
      setResult(res.data);
      setStep('success');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('section');
    setSelectedSection(null);
    setCounts({});
    setResult(null);
    setError('');
  };

  // Count filled items
  const filledCount = selectedSection
    ? selectedSection.items.filter(i => counts[i.id] !== undefined && counts[i.id] !== '').length
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-orange-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm font-medium">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/30 backdrop-blur-lg border-b border-white/10 px-4 flex items-center justify-between"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: '12px' }}
      >
        <div className="flex items-center gap-3">
          {step === 'count' && (
            <button
              onClick={() => setStep('section')}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/80 active:bg-white/20 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-white font-black text-lg leading-tight tracking-tight">
              {step === 'section' && 'Conteo de Inventario'}
              {step === 'count' && `${selectedSection?.icon} ${selectedSection?.label}`}
              {step === 'success' && '✅ ¡Listo!'}
            </h1>
            {step === 'count' && (
              <p className="text-white/40 text-xs font-medium mt-0.5">{filledCount} de {selectedSection?.items.length} productos</p>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto" ref={contentRef}>
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* ===== STEP 1: SELECT SECTION ===== */}
        {step === 'section' && (
          <div className="p-4 space-y-3">
            <div className="text-center mb-4 mt-4">
              <div className="text-5xl mb-3">🐴</div>
              <h2 className="text-white font-black text-xl">Fonda Caballo Loco</h2>
              <p className="text-white/50 text-sm mt-1">¿Qué sección vas a contar?</p>
            </div>
            <div className="space-y-3">
              {sections.map(section => (
                <button
                  key={section.key}
                  onClick={() => handleSelectSection(section)}
                  className="w-full bg-white/[0.07] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/10 rounded-2xl p-5 flex items-center gap-4 transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-3xl shadow-inner border border-white/10">
                    {section.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-white font-bold text-base block">{section.label}</span>
                    <span className="text-white/40 text-xs font-medium">{section.description}</span>
                    <span className="text-orange-400/80 text-xs font-bold mt-1 block">{section.items.length} productos</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white/20 group-hover:text-orange-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== STEP 2: COUNT FORM ===== */}
        {step === 'count' && selectedSection && (
          <div className="pb-28">
            {/* Products list */}
            <div className="divide-y divide-white/[0.06]">
              {selectedSection.items.map((item, idx) => {
                const value = counts[item.id] ?? '';
                const isFilled = value !== '';
                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3.5 flex items-center gap-3 transition-colors ${isFilled ? 'bg-green-500/[0.06]' : ''}`}
                  >
                    {/* Index */}
                    <span className="text-white/20 text-xs font-bold w-5 text-right flex-shrink-0">{idx + 1}</span>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${isFilled ? 'text-green-300' : 'text-white/90'}`}>
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-white/30 text-[10px] font-medium">{item.unit}</span>
                        {item.lastCount !== null && (
                          <span className="text-white/25 text-[10px]">anterior: {item.lastCount}</span>
                        )}
                      </div>
                    </div>

                    {/* Input — larger touch target, auto-select on focus */}
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      value={value}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="—"
                      className={`w-[72px] h-12 rounded-xl text-center font-bold text-lg transition-all border-2 outline-none appearance-none
                        ${isFilled
                          ? 'bg-green-500/20 border-green-500/40 text-green-300 placeholder-green-500/30'
                          : 'bg-white/[0.07] border-white/10 text-white placeholder-white/20 focus:border-orange-400/60 focus:bg-orange-500/10'
                        }`}
                      style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' } as React.CSSProperties}
                    />

                    {/* Check mark */}
                    {isFilled && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== STEP 3: SUCCESS ===== */}
        {step === 'success' && result && (
          <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mb-6 animate-bounce-slow">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white font-black text-2xl mb-2">¡Conteo Guardado!</h2>
            <p className="text-white/50 text-sm mb-8">
              {selectedSection?.icon} {selectedSection?.label}
            </p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-10">
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
                <span className="block text-3xl font-black text-green-400">{result.saved}</span>
                <span className="text-green-400/60 text-xs font-bold uppercase">Guardados</span>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-center">
                <span className="block text-3xl font-black text-orange-400">{result.skipped}</span>
                <span className="text-orange-400/60 text-xs font-bold uppercase">Omitidos</span>
              </div>
            </div>
            <button
              onClick={resetForm}
              className="w-full max-w-xs bg-white/[0.1] hover:bg-white/[0.15] active:bg-white/[0.2] border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-base transition"
            >
              Contar otra sección
            </button>
          </div>
        )}
      </main>

      {/* ===== BOTTOM BAR: Submit (only on count step) ===== */}
      {step === 'count' && selectedSection && (
        <div className="flex-shrink-0 bg-black/60 backdrop-blur-xl border-t border-white/10 px-4 py-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3">
            {/* Progress indicator */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/50 text-xs font-bold">{filledCount} / {selectedSection.items.length}</span>
                <span className="text-white/30 text-xs">{selectedSection.items.length > 0 ? Math.round((filledCount / selectedSection.items.length) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-green-400 rounded-full transition-all duration-300"
                  style={{ width: `${selectedSection.items.length > 0 ? (filledCount / selectedSection.items.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || filledCount === 0}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 active:from-orange-600 active:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 text-white font-black text-sm px-6 py-3 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Global styles */}
      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
};

export default InventoryCountForm;
