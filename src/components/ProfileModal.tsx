import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { fetchAddressByCep, parseAddressParts, buildFullAddress } from '../utils/zipUtils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onUpdate: (customer: Customer) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, customer, onUpdate }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setEmail(customer.email || '');
      const parts = parseAddressParts(customer.address || '');
      setStreet(parts.street);
      setNumber(parts.number);
      setComplement(parts.complement);
      setNeighborhood(customer.neighborhood || '');
      setZipCode(customer.zipCode || '');
    }
  }, [customer, isOpen]);

  const handleCepChange = async (val: string) => {
    setZipCode(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsSearchingCep(true);
      const res = await fetchAddressByCep(clean);
      setIsSearchingCep(false);
      if (res && res.address) {
        setStreet(res.address);
        if (res.neighborhood) setNeighborhood(res.neighborhood);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customer) {
      const fullAddress = buildFullAddress(street, number, complement);
      onUpdate({
        ...customer,
        name,
        phone,
        email,
        address: fullAddress,
        neighborhood,
        zipCode
      });
      onClose();
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight text-center flex-1">Editar Perfil</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Nome Completo</label>
            <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">E-mail</label>
              <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" required />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">WhatsApp</label>
              <input type="tel" placeholder="Telefone (WhatsApp)" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" required />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-black uppercase tracking-wider text-red-600 block mb-2">📍 Endereço de Entrega</span>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">CEP</label>
                  {isSearchingCep && <span className="text-[10px] font-bold text-red-600 animate-pulse">Buscando CEP...</span>}
                </div>
                <input 
                  type="text" 
                  placeholder="00000-000 (opcional)" 
                  value={zipCode} 
                  onChange={e => handleCepChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Rua / Logradouro</label>
                <input 
                  type="text" 
                  placeholder="Ex: Rua das Flores" 
                  value={street} 
                  onChange={e => setStreet(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-red-600 block mb-1">Número *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 123" 
                    value={number} 
                    onChange={e => setNumber(e.target.value)} 
                    className="w-full bg-slate-50 border-2 border-red-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Complemento</label>
                  <input 
                    type="text" 
                    placeholder="Apto, Bloco..." 
                    value={complement} 
                    onChange={e => setComplement(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Bairro</label>
                <input 
                  type="text" 
                  placeholder="Bairro" 
                  value={neighborhood} 
                  onChange={e => setNeighborhood(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500" 
                  required 
                />
              </div>
            </div>
          </div>
          
          <button type="submit" className="w-full bg-red-600 text-white py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20 active:scale-95 mt-4 cursor-pointer">
            Salvar Alterações
          </button>
        </form>
      </div>
    </div>
  );
};

