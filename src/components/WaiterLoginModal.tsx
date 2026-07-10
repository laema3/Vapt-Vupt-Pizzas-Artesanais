
import React, { useState } from 'react';

interface WaiterLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPass: string;
}

export const WaiterLoginModal: React.FC<WaiterLoginModalProps> = ({ isOpen, onClose, onSuccess, correctPass }) => {
  const [pass, setPass] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass === correctPass) {
      onSuccess();
      onClose();
    } else {
      alert('Senha do garçom incorreta');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
          🤵
        </div>
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-6 text-center">Acesso Garçom</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="password" 
            placeholder="Senha de Atendimento" 
            value={pass} 
            onChange={e => setPass(e.target.value)} 
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 text-center text-lg font-black text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
            required 
            autoFocus
          />
          
          <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-emerald-600 transition-colors shadow-lg shadow-slate-900/20 active:scale-95 mt-6">
            Entrar no Modo Garçom
          </button>
          
          <button type="button" onClick={onClose} className="w-full py-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
};
