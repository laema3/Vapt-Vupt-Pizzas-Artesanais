
import React from 'react';
import { Order, Table } from '../types';
import { formatOrderNumber } from '../utils/format';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSendWhatsApp: () => void;
  isKioskMode: boolean;
  tables: Table[];
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ isOpen, onClose, order, onSendWhatsApp, isKioskMode, tables }) => {
  if (!isOpen || !order) return null;

  const isTableOrder = order.deliveryType === 'TABLE';
  const table = tables.find(t => t.id === order.tableId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 animate-in zoom-in-95 duration-300 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 animate-bounce">
          {isTableOrder ? '🪑' : '🎉'}
        </div>
        {isTableOrder ? (
          <>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">Mesa {table?.number}</h2>
            <p className="text-slate-500 font-medium mb-6">DIRIJA-SE AO CAIXA PARA EFETUAR O PAGAMENTO.</p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">Pedido Recebido!</h2>
            <p className="text-slate-500 font-medium mb-6">Seu pedido #{order.orderNumber ? formatOrderNumber(order.orderNumber) : order.id.substring(0, 4)} foi registrado com sucesso.</p>
          </>
        )}
        
        {!isKioskMode && (
          <button onClick={onSendWhatsApp} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20 active:scale-95 mb-4 flex items-center justify-center gap-2">
            <span>Enviar no WhatsApp</span>
            <span>📱</span>
          </button>
        )}
        
        <button onClick={onClose} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-slate-200 transition-colors">
          Fechar
        </button>
      </div>
    </div>
  );
};
