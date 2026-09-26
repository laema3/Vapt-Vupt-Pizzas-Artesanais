
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CartItem, Coupon, PaymentSettings, Customer, DeliveryType, ZipRange } from '../types';
import { checkZipCoverage, fetchAddressByCep } from '../utils/zipUtils';
import { sendOutOfAreaNotification } from '../services/ntfyService';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  coupons: Coupon[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: (
    paymentMethod: string, 
    fee: number, 
    discount: number, 
    couponCode: string, 
    deliveryType: DeliveryType, 
    changeFor?: number, 
    tableId?: string,
    deliveryAddressInfo?: { address: string; neighborhood: string; zipCode: string },
    orderObservations?: string
  ) => void;
  onAuthClick: () => void;
  paymentSettings: PaymentSettings[];
  tables: any[];
  currentUser: Customer | null;
  isKioskMode: boolean;
  deliveryFee: number;
  availableCoupons: Coupon[];
  isStoreOpen: boolean;
  isProcessing: boolean;
  onShowToast?: (msg: string, type: 'success' | 'error') => void;
  defaultTableId?: string;
  isAdmin?: boolean;
  forcedDeliveryType?: DeliveryType | null;
  zipRanges?: ZipRange[];
  ntfyTopic?: string;
  scheduledTime?: string | null;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ 
  isOpen, onClose, items, coupons, onUpdateQuantity, onRemove, onCheckout, onAuthClick, 
  paymentSettings, tables, currentUser, isKioskMode, deliveryFee, availableCoupons, isStoreOpen, isProcessing,
  onShowToast, defaultTableId, isAdmin, forcedDeliveryType, zipRanges = [], ntfyTopic, scheduledTime
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [changeFor, setChangeFor] = useState<number | undefined>(undefined);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(defaultTableId ? 'TABLE' : null);
  const [selectedTableId, setSelectedTableId] = useState<string>(defaultTableId || '');
  const [orderObservations, setOrderObservations] = useState('');

  const observationsRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Endereço e CEP para entrega
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  // Nome e WhatsApp do cliente (quando não logado)
  const [guestName, setGuestName] = useState(() => {
    try { return localStorage.getItem('nl_guest_name') || ''; } catch { return ''; }
  });
  const [guestPhone, setGuestPhone] = useState(() => {
    try { return localStorage.getItem('nl_guest_phone') || ''; } catch { return ''; }
  });

  const handleGuestNameChange = (val: string) => {
    setGuestName(val);
    try {
      localStorage.setItem('nl_guest_name', val);
    } catch (_e) {
      // Ignora erro se localStorage estiver bloqueado
    }
  };

  const handleGuestPhoneChange = (val: string) => {
    setGuestPhone(val);
    try {
      localStorage.setItem('nl_guest_phone', val);
    } catch (_e) {
      // Ignora erro se localStorage estiver bloqueado
    }
  };

  const effectiveCustomerName = currentUser?.name || (guestName.trim() ? guestName.trim() : undefined);
  const effectiveCustomerPhone = currentUser?.phone || (guestPhone.trim() ? guestPhone.trim() : undefined);
  const effectiveCustomerEmail = currentUser?.email || undefined;

  useEffect(() => {
    if (currentUser) {
      setZipCode(currentUser.zipCode || '');
      setAddress(currentUser.address || '');
      setNeighborhood(currentUser.neighborhood || '');
    }
  }, [currentUser, isOpen]);

  useEffect(() => {
    if (defaultTableId) {
      setDeliveryType('TABLE');
      setSelectedTableId(defaultTableId);
    }
  }, [defaultTableId]);

  useEffect(() => {
    if (forcedDeliveryType) {
      setDeliveryType(forcedDeliveryType);
    }
  }, [forcedDeliveryType, isOpen]);

  useEffect(() => {
    if (deliveryType === 'TABLE') {
      setPaymentMethod('PAGAMENTO NO BALCÃO');
    }
  }, [deliveryType]);

  // Função para buscar ViaCEP automaticamente quando o usuário digitar o CEP
  const handleZipCodeChange = async (val: string) => {
    setZipCode(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsFetchingAddress(true);
      const res = await fetchAddressByCep(clean);
      setIsFetchingAddress(false);
      let foundAddress = address;
      let foundNeighborhood = neighborhood;
      let foundCity = '';

      if (res && res.address) {
        setAddress(res.address);
        foundAddress = res.address;
        if (res.neighborhood) {
          setNeighborhood(res.neighborhood);
          foundNeighborhood = res.neighborhood;
        }
        if (res.city) foundCity = res.city;

        // Se o CEP estiver fora da cobertura de entrega da pizzaria, notifica imediatamente
        if (zipRanges && zipRanges.length > 0) {
          const coverage = checkZipCoverage(clean, zipRanges);
          if (!coverage.isCovered) {
            if (onShowToast) {
              onShowToast(`Atenção: CEP ${val} fora da nossa área de entrega (pedidos somente para Retirada no Balcão).`, 'error');
            }
            sendOutOfAreaNotification({
              zipCode: val,
              customerName: effectiveCustomerName,
              customerPhone: effectiveCustomerPhone,
              customerEmail: effectiveCustomerEmail,
              address: foundAddress,
              neighborhood: foundNeighborhood,
              city: foundCity,
              cartTotal: total,
              itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
              topic: ntfyTopic,
              reason: 'CEP fora da área de entrega cadastrada',
              force: true
            });
          } else {
            if (onShowToast) onShowToast('Endereço localizado pelo CEP!', 'success');
          }
        } else {
          if (onShowToast) onShowToast('Endereço localizado pelo CEP!', 'success');
        }
      } else {
        // CEP não localizado no sistema de Correios - dispara imediatamente para o ntfy no exato momento da mensagem
        if (onShowToast) onShowToast('CEP não localizado no sistema de Correios.', 'error');
        sendOutOfAreaNotification({
          zipCode: val,
          customerName: effectiveCustomerName,
          customerPhone: effectiveCustomerPhone,
          customerEmail: effectiveCustomerEmail,
          address: foundAddress,
          neighborhood: foundNeighborhood || 'Não localizado nos Correios',
          city: foundCity,
          cartTotal: total,
          itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
          topic: ntfyTopic,
          reason: 'CEP não localizado no sistema de Correios',
          force: true
        });
      }
    }
  };

  // Validação e cálculo dinâmico do valor do frete e cobertura de CEP
  const zipCoverage = useMemo(() => {
    if (deliveryType !== 'DELIVERY') return { isCovered: true, fee: 0 };
    const targetZip = zipCode || currentUser?.zipCode || '';
    if (!targetZip) return { isCovered: false, fee: 0 };
    return checkZipCoverage(targetZip, zipRanges);
  }, [deliveryType, zipCode, currentUser, zipRanges]);

  const cleanCurrentZip = (zipCode || currentUser?.zipCode || '').replace(/\D/g, '');
  const isZipOutOfArea = deliveryType === 'DELIVERY' && 
                         cleanCurrentZip.length >= 8 && 
                         zipRanges.length > 0 && 
                         !zipCoverage.isCovered;

  const activeDeliveryFee = useMemo(() => {
    if (deliveryType !== 'DELIVERY') return 0;
    const targetZip = zipCode || currentUser?.zipCode || '';
    if (!targetZip) return (zipRanges && zipRanges.length > 0 ? 0 : deliveryFee);
    return zipCoverage.fee;
  }, [deliveryType, zipCode, currentUser, zipRanges, zipCoverage, deliveryFee]);

  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discount = appliedCoupon ? (appliedCoupon.type === 'PERCENT' ? subtotal * (appliedCoupon.discount / 100) : appliedCoupon.discount) : 0;
  const total = subtotal + (deliveryType === 'DELIVERY' ? activeDeliveryFee : 0) - discount;

  const handleApplyCoupon = () => {
    const coupon = coupons.find(c => c.code === couponCode && c.active);
    if (coupon) {
      setAppliedCoupon(coupon);
      if (onShowToast) onShowToast('Cupom aplicado com sucesso!', 'success');
    } else {
      if (onShowToast) onShowToast('Cupom inválido ou expirado', 'error');
      else alert('Cupom inválido ou expirado');
    }
  };

  const handleCheckoutClick = () => {
    if (!deliveryType) {
      if (onShowToast) {
        onShowToast('FAVOR SELECIONAR ENTREGA, RETIRADA OU MESA', 'error');
      } else {
        alert('FAVOR SELECIONAR ENTREGA, RETIRADA OU MESA');
      }
      return;
    }

    if (deliveryType === 'DELIVERY') {
      if (!zipCode || !address || !neighborhood) {
        const msg = 'Favor preencher o CEP e o endereço completo para entrega.';
        if (onShowToast) onShowToast(msg, 'error');
        else alert(msg);
        return;
      }

      if (zipRanges.length > 0 && !zipCoverage.isCovered) {
        // Envia notificação imediata via ntfy ao lojista informando a tentativa de pedido com CEP não atendido
        sendOutOfAreaNotification({
          zipCode,
          customerName: effectiveCustomerName,
          customerPhone: effectiveCustomerPhone,
          customerEmail: effectiveCustomerEmail,
          address,
          neighborhood,
          cartTotal: total,
          itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
          topic: ntfyTopic,
          reason: 'Tentativa de concluir pedido com CEP fora da área',
          force: true
        });

        const msg = `Infelizmente não realizamos entregas para o CEP ${zipCode} (fora da nossa área de atendimento). Por favor, altere para Retirada no Balcão para concluir seu pedido.`;
        if (onShowToast) onShowToast(msg, 'error');
        else alert(msg);
        return;
      }
    }

    if (deliveryType === 'TABLE' && !selectedTableId) {
      if (onShowToast) {
        onShowToast('FAVOR SELECIONAR O NÚMERO DA MESA', 'error');
      } else {
        alert('FAVOR SELECIONAR O NÚMERO DA MESA');
      }
      return;
    }

    if (!paymentMethod) {
      if (onShowToast) {
        onShowToast('FAVOR SELECIONAR UMA FORMA DE PAGAMENTO', 'error');
      } else {
        alert('FAVOR SELECIONAR UMA FORMA DE PAGAMENTO');
      }
      return;
    }
    console.log("[CartSidebar] Chamando onCheckout com:", paymentMethod);
    
    // Adiciona o sufixo (na entrega/retirada) apenas para métodos offline
    const methodObj = paymentSettings.find(p => p.name === paymentMethod);
    const isOffline = methodObj && methodObj.type !== 'ONLINE' && methodObj.integration !== 'MERCADO_PAGO' && methodObj.integration !== 'PAGSEGURO';
    
    let suffix = '';
    if (deliveryType === 'PICKUP') suffix = ' (na retirada)';
    else if (deliveryType === 'DELIVERY') suffix = ' (na entrega)';
    else if (deliveryType === 'TABLE') suffix = ' (no balcão)';

    const finalPaymentMethod = isOffline 
      ? `${paymentMethod}${suffix}`
      : paymentMethod;

    const deliveryAddressInfo = deliveryType === 'DELIVERY' ? { address, neighborhood, zipCode } : undefined;

    onCheckout(
      finalPaymentMethod, 
      deliveryType === 'DELIVERY' ? activeDeliveryFee : 0, 
      discount, 
      appliedCoupon?.code || '', 
      deliveryType, 
      changeFor, 
      selectedTableId,
      deliveryAddressInfo,
      orderObservations
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-red-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-red-100 flex items-center justify-between bg-red-600 text-white z-10">
          <h2 className="text-xl font-black uppercase tracking-tight">Seu Pedido <span className="text-red-200">({items.length})</span></h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-red-500/20 text-white hover:bg-red-700 hover:text-white flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
              <span className="text-6xl">🛒</span>
              <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledTime && (
                <div className="bg-amber-100 border-2 border-amber-300 p-4 rounded-2xl text-amber-950 text-xs font-bold space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 font-black uppercase text-amber-950">
                    <span className="text-base">📅</span>
                    <span>Pedido Agendado para as {scheduledTime}</span>
                  </div>
                  <p className="text-amber-900/90 text-[11px] leading-relaxed">
                    Previsão de {deliveryType === 'PICKUP' ? 'retirada' : 'entrega'} / preparo: <strong>2 horas após</strong> (às {(() => {
                      const [h, m] = scheduledTime.split(':').map(Number);
                      const newH = (h + 2) % 24;
                      return `${String(newH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
                    })()}).
                  </p>
                </div>
              )}
              {items.map(item => (
                <div key={item.id} className="flex gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="w-20 h-20 bg-white rounded-xl shrink-0 overflow-hidden p-1 flex items-center justify-center border border-slate-100">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-2xl flex items-center justify-center h-full">🍕</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-slate-800 text-sm uppercase truncate pr-2" title={item.name}>
                        {item.name}
                      </h4>
                      <button 
                        type="button"
                        onClick={() => onRemove(item.id)} 
                        className="text-red-400 hover:text-red-600 text-xs cursor-pointer p-1"
                        title="Remover item"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Detalhes Meio a Meio */}
                    {item.pizzaMode === 'MEIO_A_MEIO' && item.secondFlavor && (
                      <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] space-y-0.5">
                        <div className="flex items-center gap-1 text-amber-900 font-black">
                          <span>🌓</span> <span>Pizza Meio a Meio:</span>
                        </div>
                        <div className="text-slate-600 pl-3 font-medium flex justify-between">
                          <span>• 1/2 {item.firstFlavor?.name || item.name}</span>
                          <span className="text-amber-800 font-bold">R$ {(((item.firstFlavor?.price || item.price) / 2)).toFixed(2)}</span>
                        </div>
                        <div className="text-slate-600 pl-3 font-medium flex justify-between">
                          <span>• 1/2 {item.secondFlavor.name}</span>
                          <span className="text-amber-800 font-bold">R$ {((item.secondFlavor.price / 2)).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Adicionais & Borda Recheada */}
                    {item.selectedComplements && item.selectedComplements.length > 0 && (() => {
                      const borda = item.selectedBorda || item.selectedComplements.find(c => c.type === 'BORDA' || c.name.toLowerCase().includes('borda'));
                      const adicionais = item.selectedAdditionals || item.selectedComplements.filter(c => c !== borda);

                      return (
                        <div className="mb-2 bg-slate-100/80 rounded-xl p-2 text-[10px] text-slate-700 space-y-1.5 border border-slate-200/60">
                          {borda && (
                            <div className={`border rounded-lg p-1.5 flex justify-between items-center ${
                              borda.price > 0 
                                ? 'bg-amber-50/90 border-amber-200/80 text-amber-950' 
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                              <span className="font-black flex items-center gap-1">
                                <span>🥖</span> <span>Borda: {borda.name}</span>
                              </span>
                              {borda.price > 0 ? (
                                <span className="font-black text-amber-700">+ R$ {borda.price.toFixed(2)}</span>
                              ) : (
                                <span className="font-bold text-slate-400 text-[9px]">Tradicional (Grátis)</span>
                              )}
                            </div>
                          )}

                          {adicionais.length > 0 && (
                            <div className="space-y-0.5">
                              <span className="font-black text-slate-500 uppercase text-[9px] block">
                                ➕ Adicionais ({adicionais.length}/3):
                              </span>
                              {adicionais.map((c, ci) => (
                                <div key={ci} className="pl-1 flex justify-between items-center text-slate-600">
                                  <span>• {c.name}</span>
                                  <span className="font-bold text-slate-700">+ R$ {c.price.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <p className="text-red-600 font-black text-xs mb-2">
                      R$ {item.price.toFixed(2)} {item.quantity > 1 ? `(Total: R$ ${(item.price * item.quantity).toFixed(2)})` : ''}
                    </p>
                    <div className="flex items-center gap-3 bg-white w-fit px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                      <button 
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, -1)} 
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 font-black cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-black text-slate-800 w-4 text-center">{item.quantity}</span>
                      <button 
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, 1)} 
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-6 pt-6 border-t border-slate-100">
              <button 
                onClick={onClose} 
                className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <span>←</span> Continuar Comprando
              </button>

              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Entrega</h3>
                <div className="grid grid-cols-1 gap-2">
                  {!defaultTableId && (
                    <>
                      <button 
                        onClick={() => {
                          setDeliveryType('DELIVERY');
                          scrollToSection(observationsRef);
                        }} 
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between shadow-sm ${deliveryType === 'DELIVERY' ? 'border-red-500 bg-red-50 text-red-700 shadow-red-100' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:text-red-500'}`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                          <span className="text-lg">🛵</span> Delivery
                        </span>
                        {deliveryType === 'DELIVERY' && <span className="text-red-600 font-bold">●</span>}
                      </button>
                      <button 
                        onClick={() => {
                          setDeliveryType('PICKUP');
                          scrollToSection(observationsRef);
                        }} 
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between shadow-sm ${deliveryType === 'PICKUP' ? 'border-red-500 bg-red-50 text-red-700 shadow-red-100' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:text-red-500'}`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                          <span className="text-lg">🏃</span> Retirada
                        </span>
                        {deliveryType === 'PICKUP' && <span className="text-red-600 font-bold">●</span>}
                      </button>
                    </>
                  )}
                </div>

                {deliveryType === 'DELIVERY' && (
                  <div className="bg-white p-4 rounded-2xl border border-red-200 space-y-3 mt-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">📍 Endereço de Entrega</h4>
                      {isFetchingAddress && <span className="text-[10px] font-bold text-red-600 animate-pulse">Buscando CEP...</span>}
                    </div>

                    {!currentUser && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-slate-100">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Seu Nome</label>
                          <input 
                            type="text" 
                            value={guestName} 
                            onChange={e => handleGuestNameChange(e.target.value)} 
                            placeholder="Nome Completo" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">WhatsApp</label>
                          <input 
                            type="tel" 
                            value={guestPhone} 
                            onChange={e => handleGuestPhoneChange(e.target.value)} 
                            placeholder="(34) 99999-0000" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">CEP</label>
                      <input 
                        type="text" 
                        value={zipCode} 
                        onChange={e => handleZipCodeChange(e.target.value)} 
                        placeholder="Ex: 38000-000" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Endereço (Rua, Número, Comp.)</label>
                      <input 
                        type="text" 
                        value={address} 
                        onChange={e => setAddress(e.target.value)} 
                        placeholder="Rua das Flores, 123" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Bairro</label>
                      <input 
                        type="text" 
                        value={neighborhood} 
                        onChange={e => setNeighborhood(e.target.value)} 
                        placeholder="Centro" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    {zipCode && (
                      <>
                        {isZipOutOfArea ? (
                          <div className="p-3.5 rounded-2xl bg-red-100/90 border border-red-300 text-red-800 text-xs font-bold space-y-2.5">
                            <div className="flex items-center gap-1.5 font-black uppercase text-red-900">
                              <span className="text-base">🚫</span>
                              <span>Fora da área de entrega</span>
                            </div>
                            <p className="text-red-700 leading-relaxed text-[11px]">
                              Infelizmente não realizamos entregas para o CEP <strong>{zipCode}</strong>.
                              Atendemos apenas faixas de CEP autorizadas da cidade.
                            </p>

                            {/* Cartão de Contato com Nome e WhatsApp */}
                            <div className="bg-white/95 p-3 rounded-xl border border-red-200 space-y-2 text-left">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-red-900">
                                  Deseja consultar entrega especial?
                                </span>
                                <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Aviso no ntfy</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <input 
                                  type="text" 
                                  placeholder="Seu Nome Completo" 
                                  value={effectiveCustomerName || ''} 
                                  onChange={e => handleGuestNameChange(e.target.value)} 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-red-500"
                                />
                                <input 
                                  type="tel" 
                                  placeholder="Seu WhatsApp com DDD" 
                                  value={effectiveCustomerPhone || ''} 
                                  onChange={e => handleGuestPhoneChange(e.target.value)} 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-red-500"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  sendOutOfAreaNotification({
                                    zipCode,
                                    customerName: effectiveCustomerName,
                                    customerPhone: effectiveCustomerPhone,
                                    customerEmail: effectiveCustomerEmail,
                                    address,
                                    neighborhood,
                                    cartTotal: total,
                                    itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
                                    topic: ntfyTopic,
                                    reason: 'Cliente solicitou consulta de entrega especial para CEP não atendido',
                                    force: true
                                  });
                                  if (onShowToast) onShowToast('Notificação com seus dados enviada à pizzaria via ntfy!', 'success');
                                }}
                                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-[11px] uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                              >
                                <span>🔔</span>
                                <span>Avisar Pizzaria com meu WhatsApp</span>
                              </button>
                            </div>

                            <button 
                              type="button"
                              onClick={() => setDeliveryType('PICKUP')}
                              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>🏃</span>
                              <span>Mudar pedido para Retirada no Balcão</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-bold">
                            <span className="text-emerald-800 flex items-center gap-1">🛵 Frete Calculado:</span>
                            <span className="text-emerald-700 font-black">R$ {activeDeliveryFee.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cupom de Desconto</h3>
                <div className="flex gap-2">
                  <input 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="CÓDIGO"
                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 uppercase"
                  />
                  <button onClick={handleApplyCoupon} className="bg-red-600 text-white px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors">Aplicar</button>
                </div>
                {appliedCoupon && <p className="text-xs font-bold text-red-600 flex items-center gap-1">✅ Cupom {appliedCoupon.code} aplicado!</p>}
              </div>

              <div ref={observationsRef} className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Observações do Pedido</h3>
                <div className="space-y-2">
                  <textarea 
                    value={orderObservations}
                    onChange={(e) => setOrderObservations(e.target.value)}
                    placeholder="Ex: Sem cebola, caprichar no molho, campainha quebrada..."
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 resize-none shadow-sm"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setOrderObservations('');
                      scrollToSection(paymentRef);
                    }}
                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🚫</span>
                    <span>Sem Observações</span>
                  </button>
                </div>
              </div>

              <div ref={paymentRef} className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pagamento</h3>
                {deliveryType === 'TABLE' ? (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-xs font-bold uppercase tracking-widest text-center">
                    Pagamento realizado no balcão ao finalizar o consumo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {/* MÉTODOS ONLINE */}
                    {paymentSettings.filter(p => p.enabled && (p.type === 'ONLINE' || p.integration === 'MERCADO_PAGO' || p.integration === 'PAGSEGURO')).map(method => (
                      <button 
                        key={method.id}
                        onClick={() => {
                          setPaymentMethod(method.name);
                          scrollToSection(confirmRef);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between shadow-sm ${paymentMethod === method.name ? 'border-red-500 bg-red-50 text-red-700 shadow-red-100' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:text-red-500'}`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                          <span className="text-lg">💳</span> {method.name} {method.integration && method.integration !== 'NONE' ? `- ${method.integration.replace('_', ' ')}` : '- ONLINE'}
                        </span>
                        {paymentMethod === method.name && <span className="text-red-600 font-bold">●</span>}
                      </button>
                    ))}

                    {/* MÉTODOS OFFLINE */}
                    {paymentSettings.filter(p => p.enabled && p.type !== 'ONLINE' && p.integration !== 'MERCADO_PAGO' && p.integration !== 'PAGSEGURO').map(method => (
                      <button 
                        key={method.id}
                        onClick={() => {
                          setPaymentMethod(method.name);
                          scrollToSection(confirmRef);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${paymentMethod === method.name ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200'}`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide">
                          {method.name} 
                          <span className="ml-1 opacity-60 font-bold">
                            {deliveryType === 'PICKUP' ? '(na retirada)' : (deliveryType === 'TABLE' ? '(no balcão)' : '(na entrega)')}
                          </span>
                        </span>
                        {paymentMethod === method.name && <span className="text-red-600">●</span>}
                      </button>
                    ))}
                  </div>
                )}
                {paymentMethod === 'Dinheiro' && (
                  <input 
                    type="number" 
                    placeholder="Troco para quanto?" 
                    value={changeFor || ''} 
                    onChange={(e) => setChangeFor(Number(e.target.value))}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div ref={confirmRef} className="p-6 bg-red-600 border-t border-red-500 space-y-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] z-20 text-white">
            <div className="space-y-2 text-xs font-bold text-red-100">
              <div className="flex justify-between"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
              {deliveryType === 'DELIVERY' && <div className="flex justify-between"><span>Taxa de Entrega</span><span>R$ {activeDeliveryFee.toFixed(2)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-white"><span>Desconto</span><span>- R$ {discount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-lg font-black text-white pt-2 border-t border-red-500 mt-2"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
            </div>

            <button 
              onClick={handleCheckoutClick}
              disabled={isProcessing || !isStoreOpen || isZipOutOfArea}
              className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                isProcessing || !isStoreOpen || isZipOutOfArea 
                  ? 'bg-red-300 text-white cursor-not-allowed' 
                  : 'bg-white text-red-600 hover:bg-red-50 shadow-red-900/20 cursor-pointer'
              }`}
            >
              {isProcessing 
                ? 'Processando...' 
                : (!isStoreOpen 
                    ? 'Loja Fechada' 
                    : (isZipOutOfArea 
                        ? 'CEP Fora da Área de Entrega' 
                        : 'Confirmar Pedido'))}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
