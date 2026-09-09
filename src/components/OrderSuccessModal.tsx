
import React from 'react';
import { Order, Table } from '../types';
import { formatOrderNumber } from '../utils/format';
import { OrderCountdownTimer } from './OrderCountdownTimer';
import { printOrderReceipt } from '../utils/printReceipt';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSendWhatsApp: () => void;
  isKioskMode: boolean;
  tables: Table[];
  defaultEstimatedMinutes?: number;
  onViewMyOrders?: () => void;
  storeName?: string;
  socialLinks?: any;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ 
  isOpen, 
  onClose, 
  order, 
  onSendWhatsApp, 
  isKioskMode, 
  tables,
  defaultEstimatedMinutes = 30,
  onViewMyOrders,
  storeName,
  socialLinks
}) => {
  if (!isOpen || !order) return null;

  const isTableOrder = order.deliveryType === 'TABLE';
  const table = tables.find(t => t.id === order.tableId);
  const orderMinutes = order.estimatedMinutes || defaultEstimatedMinutes || 30;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-[36px] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 text-center max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-4 animate-bounce">
          {isTableOrder ? '🪑' : '🎉'}
        </div>

        {isTableOrder ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight mb-1">Mesa {table?.number}</h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm mb-4">DIRIJA-SE AO CAIXA PARA EFETUAR O PAGAMENTO.</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight mb-1">Pedido Registrado!</h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm mb-4">
              Seu pedido #{order.orderNumber ? formatOrderNumber(order.orderNumber) : order.id.substring(0, 4)} já está em nosso sistema.
            </p>
          </>
        )}

        {/* Cronômetro Regressivo no Próprio Pedido */}
        <div className="my-4 text-left">
          <OrderCountdownTimer
            createdAt={order.createdAt}
            estimatedMinutes={orderMinutes}
            status={order.status}
            orderNumber={order.orderNumber ? formatOrderNumber(order.orderNumber) : order.id.substring(0, 4)}
          />
        </div>

        {/* Informações Resumidas do Pedido */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4 text-left">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1">
            <span>Total a Pagar:</span>
            <span className="text-sm font-black text-red-600">R$ {order.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500">
            <span>Pagamento:</span>
            <span className="font-semibold text-slate-700 uppercase">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 mt-0.5">
            <span>Entrega:</span>
            <span className="font-semibold text-slate-700 uppercase">{order.deliveryType}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <button 
            onClick={() => printOrderReceipt(order, storeName, socialLinks)} 
            className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black uppercase text-xs sm:text-sm tracking-wider hover:bg-black transition-colors shadow-lg shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Imprimir Cupom / Pedido</span>
            <span>🖨️</span>
          </button>

          {!isKioskMode && (
            <button 
              onClick={onSendWhatsApp} 
              className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-black uppercase text-xs sm:text-sm tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Enviar no WhatsApp</span>
              <span>📱</span>
            </button>
          )}

          {onViewMyOrders && (
            <button
              onClick={() => {
                onClose();
                onViewMyOrders();
              }}
              className="w-full bg-slate-900 text-white py-3 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-black transition-colors active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📋 Acompanhar em Meus Pedidos</span>
            </button>
          )}
          
          <button 
            onClick={onClose} 
            className="w-full bg-slate-100 text-slate-600 py-3 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Continuar Navegando
          </button>
        </div>
      </div>
    </div>
  );
};
