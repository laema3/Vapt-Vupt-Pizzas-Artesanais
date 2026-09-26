import React, { useState } from 'react';
import { ZipRange } from '../types';
import { checkZipCoverage, fetchAddressByCep } from '../utils/zipUtils';

interface OpeningCepModalProps {
  isOpen: boolean;
  zipRanges: ZipRange[];
  storeName?: string;
  logoUrl?: string;
  onVerifySuccess: (cep: string, addressInfo: { address?: string; neighborhood?: string; city?: string }, fee: number, scheduledTime?: string | null) => void;
  onChoosePickup: (scheduledTime?: string | null) => void;
  onLogUncoveredCep?: (cep: string) => void;
}

const SCHEDULE_HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export const OpeningCepModal: React.FC<OpeningCepModalProps> = ({
  isOpen,
  zipRanges,
  storeName = 'Bella Borda',
  logoUrl,
  onVerifySuccess,
  onChoosePickup,
  onLogUncoveredCep
}) => {
  const [cepInput, setCepInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalStep, setModalStep] = useState<'INPUT' | 'CHOICE' | 'SCHEDULE'>('INPUT');
  const [pendingAction, setPendingAction] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [result, setResult] = useState<{
    checked: boolean;
    isCovered: boolean;
    fee: number;
    addressInfo?: { address?: string; neighborhood?: string; city?: string };
    error?: string;
  }>({ checked: false, isCovered: false, fee: 0 });

  if (!isOpen) return null;

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    if (val.length > 5) {
      val = `${val.slice(0, 5)}-${val.slice(5)}`;
    }
    setCepInput(val);
    if (result.checked) {
      setResult({ checked: false, isCovered: false, fee: 0 });
    }
  };

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCep = cepInput.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setResult({ checked: true, isCovered: false, fee: 0, error: 'Digite um CEP válido com 8 dígitos.' });
      return;
    }

    setIsLoading(true);
    setResult({ checked: false, isCovered: false, fee: 0 });

    try {
      const addr = await fetchAddressByCep(cleanCep);
      const coverage = checkZipCoverage(cleanCep, zipRanges);

      if (!coverage.isCovered) {
        if (onLogUncoveredCep) {
          onLogUncoveredCep(cleanCep);
        }
      }

      setResult({
        checked: true,
        isCovered: coverage.isCovered,
        fee: coverage.fee,
        addressInfo: addr ? { address: addr.address, neighborhood: addr.neighborhood, city: addr.city } : undefined
      });
    } catch {
      const coverage = checkZipCoverage(cleanCep, zipRanges);
      setResult({
        checked: true,
        isCovered: coverage.isCovered,
        fee: coverage.fee
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedDelivery = () => {
    if (result.isCovered) {
      setPendingAction('DELIVERY');
      setModalStep('CHOICE');
    }
  };

  const handlePickupChoice = () => {
    setPendingAction('PICKUP');
    setModalStep('CHOICE');
  };

  const handleFinalizeNormal = () => {
    if (pendingAction === 'DELIVERY') {
      onVerifySuccess(cepInput, result.addressInfo || {}, result.fee, null);
    } else {
      onChoosePickup(null);
    }
  };

  const handleFinalizeScheduled = (slot: string) => {
    if (pendingAction === 'DELIVERY') {
      onVerifySuccess(cepInput, result.addressInfo || {}, result.fee, slot);
    } else {
      onChoosePickup(slot);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col transform animate-in zoom-in-95 duration-300">
        
        {/* Header decorativo */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 p-6 sm:p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10 text-9xl">🍕</div>
          
          {logoUrl ? (
            <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/15 backdrop-blur-sm border-2 border-white/40 p-1 shadow-lg flex items-center justify-center">
              <img src={logoUrl} alt={storeName} className="w-full h-full object-contain rounded-full" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="text-4xl mb-2">🍕🧀</div>
          )}

          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
            {modalStep === 'INPUT' && 'Consulte sua Região'}
            {modalStep === 'CHOICE' && 'Tipo de Pedido'}
            {modalStep === 'SCHEDULE' && 'Agendar Horário'}
          </h2>
          <p className="text-white/90 text-xs sm:text-sm mt-1 font-medium">
            {modalStep === 'INPUT' && 'Digite seu CEP para verificarmos a disponibilidade de entrega.'}
            {modalStep === 'CHOICE' && 'Escolha se deseja o pedido agora ou agendar para mais tarde.'}
            {modalStep === 'SCHEDULE' && 'Selecione o horário desejado (entrega/preparo 2 horas após).'}
          </p>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 sm:p-8 space-y-6">
          {modalStep === 'INPUT' && (
            <>
              <form onSubmit={handleCheck} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                    Qual o CEP da sua entrega?
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={cepInput}
                      onChange={handleCepChange}
                      maxLength={9}
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-600 focus:bg-white rounded-2xl px-4 py-3.5 text-lg font-bold text-slate-800 text-center tracking-widest outline-none transition-all shadow-inner"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isLoading || cepInput.replace(/\D/g, '').length < 8}
                      className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      {isLoading ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span>Consultar</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Resultados da Consulta */}
              {result.checked && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                  {result.isCovered ? (
                    <div className="bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto text-xl font-black shadow-md shadow-emerald-500/30">
                        ✓
                      </div>
                      <div>
                        <h3 className="text-emerald-900 font-black text-lg uppercase tracking-tight">
                          Êba! Entregamos na sua região!
                        </h3>
                        {result.addressInfo?.neighborhood && (
                          <p className="text-emerald-700 text-xs font-semibold mt-0.5">
                            📍 {result.addressInfo.neighborhood} {result.addressInfo.city ? `(${result.addressInfo.city})` : ''}
                          </p>
                        )}
                        <p className="text-emerald-800 text-sm font-bold mt-2">
                          Taxa de Entrega: <span className="text-emerald-950 font-black">R$ {result.fee.toFixed(2)}</span>
                        </p>
                      </div>

                      <button
                        onClick={handleProceedDelivery}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black uppercase text-sm tracking-widest shadow-xl shadow-emerald-600/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Continuar</span>
                        <span>→</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border-2 border-amber-400/40 rounded-2xl p-5 text-center space-y-4">
                      <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto text-xl font-black shadow-md shadow-amber-500/30">
                        🛵
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-amber-950 font-black text-base uppercase tracking-tight">
                          Ainda não atendemos na sua região no momento
                        </h3>
                        <p className="text-amber-900/80 text-xs sm:text-sm font-medium leading-relaxed">
                          Agradecemos muito pela preferência e carinho! Esperamos em breve expandir nossas rotas e levar nossas pizzas até você. 💛
                        </p>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                        <button
                          onClick={handlePickupChoice}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 px-4 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>🛍️ Retirar no Balcão</span>
                        </button>
                        <button
                          onClick={() => {
                            setCepInput('');
                            setResult({ checked: false, isCovered: false, fee: 0 });
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-3.5 px-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all cursor-pointer"
                        >
                          Tentar Outro CEP
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!result.checked && (
                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    onClick={handlePickupChoice}
                    className="text-xs font-bold uppercase text-slate-500 hover:text-red-600 transition-colors py-2 px-4 rounded-lg hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>🛍️ Prefiro Retirar no Balcão (Sem Consulta de CEP)</span>
                  </button>
                </div>
              )}
            </>
          )}

          {modalStep === 'CHOICE' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <button
                onClick={handleFinalizeNormal}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-wider shadow-xl transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 bg-white/10 rounded-xl">⚡</span>
                  <div className="text-left">
                    <div className="text-base font-black">PEDIDO NORMAL</div>
                    <div className="text-[10px] text-slate-400 font-semibold">Preparo e entrega imediatos</div>
                  </div>
                </div>
                <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
              </button>

              <button
                onClick={() => setModalStep('SCHEDULE')}
                className="w-full bg-red-600 hover:bg-red-700 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-wider shadow-xl shadow-red-600/25 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 bg-white/15 rounded-xl">📅</span>
                  <div className="text-left">
                    <div className="text-base font-black">AGENDAR PEDIDO</div>
                    <div className="text-[10px] text-red-200 font-semibold">Escolha um horário (entrega 2h após)</div>
                  </div>
                </div>
                <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
              </button>

              <button
                onClick={() => setModalStep('INPUT')}
                className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest cursor-pointer"
              >
                ← Voltar
              </button>
            </div>
          )}

          {modalStep === 'SCHEDULE' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-amber-900 text-xs font-bold">
                ⏰ Selecione o horário de sua preferência. O pedido será entregue/preparado <strong>2 horas após</strong> o horário escolhido.
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[260px] overflow-y-auto p-1">
                {SCHEDULE_HOURS.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleFinalizeScheduled(slot)}
                    className="py-3 px-2 bg-slate-50 hover:bg-red-600 hover:text-white border-2 border-slate-200 hover:border-red-600 rounded-xl text-xs font-black uppercase tracking-wider text-slate-800 transition-all shadow-sm cursor-pointer flex flex-col items-center gap-1 active:scale-95"
                  >
                    <span>🕒 {slot}</span>
                    <span className="text-[9px] font-semibold opacity-70">Entrega {(Number(slot.split(':')[0]) + 2).toString().padStart(2, '0')}:00</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setModalStep('CHOICE')}
                className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest cursor-pointer"
              >
                ← Voltar
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
