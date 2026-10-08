
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CartItem, Coupon, PaymentSettings, Customer, DeliveryType, ZipRange, Product, CategoryItem, Order } from '../types';
import { checkZipCoverage, fetchAddressByCep, parseAddressParts, buildFullAddress } from '../utils/zipUtils';
import { sendOutOfAreaNotification } from '../services/ntfyService';
import { SuggestedProductsCarousel } from './SuggestedProductsCarousel';

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
  onOpenScheduleModal?: () => void;
  scheduleAllowed?: boolean;
  allProducts?: Product[];
  categories?: CategoryItem[];
  onAddSuggestedProduct?: (product: Product, quantity: number) => void;
  logoUrl?: string;
  orders?: Order[];
  onSelectScheduledTime?: (time: string | null) => void;
}

const ALL_SCHEDULE_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', 
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', 
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', 
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
];

const getSlotReservedCount = (slot: string, ordersList: Order[] = []) => {
  return ordersList.filter(o => o.scheduledTime === slot && o.status !== 'CANCELADO' && o.status !== 'FINALIZADO').length;
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

export const CartSidebar: React.FC<CartSidebarProps> = ({ 
  isOpen, onClose, items, coupons, onUpdateQuantity, onRemove, onCheckout, onAuthClick, 
  paymentSettings, tables, currentUser, isKioskMode, deliveryFee, availableCoupons, isStoreOpen, isProcessing,
  onShowToast, defaultTableId, isAdmin, forcedDeliveryType, zipRanges = [], ntfyTopic, scheduledTime, onOpenScheduleModal, scheduleAllowed = true,
  allProducts = [], categories = [], onAddSuggestedProduct, logoUrl, orders = [], onSelectScheduledTime
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isCouponConfirmed, setIsCouponConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [changeFor, setChangeFor] = useState<number | undefined>(undefined);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(
    forcedDeliveryType || (defaultTableId ? 'TABLE' : (currentUser ? 'DELIVERY' : null))
  );
  const [isDeliveryConfirmed, setIsDeliveryConfirmed] = useState<boolean>(() => {
    if (defaultTableId) return true;
    if (forcedDeliveryType === 'PICKUP') return true;
    if (currentUser && Boolean((currentUser.address || '').trim())) return true;
    return false;
  });
  const [selectedTableId, setSelectedTableId] = useState<string>(defaultTableId || '');
  const [orderObservations, setOrderObservations] = useState('');
  const [isObservationsConfirmed, setIsObservationsConfirmed] = useState(false);

  // Estados de Agendamento Inline no Checkout
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [customTimeError, setCustomTimeError] = useState('');

  const scheduleRef = useRef<HTMLDivElement>(null);
  const deliveryRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);
  const couponRef = useRef<HTMLDivElement>(null);
  const observationsRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  // Endereço e CEP para entrega
  const [zipCode, setZipCode] = useState(currentUser?.zipCode || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || '');
  const [street, setStreet] = useState(() => currentUser ? parseAddressParts(currentUser.address).street : '');
  const [number, setNumber] = useState(() => currentUser ? parseAddressParts(currentUser.address).number : '');
  const [complement, setComplement] = useState(() => currentUser ? parseAddressParts(currentUser.address).complement : '');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
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
      if (currentUser.zipCode) setZipCode(currentUser.zipCode);
      if (currentUser.address) {
        setAddress(currentUser.address);
        const parts = parseAddressParts(currentUser.address);
        setStreet(parts.street);
        setNumber(parts.number);
        setComplement(parts.complement);
        setIsDeliveryConfirmed(true);
      }
      if (currentUser.neighborhood) setNeighborhood(currentUser.neighborhood);
      if (!forcedDeliveryType && !defaultTableId) {
        setDeliveryType(prev => prev || 'DELIVERY');
      }
    }
  }, [currentUser, isOpen, forcedDeliveryType, defaultTableId]);

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
        setStreet(res.address);
        if (res.neighborhood) {
          setNeighborhood(res.neighborhood);
          foundNeighborhood = res.neighborhood;
        }
        if (res.city) foundCity = res.city;

        const newAddr = buildFullAddress(res.address, number, complement);
        setAddress(newAddr);
        foundAddress = newAddr;

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
    if (currentUser) {
      if (currentUser.zipCode && zipRanges && zipRanges.length > 0) {
        const cleanUserZip = currentUser.zipCode.replace(/\D/g, '');
        if (cleanUserZip.length === 8) {
          return checkZipCoverage(cleanUserZip, zipRanges);
        }
      }
      return { isCovered: true, fee: deliveryFee };
    }
    const targetZip = zipCode || '';
    if (!targetZip) return { isCovered: false, fee: 0 };
    return checkZipCoverage(targetZip, zipRanges);
  }, [deliveryType, zipCode, currentUser, zipRanges, deliveryFee]);

  const cleanCurrentZip = (zipCode || '').replace(/\D/g, '');
  const isZipOutOfArea = deliveryType === 'DELIVERY' && 
                         !currentUser &&
                         cleanCurrentZip.length >= 8 && 
                         zipRanges.length > 0 && 
                         !zipCoverage.isCovered;

  const activeDeliveryFee = useMemo(() => {
    if (deliveryType !== 'DELIVERY') return 0;
    if (currentUser) {
      const userZip = (currentUser.zipCode || zipCode || '').replace(/\D/g, '');
      if (userZip.length === 8 && zipRanges && zipRanges.length > 0) {
        const cov = checkZipCoverage(userZip, zipRanges);
        if (cov.isCovered && cov.fee !== undefined) return cov.fee;
      }
      return deliveryFee;
    }
    const targetZip = zipCode || '';
    if (!targetZip) return (zipRanges && zipRanges.length > 0 ? 0 : deliveryFee);
    return zipCoverage.fee;
  }, [deliveryType, zipCode, currentUser, zipRanges, zipCoverage, deliveryFee]);

  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discount = appliedCoupon ? (appliedCoupon.type === 'PERCENT' ? subtotal * (appliedCoupon.discount / 100) : appliedCoupon.discount) : 0;
  const total = subtotal + (deliveryType === 'DELIVERY' ? activeDeliveryFee : 0) - discount;

  const isAddressFilled = useMemo(() => {
    if (deliveryType === 'PICKUP' || deliveryType === 'TABLE') return true;
    if (deliveryType === 'DELIVERY') {
      if (currentUser) {
        // Usuário logado: usa o endereço já cadastrado no perfil sem exigir digitação de CEP
        return Boolean((street || address || currentUser.address || '').trim());
      }
      return Boolean(
        guestName.trim() && 
        guestPhone.trim() && 
        (street.trim() || address.trim()) && 
        (number.trim() || complement.trim()) && 
        neighborhood.trim() && 
        zipCode.trim()
      );
    }
    return false;
  }, [deliveryType, currentUser, street, address, guestName, guestPhone, number, complement, neighborhood, zipCode]);

  // Modo agendamento: se loja fechada ou se horário estiver preenchido ou se modalidade de agendamento estiver ativa
  const isSchedulingRequired = (!isStoreOpen || Boolean(scheduledTime) || isSchedulingOpen) && scheduleAllowed;
  const isScheduleSelected = isSchedulingRequired ? Boolean(scheduledTime) : true;
  const isCouponSelected = Boolean(appliedCoupon || isCouponConfirmed);
  const isObservationsSelected = Boolean(isObservationsConfirmed || orderObservations.trim());
  const isPaymentSelected = Boolean(paymentMethod);

  const isAllOptionsFilled = Boolean(
    deliveryType && 
    isDeliveryConfirmed &&
    isAddressFilled && 
    isScheduleSelected && 
    isCouponSelected && 
    isObservationsSelected && 
    isPaymentSelected
  );

  const handleSelectSlot = (slot: string) => {
    const count = getSlotReservedCount(slot, orders);
    if (count >= 4) {
      const msg = `⚠️ Este horário (${slot}) já atingiu a capacidade máxima de pedidos. Por favor, escolha outro horário.`;
      alert(msg);
      if (onShowToast) onShowToast(msg, 'error');
      return;
    }
    if (isSlotPassed(slot)) {
      const msg = `⚠️ Este horário (${slot}) já passou. Por favor, escolha um horário disponível.`;
      alert(msg);
      if (onShowToast) onShowToast(msg, 'error');
      return;
    }
    if (onSelectScheduledTime) {
      onSelectScheduledTime(slot);
    }
    setIsSchedulingOpen(false);
    if (onShowToast) {
      onShowToast(`Horário agendado para às ${slot} (Entrega às ${getDeliveryTime(slot)})!`, 'success');
    }
    // Rola automaticamente para a próxima opção: Tipo de Entrega!
    scrollToSection(deliveryRef);
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

    handleSelectSlot(closestSlot);
  };

  const handleApplyCoupon = () => {
    const coupon = coupons.find(c => c.code === couponCode && c.active);
    if (coupon) {
      setAppliedCoupon(coupon);
      setIsCouponConfirmed(true);
      if (onShowToast) onShowToast('Cupom aplicado com sucesso!', 'success');
      // Rola automaticamente para a próxima opção: Observações
      scrollToSection(observationsRef);
    } else {
      const msg = '⚠️ Cupom inválido ou expirado';
      alert(msg);
      if (onShowToast) onShowToast(msg, 'error');
    }
  };

  const handleCheckoutClick = () => {
    const missingItems: string[] = [];
    let firstPendingRef: React.RefObject<HTMLDivElement | null> | null = null;

    // 1. Validação de horário no agendamento
    if (isSchedulingRequired && !scheduledTime) {
      missingItems.push('Horário de Agendamento');
      if (!firstPendingRef) firstPendingRef = scheduleRef;
    }

    // 2. Tipo e confirmação de entrega
    if (!deliveryType || !isDeliveryConfirmed) {
      missingItems.push('Tipo de Entrega e Confirmação de Endereço');
      if (!firstPendingRef) firstPendingRef = deliveryRef;
    }

    // 3. Cupom de desconto
    if (!appliedCoupon && !isCouponConfirmed) {
      missingItems.push('Cupom de Desconto (aplique o cupom ou clique em "Não tenho cupom")');
      if (!firstPendingRef) firstPendingRef = couponRef;
    }

    // 4. Observações do pedido
    if (!isObservationsConfirmed && !orderObservations.trim()) {
      missingItems.push('Observações do Pedido (salve suas instruções ou clique em "Sem Observações")');
      if (!firstPendingRef) firstPendingRef = observationsRef;
    }

    // 5. Forma de pagamento
    if (!paymentMethod) {
      missingItems.push('Forma de Pagamento (Pix, Cartão ou Dinheiro)');
      if (!firstPendingRef) firstPendingRef = paymentRef;
    }

    if (missingItems.length > 0) {
      const msg = `⚠️ Favor preencher e confirmar todas as opções antes de concluir o agendamento/pedido:\n\n• ${missingItems.join('\n• ')}`;
      try {
        alert(msg);
      } catch (_e) { void _e; }
      if (onShowToast) onShowToast(`⚠️ Opção pendente: ${missingItems[0]}`, 'error');
      if (firstPendingRef) {
        if (firstPendingRef === scheduleRef) setIsSchedulingOpen(true);
        scrollToSection(firstPendingRef);
      }
      return;
    }

    // 2. Tipo de entrega
    if (!deliveryType) {
      const msg = '⚠️ Favor selecionar a forma de entrega (Delivery ou Retirada).';
      try { alert(msg); } catch (_e) { void _e; }
      if (onShowToast) onShowToast(msg, 'error');
      scrollToSection(deliveryRef);
      return;
    }

    const effectiveStreet = (street || '').trim();
    const effectiveNumber = (number || '').trim();
    const finalAddress = buildFullAddress(effectiveStreet, effectiveNumber, complement) || address.trim() || currentUser?.address || '';

    // 3. Endereço de entrega se for delivery
    if (deliveryType === 'DELIVERY') {
      if (currentUser) {
        // Cliente logado: usa o endereço já cadastrado no perfil sem exigir digitação de CEP
        if (!finalAddress) {
          const msg = '⚠️ Por favor, informe seu endereço para a entrega.';
          alert(msg);
          if (onShowToast) onShowToast(msg, 'error');
          scrollToSection(addressRef);
          return;
        }
      } else {
        // Cliente NÃO logado: exige Nome, WhatsApp, CEP e endereço completo
        if (!guestName.trim() || !guestPhone.trim()) {
          const msg = '⚠️ Favor informar seu Nome e WhatsApp para contato da entrega.';
          alert(msg);
          if (onShowToast) onShowToast(msg, 'error');
          scrollToSection(addressRef);
          return;
        }

        if (!zipCode || !effectiveStreet || !effectiveNumber || !neighborhood) {
          const msg = !effectiveNumber 
            ? '⚠️ Por favor, informe o número da sua residência para a entrega.' 
            : '⚠️ Favor preencher o CEP e o endereço completo para entrega.';
          alert(msg);
          if (onShowToast) onShowToast(msg, 'error');
          scrollToSection(addressRef);
          return;
        }

        if (zipRanges.length > 0 && !zipCoverage.isCovered) {
          // Envia notificação imediata via ntfy ao lojista informando a tentativa de pedido com CEP não atendido
          sendOutOfAreaNotification({
            zipCode,
            customerName: effectiveCustomerName,
            customerPhone: effectiveCustomerPhone,
            customerEmail: effectiveCustomerEmail,
            address: finalAddress,
            neighborhood,
            cartTotal: total,
            itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
            topic: ntfyTopic,
            reason: 'Tentativa de concluir pedido com CEP fora da área',
            force: true
          });

          const msg = `Infelizmente não realizamos entregas para o CEP ${zipCode} (fora da nossa área de atendimento). Por favor, altere para Retirada no Balcão para concluir seu pedido.`;
          alert(msg);
          if (onShowToast) onShowToast(msg, 'error');
          scrollToSection(deliveryRef);
          return;
        }
      }
    }

    if (deliveryType === 'TABLE' && !selectedTableId) {
      const msg = '⚠️ Favor selecionar o número da mesa.';
      alert(msg);
      if (onShowToast) onShowToast(msg, 'error');
      scrollToSection(deliveryRef);
      return;
    }

    // 4. Cupom de desconto
    if (!appliedCoupon && !isCouponConfirmed) {
      const msg = '⚠️ Favor aplicar um cupom de desconto ou confirmar clicando em "Não tenho cupom".';
      alert(msg);
      if (onShowToast) onShowToast(msg, 'error');
      scrollToSection(couponRef);
      return;
    }

    // 5. Observações do pedido
    if (!isObservationsConfirmed && !orderObservations.trim()) {
      const msg = '⚠️ Favor preencher as observações ou clicar em "Sem Observações" para confirmar.';
      alert(msg);
      if (onShowToast) onShowToast(msg, 'error');
      scrollToSection(observationsRef);
      return;
    }

    // 6. Forma de pagamento
    if (!paymentMethod) {
      const msg = '⚠️ Favor selecionar a forma de pagamento (Pix, Cartão ou Dinheiro).';
      alert(msg);
      if (onShowToast) onShowToast(msg, 'error');
      scrollToSection(paymentRef);
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

    const deliveryAddressInfo = deliveryType === 'DELIVERY' ? { 
      address: finalAddress, 
      neighborhood: neighborhood || currentUser?.neighborhood || '', 
      zipCode: zipCode || currentUser?.zipCode || '' 
    } : undefined;

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

              {/* Sugestões de outros itens no carrinho */}
              {allProducts && allProducts.length > 0 && (
                <div className="pt-2">
                  <div className="bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5 p-3 rounded-2xl border border-amber-200/60 shadow-xs">
                    <SuggestedProductsCarousel
                      allProducts={allProducts}
                      categories={categories}
                      onAddProduct={(prod, qty) => {
                        if (onAddSuggestedProduct) {
                          onAddSuggestedProduct(prod, qty);
                        }
                      }}
                      onUpdateQuantity={(id, delta) => onUpdateQuantity(id, delta)}
                      cartItems={items}
                      title="Outros itens que você pode gostar"
                      subtitle="Aproveite para incluir bebidas geladas ou sobremesas no seu pedido"
                      logoUrl={logoUrl}
                    />
                  </div>
                </div>
              )}
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

              <div ref={scheduleRef} className="space-y-3">
                <div className="bg-amber-50/80 p-4 rounded-2xl border-2 border-amber-200/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-amber-950 uppercase tracking-widest flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Horário do Pedido {isSchedulingRequired && <span className="text-red-600">*</span>}</span>
                    </h3>
                    {scheduledTime ? (
                      <button
                        type="button"
                        onClick={() => setIsSchedulingOpen(prev => !prev)}
                        className="text-[10px] font-black text-amber-900 hover:text-amber-950 underline uppercase cursor-pointer"
                      >
                        {isSchedulingOpen ? 'Fechar Lista' : 'Alterar Horário'}
                      </button>
                    ) : (
                      <span className="text-[9px] font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full uppercase">
                        {isStoreOpen ? 'Opcional' : 'Obrigatório'}
                      </span>
                    )}
                  </div>

                  {scheduledTime ? (
                    <div className="bg-white p-3 rounded-xl border border-amber-300 flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          ⏰ Agendado para às <strong className="text-red-600 text-sm font-black">{scheduledTime}</strong>
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                          Entrega/Preparo prevista para às {getDeliveryTime(scheduledTime)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectScheduledTime) onSelectScheduledTime(null);
                          setIsSchedulingOpen(true);
                        }}
                        className="text-[10px] font-black text-red-600 hover:text-red-800 underline uppercase cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-amber-900 leading-snug">
                        {isStoreOpen 
                          ? 'Deseja agendar para um horário específico ou pedir para entrega imediata?'
                          : 'A pizzaria está preparando a fornada. Selecione um horário para agendar seu pedido:'}
                      </p>
                      {isStoreOpen && (
                        <div className="flex gap-2 pb-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectScheduledTime) onSelectScheduledTime(null);
                              setIsSchedulingOpen(false);
                              scrollToSection(deliveryRef);
                            }}
                            className="flex-1 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm"
                          >
                            ⚡ Pedido Imediato
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSchedulingOpen(true)}
                            className="flex-1 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm"
                          >
                            📅 Escolher Horário
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de Horários Disponíveis */}
                  {(!scheduledTime || isSchedulingOpen || !isStoreOpen) && (
                    <div className="space-y-3 pt-2 border-t border-amber-200/60 animate-in fade-in duration-200">
                      <div className="bg-white border border-amber-200 p-2.5 rounded-xl space-y-1.5 shadow-xs">
                        <label className="text-[10px] font-black uppercase text-slate-700 block">
                          Ou digite o horário desejado (Ex: 19:15):
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="HH:MM"
                            maxLength={5}
                            value={customTimeInput}
                            onChange={(e) => setCustomTimeInput(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 w-24 text-center focus:ring-1 focus:ring-red-500"
                          />
                          <button
                            type="button"
                            onClick={handleCustomTimeSubmit}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Confirmar Horário
                          </button>
                        </div>
                        {customTimeError && (
                          <p className="text-red-600 text-[10px] font-bold mt-1">⚠️ {customTimeError}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1 bg-white/80 rounded-xl border border-amber-200/50">
                        {ALL_SCHEDULE_HOURS.map(slot => {
                          const count = getSlotReservedCount(slot, orders);
                          const remaining = 4 - count;
                          const isFull = remaining <= 0;
                          const passed = isSlotPassed(slot);
                          const isDisabled = isFull || passed;
                          const isSelected = scheduledTime === slot;

                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => handleSelectSlot(slot)}
                              disabled={isDisabled}
                              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-red-600 text-white border-red-700 font-black shadow-sm ring-2 ring-red-400'
                                  : isDisabled
                                    ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed text-[10px]'
                                    : 'bg-white hover:bg-red-50 border-slate-200 text-slate-800 font-bold hover:border-red-300'
                              }`}
                            >
                              <span className="block text-xs font-black">{slot}</span>
                              <span className="block text-[8px] opacity-75">
                                {isFull ? 'Esgotado' : passed ? 'Passou' : `${remaining} vagas`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div ref={deliveryRef} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Entrega</h3>
                  {deliveryType && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      ✓ Selecionado: {deliveryType === 'DELIVERY' ? 'Delivery' : deliveryType === 'PICKUP' ? 'Retirada' : 'Mesa'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {!defaultTableId && (
                    <>
                      <button 
                        type="button"
                        onClick={() => {
                          setDeliveryType('DELIVERY');
                          if (currentUser) {
                            scrollToSection(couponRef);
                          } else {
                            scrollToSection(addressRef);
                          }
                        }} 
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between shadow-sm cursor-pointer ${deliveryType === 'DELIVERY' ? 'border-red-500 bg-red-50 text-red-700 shadow-red-100' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:text-red-500'}`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                          <span className="text-lg">🛵</span> Delivery
                        </span>
                        {deliveryType === 'DELIVERY' && <span className="text-red-600 font-bold">●</span>}
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setDeliveryType('PICKUP');
                          setIsDeliveryConfirmed(true);
                          if (onShowToast) onShowToast('Retirada no Balcão selecionada!', 'success');
                          scrollToSection(couponRef);
                        }} 
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between shadow-sm cursor-pointer ${deliveryType === 'PICKUP' ? 'border-red-500 bg-red-50 text-red-700 shadow-red-100' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:text-red-500'}`}
                      >
                        <span className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                          <span className="text-lg">🏃</span> Retirada
                        </span>
                        {deliveryType === 'PICKUP' && <span className="text-red-600 font-bold">●</span>}
                      </button>
                    </>
                  )}
                </div>

                {deliveryType === 'PICKUP' && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-2 mt-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-emerald-800 uppercase flex items-center gap-1.5">
                        <span>🛍️</span> Retirada no Balcão
                      </span>
                      <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full uppercase">
                        Confirmado • Sem Frete
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Você irá retirar seu pedido diretamente em nosso balcão quando estiver pronto.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeliveryConfirmed(true);
                        scrollToSection(couponRef);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 rounded-xl uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                    >
                      ✓ Confirmar Retirada e Ir para Cupom →
                    </button>
                  </div>
                )}

                {deliveryType === 'DELIVERY' && (
                  <div ref={addressRef} className="bg-white p-4 rounded-2xl border border-red-200 space-y-3 mt-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">📍 Endereço de Entrega</h4>
                      {isFetchingAddress && <span className="text-[10px] font-bold text-red-600 animate-pulse">Buscando CEP...</span>}
                    </div>

                    {currentUser && (
                      <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-100 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">👤</span>
                            <div>
                              <span className="font-black text-slate-800 uppercase block text-[11px]">
                                {currentUser.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold">
                                📞 {currentUser.phone}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Conectado
                          </span>
                        </div>

                        {!isEditingAddress ? (
                          <div className="pt-2 border-t border-red-100 flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 text-xs">
                                  📍 {street ? `${street}${number ? `, ${number}` : ''}${complement ? ` - ${complement}` : ''}` : (currentUser.address || 'Endereço cadastrado')}
                                </p>
                                {(neighborhood || currentUser.neighborhood) && (
                                  <p className="text-[10px] font-bold text-slate-500 truncate">
                                    {neighborhood || currentUser.neighborhood}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsEditingAddress(true)}
                                className="text-[10px] font-black text-red-600 hover:text-red-800 underline uppercase cursor-pointer shrink-0"
                              >
                                Alterar
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsDeliveryConfirmed(true);
                                if (onShowToast) onShowToast('Endereço confirmado com sucesso!', 'success');
                                scrollToSection(couponRef);
                              }}
                              className="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <span>✓ Confirmar Endereço e Ir para Cupom →</span>
                            </button>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-red-100 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-700 uppercase">Alterar Endereço de Entrega:</span>
                              <button
                                type="button"
                                onClick={() => setIsEditingAddress(false)}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline uppercase cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                                Rua / Logradouro <span className="text-red-600">*</span>
                              </label>
                              <input 
                                type="text" 
                                value={street} 
                                onChange={e => {
                                  const s = e.target.value;
                                  setStreet(s);
                                  setAddress(buildFullAddress(s, number, complement));
                                }} 
                                placeholder="Ex: Rua das Flores" 
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest block mb-1 text-red-600">
                                  Número <span className="text-red-600">*</span>
                                </label>
                                <input 
                                  type="text" 
                                  value={number} 
                                  onChange={e => {
                                    const n = e.target.value;
                                    setNumber(n);
                                    setAddress(buildFullAddress(street, n, complement));
                                  }} 
                                  placeholder="Ex: 123" 
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                                  Complemento
                                </label>
                                <input 
                                  type="text" 
                                  value={complement} 
                                  onChange={e => {
                                    const c = e.target.value;
                                    setComplement(c);
                                    setAddress(buildFullAddress(street, number, c));
                                  }} 
                                  placeholder="Apto, Bloco..." 
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                                Bairro <span className="text-red-600">*</span>
                              </label>
                              <input 
                                type="text" 
                                value={neighborhood} 
                                onChange={e => setNeighborhood(e.target.value)} 
                                placeholder="Centro" 
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!street.trim() || !number.trim() || !neighborhood.trim()) {
                                  const msg = '⚠️ Favor preencher Rua, Número e Bairro do endereço.';
                                  try { alert(msg); } catch (_e) { void _e; }
                                  if (onShowToast) onShowToast(msg, 'error');
                                  return;
                                }
                                setIsEditingAddress(false);
                                setIsDeliveryConfirmed(true);
                                if (onShowToast) onShowToast('Endereço atualizado com sucesso!', 'success');
                                scrollToSection(couponRef);
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                            >
                              ✓ Salvar Endereço e Ir para Cupom →
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {!currentUser && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-slate-100">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Seu Nome <span className="text-red-600">*</span></label>
                            <input 
                              type="text" 
                              value={guestName} 
                              onChange={e => handleGuestNameChange(e.target.value)} 
                              placeholder="Nome Completo" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">WhatsApp <span className="text-red-600">*</span></label>
                            <input 
                              type="tel" 
                              value={guestPhone} 
                              onChange={e => handleGuestPhoneChange(e.target.value)} 
                              placeholder="(34) 99999-0000" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                            CEP <span className="text-red-600">*</span>
                          </label>
                          <input 
                            type="text" 
                            value={zipCode} 
                            onChange={e => handleZipCodeChange(e.target.value)} 
                            placeholder="Ex: 38000-000" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                            Rua / Logradouro <span className="text-red-600">*</span>
                          </label>
                          <input 
                            type="text" 
                            value={street} 
                            onChange={e => {
                              const s = e.target.value;
                              setStreet(s);
                              setAddress(buildFullAddress(s, number, complement));
                            }} 
                            placeholder="Ex: Rua das Flores" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest block mb-1 text-red-600">
                              Número <span className="text-red-600">*</span>
                            </label>
                            <input 
                              type="text" 
                              value={number} 
                              onChange={e => {
                                const n = e.target.value;
                                setNumber(n);
                                setAddress(buildFullAddress(street, n, complement));
                              }} 
                              placeholder="Ex: 123" 
                              className="w-full bg-slate-50 border-2 border-red-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                              Complemento
                            </label>
                            <input 
                              type="text" 
                              value={complement} 
                              onChange={e => {
                                const c = e.target.value;
                                setComplement(c);
                                setAddress(buildFullAddress(street, number, c));
                              }} 
                              placeholder="Apto, Bloco..." 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                            Bairro <span className="text-red-600">*</span>
                          </label>
                          <input 
                            type="text" 
                            value={neighborhood} 
                            onChange={e => setNeighborhood(e.target.value)} 
                            placeholder="Centro" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!guestName.trim() || !guestPhone.trim() || !zipCode || !street.trim() || !number.trim() || !neighborhood.trim()) {
                              const msg = '⚠️ Favor preencher todos os dados de entrega obrigatórios (Nome, WhatsApp, CEP, Rua, Número e Bairro).';
                              try { alert(msg); } catch (_e) { void _e; }
                              if (onShowToast) onShowToast(msg, 'error');
                              return;
                            }
                            if (zipRanges.length > 0 && !zipCoverage.isCovered) {
                              const msg = `⚠️ O CEP ${zipCode} está fora da nossa área de entrega cadastrada. Favor alterar para Retirada no Balcão.`;
                              try { alert(msg); } catch (_e) { void _e; }
                              if (onShowToast) onShowToast(msg, 'error');
                              return;
                            }
                            setIsDeliveryConfirmed(true);
                            if (onShowToast) onShowToast('Endereço confirmado com sucesso!', 'success');
                            scrollToSection(couponRef);
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-950 text-white font-black text-xs py-2.5 rounded-xl uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <span>✓ Confirmar Endereço e Ir para Cupom →</span>
                        </button>
                      </div>
                    )}
                    {!currentUser && zipCode && (
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
              {/* Seção Cupom de Desconto - SUPER DESTACADA COM COR DIFERENCIADA */}
              <div 
                ref={couponRef} 
                className="space-y-3.5 p-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 text-white border-2 border-amber-400 shadow-xl shadow-purple-950/40 relative overflow-hidden transition-all duration-300"
              >
                {/* Efeito visual decorativo */}
                <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm tracking-wider">
                      🏷️ DESTAQUE
                    </span>
                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-300 drop-shadow-sm">
                      Cupom de Desconto
                    </h3>
                  </div>
                  {appliedCoupon ? (
                    <span className="text-[10px] font-black text-emerald-300 bg-emerald-950/80 border border-emerald-400/50 px-2 py-0.5 rounded-full">
                      ✓ Ativo: {appliedCoupon.code}
                    </span>
                  ) : isCouponConfirmed ? (
                    <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                      ✓ Sem cupom
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-amber-300 bg-amber-950/80 border border-amber-400/50 px-2 py-0.5 rounded-full animate-pulse">
                      ⚠️ Confirmação obrigatória
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-purple-200/90 leading-tight font-medium">
                  Aproveite para economizar! Digite seu cupom ou confirme a opção sem cupom para avançar.
                </p>

                <div className="flex gap-2">
                  <input 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="DIGITE SEU CUPOM"
                    className="flex-1 bg-white text-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-black placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none uppercase tracking-wider shadow-inner"
                  />
                  <button 
                    type="button"
                    onClick={handleApplyCoupon}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-md shadow-amber-950/30"
                  >
                    Aplicar
                  </button>
                </div>

                {appliedCoupon && (
                  <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-300 flex items-center gap-1">
                      🎉 Cupom <strong>{appliedCoupon.code}</strong> aplicado (-R$ {discount.toFixed(2)})!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode('');
                        setIsCouponConfirmed(false);
                      }}
                      className="text-[10px] text-red-300 hover:text-red-100 underline font-bold cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-purple-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!deliveryType || !isDeliveryConfirmed) {
                        const msg = '⚠️ Favor confirmar o tipo e endereço de entrega antes de avançar do cupom.';
                        try { alert(msg); } catch (_e) { void _e; }
                        if (onShowToast) onShowToast(msg, 'error');
                        scrollToSection(deliveryRef);
                        return;
                      }
                      setAppliedCoupon(null);
                      setIsCouponConfirmed(true);
                      if (onShowToast) onShowToast('Opção sem cupom confirmada!', 'success');
                      scrollToSection(observationsRef);
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                      isCouponConfirmed && !appliedCoupon
                        ? 'bg-purple-800/90 text-white border-amber-400'
                        : 'bg-white/10 hover:bg-white/20 text-purple-100 border-white/20'
                    }`}
                  >
                    <span>🚫 Continuar Sem Cupom</span>
                    <span>→</span>
                  </button>

                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCouponConfirmed(true);
                        scrollToSection(observationsRef);
                      }}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md"
                    >
                      <span>✓ Confirmar Cupom e Avançar</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Seção Observações do Pedido */}
              <div ref={observationsRef} className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    <span>📝</span> Observações do Pedido
                  </h3>
                  {isObservationsConfirmed ? (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      ✓ Confirmado {orderObservations.trim() ? '(com notas)' : '(sem notas)'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      ⚠️ Confirmação obrigatória
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <textarea 
                    value={orderObservations}
                    onChange={(e) => {
                      setOrderObservations(e.target.value);
                      setIsObservationsConfirmed(false);
                    }}
                    placeholder="Ex: Sem cebola, caprichar no orégano, ponto da massa bem assada..."
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        if (!isCouponConfirmed && !appliedCoupon) {
                          const msg = '⚠️ Favor confirmar o Cupom de Desconto antes de avançar as observações.';
                          try { alert(msg); } catch (_e) { void _e; }
                          if (onShowToast) onShowToast(msg, 'error');
                          scrollToSection(couponRef);
                          return;
                        }
                        setOrderObservations('');
                        setIsObservationsConfirmed(true);
                        if (onShowToast) onShowToast('Confirmado sem observações!', 'success');
                        scrollToSection(paymentRef);
                      }}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 border border-slate-200"
                    >
                      <span>🚫 Sem Observações</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (!isCouponConfirmed && !appliedCoupon) {
                          const msg = '⚠️ Favor confirmar o Cupom de Desconto antes de avançar as observações.';
                          try { alert(msg); } catch (_e) { void _e; }
                          if (onShowToast) onShowToast(msg, 'error');
                          scrollToSection(couponRef);
                          return;
                        }
                        setIsObservationsConfirmed(true);
                        if (onShowToast) onShowToast(orderObservations.trim() ? 'Observações salvas!' : 'Confirmado sem observações!', 'success');
                        scrollToSection(paymentRef);
                      }}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm active:scale-95"
                    >
                      <span>✓ Salvar e Ir para Pagamento →</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Seção Pagamento */}
              <div ref={paymentRef} className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    <span>💳</span> Forma de Pagamento
                  </h3>
                  {paymentMethod ? (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      ✓ {paymentMethod}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      ⚠️ Seleção obrigatória
                    </span>
                  )}
                </div>
                {deliveryType === 'TABLE' ? (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-xs font-bold uppercase tracking-widest text-center">
                    Pagamento realizado no balcão ao finalizar o consumo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {/* MÉTODOS ONLINE */}
                    {paymentSettings.filter(p => p.enabled && (p.type === 'ONLINE' || p.integration === 'MERCADO_PAGO' || p.integration === 'PAGSEGURO')).map(method => (
                      <button 
                        type="button"
                        key={method.id}
                        onClick={() => {
                          if (!isObservationsConfirmed && !orderObservations.trim()) {
                            const msg = '⚠️ Favor confirmar as Observações do pedido antes de escolher o pagamento.';
                            try { alert(msg); } catch (_e) { void _e; }
                            if (onShowToast) onShowToast(msg, 'error');
                            scrollToSection(observationsRef);
                            return;
                          }
                          setPaymentMethod(method.name);
                          if (onShowToast) onShowToast(`Pagamento selecionado: ${method.name}`, 'success');
                          scrollToSection(confirmRef);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between shadow-sm cursor-pointer ${paymentMethod === method.name ? 'border-red-500 bg-red-50 text-red-700 shadow-red-100' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:text-red-500'}`}
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
                        type="button"
                        key={method.id}
                        onClick={() => {
                          if (!isObservationsConfirmed && !orderObservations.trim()) {
                            const msg = '⚠️ Favor confirmar as Observações do pedido antes de escolher o pagamento.';
                            try { alert(msg); } catch (_e) { void _e; }
                            if (onShowToast) onShowToast(msg, 'error');
                            scrollToSection(observationsRef);
                            return;
                          }
                          setPaymentMethod(method.name);
                          if (method.name !== 'Dinheiro') {
                            if (onShowToast) onShowToast(`Pagamento selecionado: ${method.name}`, 'success');
                            scrollToSection(confirmRef);
                          }
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${paymentMethod === method.name ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-100 bg-white text-slate-500 hover:border-red-200'}`}
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
                  <div className="space-y-1.5 pt-1 animate-in fade-in">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Troco para quanto? (Deixe em branco se não precisar)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Ex: 50 ou 100" 
                        value={changeFor || ''} 
                        onChange={(e) => setChangeFor(Number(e.target.value))}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        type="button"
                        onClick={() => scrollToSection(confirmRef)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase rounded-xl cursor-pointer shadow-sm"
                      >
                        Avançar
                      </button>
                    </div>
                  </div>
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
              type="button"
              onClick={handleCheckoutClick}
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                isProcessing
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : !isAllOptionsFilled
                    ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-amber-400/25 ring-2 ring-amber-500/60'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/30 ring-4 ring-emerald-500/30'
              }`}
            >
              {isProcessing ? (
                <span>Processando...</span>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span>{isAllOptionsFilled ? '✓' : '⚠️'}</span>
                    <span>{scheduledTime ? `Confirmar Agendamento (${scheduledTime})` : 'Confirmar Pedido'}</span>
                  </div>
                  {!isAllOptionsFilled ? (
                    <span className="text-[10px] opacity-90 font-bold lowercase tracking-normal">
                      (clique para ver opções pendentes)
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-100 font-bold lowercase tracking-normal">
                      (tudo pronto! clique para finalizar)
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
