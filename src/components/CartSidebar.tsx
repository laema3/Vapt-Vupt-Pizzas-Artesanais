
import React, { useState, useEffect, useMemo } from 'react';
import { CartItem, Coupon, PaymentSettings, Customer, DeliveryType, ZipRange } from '../types';
import { calculateDeliveryFeeForZip, fetchAddressByCep } from '../utils/zipUtils';

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
    deliveryAddressInfo?: { address: string; neighborhood: string; zipCode: string }
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
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ 
  isOpen, onClose, items, coupons, onUpdateQuantity, onRemove, onCheckout, onAuthClick, 
  paymentSettings, tables, currentUser, isKioskMode, deliveryFee, availableCoupons, isStoreOpen, isProcessing,
  onShowToast, defaultTableId, isAdmin, forcedDeliveryType, zipRanges = []
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [changeFor, setChangeFor] = useState<number | undefined>(undefined);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(defaultTableId ? 'TABLE' : null);
  const [selectedTableId, setSelectedTableId] = useState<string>(defaultTableId || '');

  // Endereço e CEP para entrega
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

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
      if (res && res.address) {
        setAddress(res.address);
        if (res.neighborhood) setNeighborhood(res.neighborhood);
        if (onShowToast) onShowToast('Endereço localizado pelo CEP!', 'success');
      } else if (res && res.error) {
        if (onShowToast) onShowToast('CEP não localizado no sistema de Correios.', 'error');
      }
    }
  };

  // Cálculo dinâmico do valor do frete
  const activeDeliveryFee = useMemo(() => {
    if (deliveryType !== 'DELIVERY') return 0;
    const targetZip = zipCode || currentUser?.zipCode || '';
    if (!targetZip) return deliveryFee; // fallback para deliveryFee vindo do App se nenhum CEP fornecido
    const calculated = calculateDeliveryFeeForZip(targetZip, zipRanges);
    return calculated > 0 ? calculated : deliveryFee;
  }, [deliveryType, zipCode, currentUser, zipRanges, deliveryFee]);

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
      deliveryAddressInfo
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
              {items.map(item => (
                <div key={item.id} className="flex gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-20 h-20 bg-white rounded-xl shrink-0 overflow-hidden p-1 flex items-center justify-center border border-slate-100">
                    {item.image ? <img src={item.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : <span className="text-2xl flex items-center justify-center h-full">🍔</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-slate-800 text-sm uppercase truncate pr-2">{item.name}</h4>
                      <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                    </div>
                    <p className="text-red-600 font-black text-xs mb-2">R$ {item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-3 bg-white w-fit px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                      <button onClick={() => onUpdateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 font-black">-</button>
                      <span className="text-xs font-black text-slate-800 w-4 text-center">{item.quantity}</span>
                      <button onClick={() => onUpdateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 font-black">+</button>
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
                        onClick={() => setDeliveryType('DELIVERY')} 
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between shadow-sm ${deliveryType === 'DELIVERY' ? 'border-red-500 bg-red-50 text-red-700 shadow-red-100' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:text-red-500'}`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                          <span className="text-lg">🛵</span> Delivery
                        </span>
                        {deliveryType === 'DELIVERY' && <span className="text-red-600 font-bold">●</span>}
                      </button>
                      <button 
                        onClick={() => setDeliveryType('PICKUP')} 
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
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600">Frete Calculado:</span>
                        <span className="text-red-600 font-black">R$ {activeDeliveryFee.toFixed(2)}</span>
                      </div>
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

              <div className="space-y-3">
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
                        onClick={() => setPaymentMethod(method.name)}
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
                        onClick={() => setPaymentMethod(method.name)}
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
          <div className="p-6 bg-red-600 border-t border-red-500 space-y-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] z-20 text-white">
            <div className="space-y-2 text-xs font-bold text-red-100">
              <div className="flex justify-between"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
              {deliveryType === 'DELIVERY' && <div className="flex justify-between"><span>Taxa de Entrega</span><span>R$ {activeDeliveryFee.toFixed(2)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-white"><span>Desconto</span><span>- R$ {discount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-lg font-black text-white pt-2 border-t border-red-500 mt-2"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
            </div>

            <button 
              onClick={handleCheckoutClick}
              disabled={isProcessing || !isStoreOpen}
              className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest text-red-600 shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isProcessing || !isStoreOpen ? 'bg-red-300 cursor-not-allowed' : 'bg-white hover:bg-red-50 shadow-red-900/20'}`}
            >
              {isProcessing ? 'Processando...' : (isStoreOpen ? 'Confirmar Pedido' : 'Loja Fechada')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
