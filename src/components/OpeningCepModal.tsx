import React, { useState, useEffect } from 'react';
import { ZipRange, Order, Customer } from '../types';
import { checkZipCoverage, fetchAddressByCep } from '../utils/zipUtils';
import { safeStorage } from '../utils/safeStorage';

interface OpeningCepModalProps {
  isOpen: boolean;
  onClose?: () => void;
  currentUser?: Customer | null;
  zipRanges: ZipRange[];
  orders?: Order[];
  storeName?: string;
  logoUrl?: string;
  initialStep?: 'INPUT' | 'CHOICE' | 'SCHEDULE';
  onVerifySuccess: (cep: string, addressInfo: { address?: string; neighborhood?: string; city?: string }, fee: number, scheduledTime?: string | null) => void;
  onChoosePickup: (scheduledTime?: string | null) => void;
  onLogUncoveredCep?: (cep: string) => void;
}

const ALL_SCHEDULE_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', 
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', 
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', 
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
];

export const OpeningCepModal: React.FC<OpeningCepModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  zipRanges,
  orders = [],
  storeName = 'Bella Borda',
  logoUrl,
  initialStep = 'INPUT',
  onVerifySuccess,
  onChoosePickup,
  onLogUncoveredCep
}) => {
  const [cepInput, setCepInput] = useState('');
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [customTimeError, setCustomTimeError] = useState('');
  const [confirmingSlot, setConfirmingSlot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modalStep, setModalStep] = useState<'INPUT' | 'CHOICE' | 'SCHEDULE'>(initialStep);
  const [pendingAction, setPendingAction] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [result, setResult] = useState<{
    checked: boolean;
    isCovered: boolean;
    fee: number;
    addressInfo?: { address?: string; neighborhood?: string; city?: string };
    error?: string;
  }>({ checked: false, isCovered: false, fee: 0 });

  useEffect(() => {
    if (isOpen) {
      if (currentUser) {
        // Cliente logado nunca é solicitado a digitar CEP
        setModalStep(initialStep === 'INPUT' ? 'CHOICE' : initialStep);
        const savedCep = currentUser.zipCode || safeStorage.getItem('nl_opening_cep') || '';
        setCepInput(savedCep);
        const coverage = savedCep ? checkZipCoverage(savedCep, zipRanges) : { isCovered: true, fee: 0 };
        setResult({
          checked: true,
          isCovered: true,
          fee: coverage.fee,
          addressInfo: { address: currentUser.address, neighborhood: currentUser.neighborhood }
        });
      } else {
        setModalStep(initialStep);
        const savedCep = safeStorage.getItem('nl_opening_cep');
        if (savedCep) {
          setCepInput(savedCep);
          const coverage = checkZipCoverage(savedCep, zipRanges);
          setResult({
            checked: true,
            isCovered: coverage.isCovered,
            fee: coverage.fee
          });
        }
      }
    }
  }, [isOpen, initialStep, zipRanges, currentUser]);

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
      const resolvedAddrInfo = (currentUser && currentUser.address && !result.addressInfo?.address) 
        ? { address: currentUser.address, neighborhood: currentUser.neighborhood } 
        : (result.addressInfo || (currentUser ? { address: currentUser.address, neighborhood: currentUser.neighborhood } : {}));
      onVerifySuccess(cepInput, resolvedAddrInfo, result.fee, null);
    } else {
      onChoosePickup(null);
    }
  };

  const getSlotReservedCount = (slot: string) => {
    return orders.filter(o => o.scheduledTime === slot && o.status !== 'CANCELADO' && o.status !== 'FINALIZADO').length;
  };

  const getDeliveryTime = (slot: string) => {
    const [h, m] = slot.split(':').map(Number);
    const totalMinutes = h * 60 + m + 120; // 2 hours later
    const delH = Math.floor(totalMinutes / 60) % 24;
    const delM = totalMinutes % 60;
    return `${String(delH).padStart(2, '0')}:${String(delM).padStart(2, '0')}`;
  };

  const isSlotPassed = (slot: string) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const [slotHour, slotMinute] = slot.split(':').map(Number);
    return currentHour > slotHour || (currentHour === slotHour && currentMinute > slotMinute);
  };

  const handleFinalizeScheduled = (slot: string) => {
    const count = getSlotReservedCount(slot);
    if (count >= 4) {
      alert(`⚠️ Este horário (${slot}) já atingiu a capacidade máxima de 4 pedidos. Por favor, escolha outro horário disponível.`);
      return;
    }
    if (isSlotPassed(slot)) {
      alert(`⚠️ Este horário (${slot}) já passou. Por favor, escolha um horário disponível.`);
      return;
    }
    setConfirmingSlot(slot);
  };

  const handleCustomTimeSubmit = () => {
    let clean = customTimeInput.trim().replace(/\s+/g, '');
    if (/^\d{4}$/.test(clean)) {
      clean = clean.slice(0, 2) + ':' + clean.slice(2);
    }
    clean = clean.replace('.', ':').replace('h', ':');

    const parts = clean.split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      setCustomTimeError('Por favor, digite um horário válido no formato HH:MM (ex: 17:15).');
      return;
    }
    const [h, m] = parts;
    if (h < 8 || h > 20 || m < 0 || m > 59) {
      setCustomTimeError('O horário deve ser entre 08:00 e 20:00.');
      return;
    }
    setCustomTimeError('');

    const targetMinutes = h * 60 + m;
    let closestSlot = ALL_SCHEDULE_HOURS[0];
    let minDiff = Infinity;
    for (const slot of ALL_SCHEDULE_HOURS) {
      const [sh, sm] = slot.split(':').map(Number);
      const slotMinutes = sh * 60 + sm;
      const diff = Math.abs(slotMinutes - targetMinutes);
      if (diff < minDiff) {
        minDiff = diff;
        closestSlot = slot;
      }
    }

    handleFinalizeScheduled(closestSlot);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col transform animate-in zoom-in-95 duration-300 relative">
        {onClose && (
          <button 
            type="button" 
            onClick={() => {
              safeStorage.setItem('nl_opening_cep_verified', 'true');
              onClose();
            }} 
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center font-bold text-lg transition-colors cursor-pointer"
            title="Fechar e ver cardápio"
          >
            ✕
          </button>
        )}
        
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
              {currentUser && currentUser.address && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-3 text-left animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-red-700 flex items-center gap-1.5">
                      <span>👤</span> Olá, {currentUser.name}
                    </span>
                    <span className="text-[9px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full uppercase">
                      Endereço Cadastrado
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">{currentUser.address}</p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {currentUser.neighborhood} {currentUser.zipCode ? `• CEP: ${currentUser.zipCode}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const userZip = currentUser.zipCode || '';
                      setCepInput(userZip);
                      const coverage = checkZipCoverage(userZip, zipRanges);
                      setResult({
                        checked: true,
                        isCovered: coverage.isCovered,
                        fee: coverage.fee,
                        addressInfo: { address: currentUser.address, neighborhood: currentUser.neighborhood }
                      });
                      setPendingAction('DELIVERY');
                      setModalStep('CHOICE');
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black uppercase text-xs tracking-wider shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Usar Meu Endereço Cadastrado</span>
                    <span>→</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">ou digite outro CEP abaixo se desejar enviar para outro local</p>
                </div>
              )}

              {!currentUser && (
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
              )}

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
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handlePickupChoice}
                    className="text-xs font-bold uppercase text-slate-500 hover:text-red-600 transition-colors py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>🛍️ Retirar no Balcão</span>
                  </button>
                  {onClose && (
                    <button
                      type="button"
                      onClick={() => {
                        safeStorage.setItem('nl_opening_cep_verified', 'true');
                        onClose();
                      }}
                      className="text-xs font-black uppercase text-red-600 hover:text-red-700 transition-colors py-2 px-3 rounded-lg hover:bg-red-50 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span>🍽️ Ver Cardápio Primeiro →</span>
                    </button>
                  )}
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
              {confirmingSlot ? (
                <div className="bg-red-50 border-2 border-red-500 p-6 rounded-3xl text-center space-y-6 shadow-xl">
                  <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center mx-auto text-3xl font-black shadow-lg">
                    📅
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Confirmar Horário Agendado?
                    </h3>
                    <p className="text-red-700 text-2xl font-black mt-2">
                      {confirmingSlot} (Entrega às {getDeliveryTime(confirmingSlot)})
                    </p>
                    <p className="text-slate-600 text-xs font-medium mt-2">
                      Deseja confirmar este horário para o seu pedido?
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        const slot = confirmingSlot;
                        setConfirmingSlot(null);
                        if (pendingAction === 'DELIVERY') {
                          const resolvedAddrInfo = (currentUser && currentUser.address && !result.addressInfo?.address) 
                            ? { address: currentUser.address, neighborhood: currentUser.neighborhood } 
                            : (result.addressInfo || (currentUser ? { address: currentUser.address, neighborhood: currentUser.neighborhood } : {}));
                          onVerifySuccess(cepInput, resolvedAddrInfo, result.fee, slot);
                        } else {
                          onChoosePickup(slot);
                        }
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
                    >
                      ✓ Sim, Confirmar Horário
                    </button>
                    <button
                      onClick={() => setConfirmingSlot(null)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-4 px-6 rounded-xl font-bold uppercase text-xs tracking-wider transition-all cursor-pointer"
                    >
                      Escolher Outro
                    </button>
                  </div>
                </div>
              ) : (
                <>
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-amber-900 text-xs font-bold">
                ⏰ Selecione o horário de sua preferência. O pedido será entregue/preparado <strong>2 horas após</strong> o horário escolhido.
              </div>

              <div className="bg-white border-2 border-slate-200 p-3.5 rounded-2xl space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-700 block">
                  Ou digite o horário desejado (Ex: 17:15):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="HH:MM"
                    maxLength={5}
                    value={customTimeInput}
                    onChange={(e) => setCustomTimeInput(e.target.value)}
                    className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 w-32 text-center"
                  />
                  <button
                    type="button"
                    onClick={handleCustomTimeSubmit}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Agendar Horário Digitado
                  </button>
                </div>
                {customTimeError && (
                  <p className="text-red-600 text-[11px] font-black mt-1">⚠️ {customTimeError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto p-1">
                {ALL_SCHEDULE_HOURS.map((slot) => {
                  const count = getSlotReservedCount(slot);
                  const remaining = 4 - count;
                  const isFull = remaining <= 0;
                  const passed = isSlotPassed(slot);
                  const isDisabled = isFull || passed;
                  const deliveryTimeStr = getDeliveryTime(slot);

                  return (
                    <button
                      key={slot}
                      onClick={() => handleFinalizeScheduled(slot)}
                      disabled={isDisabled}
                      className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                        isDisabled
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
                          : 'bg-white hover:bg-red-600 hover:text-white border-slate-200 text-slate-900 shadow-sm cursor-pointer group'
                      }`}
                    >
                      <span className="font-black text-sm uppercase">🕒 {slot}</span>
                      <span className="text-[9px] font-bold opacity-80 group-hover:text-red-100">Entrega {deliveryTimeStr}</span>
                      {isFull ? (
                        <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black mt-0.5">ESGOTADO (0/4)</span>
                      ) : passed ? (
                        <span className="text-[8px] bg-slate-300 text-slate-600 px-1.5 py-0.5 rounded font-black mt-0.5">JÁ PASSOU</span>
                      ) : (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black mt-0.5 ${count > 0 ? 'bg-amber-400 text-amber-950 font-black' : remaining === 1 ? 'bg-amber-500 text-white animate-pulse' : 'bg-emerald-100 text-emerald-800'}`}>
                          {remaining === 1 ? 'Última vaga!' : `${remaining} vagas`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setModalStep('CHOICE')}
                className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest cursor-pointer"
              >
                ← Voltar
              </button>
              </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
