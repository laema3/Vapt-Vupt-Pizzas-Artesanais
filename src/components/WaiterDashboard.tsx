
import React from 'react';
import { motion } from 'framer-motion';
import { Table } from '../types.ts';

interface WaiterDashboardProps {
  tables: Table[];
  onSelectTable: (tableId: string) => void;
  onReleaseTable: (tableId: string) => void;
  onBack: () => void;
}

export const WaiterDashboard: React.FC<WaiterDashboardProps> = ({ tables, onSelectTable, onReleaseTable, onBack }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 sm:p-8 max-w-7xl mx-auto w-full"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Atendimento <span className="text-red-600">Mesa</span></h2>
          <p className="text-slate-500 font-medium">Selecione uma mesa para iniciar o pedido</p>
        </div>
        <button 
          onClick={onBack}
          className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all shadow-sm"
        >
          Voltar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {tables.map((table) => {
          const isBusy = table.status === 'OCCUPIED' || table.status === 'IN_SERVICE' || table.status === 'RESERVED';
          
          return (
            <motion.div
              key={table.id}
              whileHover={table.status === 'FREE' ? { scale: 1.02 } : {}}
              whileTap={table.status === 'FREE' || table.status === 'IN_SERVICE' ? { scale: 0.98 } : {}}
              onClick={() => {
                if (table.status === 'FREE') onSelectTable(table.id);
                else if (table.status === 'IN_SERVICE') onReleaseTable(table.id);
              }}
              className={`
                relative overflow-hidden rounded-[32px] p-8 aspect-square flex flex-col items-center justify-center border-4 transition-all
                ${table.status === 'FREE' || table.status === 'IN_SERVICE' ? 'cursor-pointer' : 'cursor-not-allowed'}
                ${table.status === 'OCCUPIED' 
                  ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-amber-100' 
                  : table.status === 'IN_SERVICE'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-100'
                  : table.status === 'RESERVED'
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-white border-slate-100 text-slate-800 shadow-slate-100 hover:border-red-200'}
                shadow-lg
              `}
            >
              <span className="text-xs font-black uppercase tracking-widest opacity-40 mb-2">Mesa</span>
              <span className="text-5xl font-black leading-none">{table.number}</span>
              
              <div className="mt-4 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  table.status === 'OCCUPIED' ? 'bg-amber-500 animate-pulse' : 
                  table.status === 'IN_SERVICE' ? 'bg-emerald-500 animate-pulse' :
                  table.status === 'RESERVED' ? 'bg-purple-500' :
                  'bg-slate-300'
                }`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  {table.status === 'OCCUPIED' ? 'Ocupada' : 
                   table.status === 'IN_SERVICE' ? 'Em Atendimento' :
                   table.status === 'RESERVED' ? 'Reservada' :
                   'Livre'}
                </span>
              </div>

              {table.status === 'OCCUPIED' && (
                <div className="absolute top-4 right-4 text-xl">🍽️</div>
              )}
              {table.status === 'IN_SERVICE' && (
                <div className="absolute top-4 right-4 text-xl">🤵</div>
              )}
            </motion.div>
          );
        })}

        {tables.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
            <span className="text-4xl mb-4 block">🪑</span>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhuma mesa cadastrada</p>
            <p className="text-slate-500 text-xs mt-1">Cadastre as mesas no painel administrativo</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
