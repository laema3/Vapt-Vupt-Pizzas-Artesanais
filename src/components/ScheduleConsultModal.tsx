import React from 'react';
import { Order } from '../types';

interface ScheduleConsultModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

const ALL_HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export const ScheduleConsultModal: React.FC<ScheduleConsultModalProps> = ({
  isOpen,
  onClose,
  orders = []
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col transform animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 p-6 text-white text-center relative">
          <h2 className="text-2xl font-black uppercase tracking-tight">Consulta de Agendamentos</h2>
          <p className="text-white/90 text-xs mt-1 font-medium">Horários disponíveis e agendados para hoje</p>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/25 hover:bg-white/40 text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {ALL_HOURS.map(slot => {
              const matchedOrder = orders.find(o => o.scheduledTime === slot && o.status !== 'CANCELADO' && o.status !== 'FINALIZADO');
              const isReserved = !!matchedOrder;

              return (
                <div 
                  key={slot} 
                  className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                    isReserved 
                      ? 'bg-red-50 border-red-200 text-red-900' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm">🕒 {slot}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isReserved ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                      {isReserved ? 'Reservado' : 'Disponível'}
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] font-semibold opacity-80">
                    {isReserved ? `Cliente: ${matchedOrder?.customerName || 'Reservado'}` : 'Entrega em 2h'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-950 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
