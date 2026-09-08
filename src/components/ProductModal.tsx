import React, { useState, useEffect, useMemo } from 'react';
import { Product, Complement, CategoryItem } from '../types';

interface ProductModalProps {
  product: Product | null;
  allProducts?: Product[];
  complements: Complement[];
  categories: CategoryItem[];
  onClose: () => void;
  onAdd: (
    product: Product, 
    quantity: number, 
    comps?: Complement[], 
    pizzaOptions?: {
      mode: 'INTEIRA' | 'MEIO_A_MEIO';
      secondFlavor?: Product;
      calculatedBasePrice: number;
    }
  ) => void;
  isStoreOpen: boolean;
  logoUrl: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({ 
  product, 
  allProducts = [], 
  complements, 
  categories, 
  onClose, 
  onAdd, 
  isStoreOpen, 
  logoUrl 
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedComplements, setSelectedComplements] = useState<Complement[]>([]);
  const [pizzaMode, setPizzaMode] = useState<'INTEIRA' | 'MEIO_A_MEIO'>('INTEIRA');
  const [selectedSecondFlavor, setSelectedSecondFlavor] = useState<Product | null>(null);
  const [flavorSearch, setFlavorSearch] = useState('');

  useEffect(() => {
    if (product) {
      setQuantity(1);
      setSelectedComplements([]);
      setPizzaMode('INTEIRA');
      setSelectedSecondFlavor(null);
      setFlavorSearch('');
    }
  }, [product]);

  // Identifica se o produto atual é uma pizza
  const isPizza = useMemo(() => {
    if (!product) return false;
    const name = (product.name || '').toLowerCase();
    const cat = (product.category || '').toLowerCase();
    const sub = (product.subCategory || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();

    const nonPizza = ['bebida', 'refrigerante', 'suco', 'cerveja', 'água', 'agua', 'sobremesa', 'porção', 'porcao', 'batata', 'fritas'];
    if (nonPizza.some(term => cat.includes(term) || name.includes(term))) {
      return false;
    }

    if (name.includes('pizza') || cat.includes('pizza') || sub.includes('pizza') || desc.includes('pizza')) {
      return true;
    }

    const catObj = categories.find(c => c.id === product.category || c.name.toLowerCase() === cat);
    if (catObj && catObj.name.toLowerCase().includes('pizza')) {
      return true;
    }

    // Se houver qualquer outro produto com 'pizza' no catálogo, ou se for uma pizzaria
    return true;
  }, [product, categories]);

  // Lista de outros sabores de pizza disponíveis para a segunda metade
  const availableSecondFlavors = useMemo(() => {
    if (!product || !allProducts || allProducts.length === 0) return [];
    return allProducts.filter(p => {
      if (p.id === product.id) return false;
      if (p.hidden || p.outOfStock) return false;

      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const nonPizza = ['bebida', 'refrigerante', 'suco', 'cerveja', 'água', 'agua', 'sobremesa', 'porção', 'porcao', 'batata', 'fritas'];
      if (nonPizza.some(term => cat.includes(term) || name.includes(term))) {
        return false;
      }

      if (flavorSearch.trim()) {
        const query = flavorSearch.toLowerCase().trim();
        const matchesName = name.includes(query);
        const matchesDesc = (p.description || '').toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [product, allProducts, flavorSearch]);

  if (!product) return null;

  const handleToggleComplement = (comp: Complement) => {
    if (selectedComplements.find(c => c.id === comp.id)) {
      setSelectedComplements(prev => prev.filter(c => c.id !== comp.id));
    } else {
      setSelectedComplements(prev => [...prev, comp]);
    }
  };

  // Metade da primeira pizza
  const firstHalfPrice = product.price / 2;
  // Metade da segunda pizza (se selecionada)
  const secondHalfPrice = selectedSecondFlavor ? (selectedSecondFlavor.price / 2) : 0;

  // Preço base da pizza
  const calculatedBasePrice = (isPizza && pizzaMode === 'MEIO_A_MEIO')
    ? (selectedSecondFlavor ? (firstHalfPrice + secondHalfPrice) : product.price)
    : product.price;

  const complementsTotal = selectedComplements.reduce((acc, c) => acc + (c.price || 0), 0);
  const unitPrice = calculatedBasePrice + complementsTotal;
  const totalPrice = unitPrice * quantity;

  const canAddToCart = () => {
    if (!isStoreOpen || product.outOfStock) return false;
    if (isPizza && pizzaMode === 'MEIO_A_MEIO' && !selectedSecondFlavor) return false;
    return true;
  };

  const handleConfirmAdd = () => {
    if (!canAddToCart()) return;
    
    onAdd(
      product, 
      quantity, 
      selectedComplements, 
      isPizza ? {
        mode: pizzaMode,
        secondFlavor: selectedSecondFlavor || undefined,
        calculatedBasePrice
      } : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        {/* Top Image & Close Button */}
        <div className="relative h-56 sm:h-72 bg-slate-50 shrink-0 p-4 flex items-center justify-center border-b border-slate-100">
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-contain rounded-2xl" referrerPolicy="no-referrer" />
          ) : (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-2xl opacity-50" referrerPolicy="no-referrer" />
          )}
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg text-slate-800 hover:bg-red-50 hover:text-red-500 transition-colors font-black text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* Header & Description */}
          <div>
            <div className="flex justify-between items-start gap-4">
              <h2 className="text-2xl sm:text-3xl font-black text-red-600 uppercase tracking-tighter leading-tight">
                {product.name}
              </h2>
              <span className="text-xl sm:text-2xl font-black text-red-600 bg-red-50 px-3.5 py-1.5 rounded-xl shrink-0">
                R$ {product.price.toFixed(2)}
              </span>
            </div>
            <p className="text-slate-500 font-medium mt-2 leading-relaxed text-sm sm:text-base">
              {product.description}
            </p>
          </div>

          {/* Pizza Mode Selector: INTEIRA ou MEIO A MEIO */}
          {isPizza && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">
                Escolha o Formato da Pizza:
              </label>
              <div className="grid grid-cols-2 gap-3">
                
                {/* Opção INTEIRA */}
                <button
                  type="button"
                  onClick={() => {
                    setPizzaMode('INTEIRA');
                    setSelectedSecondFlavor(null);
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                    pizzaMode === 'INTEIRA'
                      ? 'border-red-600 bg-red-50/80 text-red-950 shadow-sm ring-2 ring-red-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">🍕</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      pizzaMode === 'INTEIRA' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      1 Sabor
                    </span>
                  </div>
                  <div>
                    <div className="font-black text-sm uppercase tracking-tight">Inteira</div>
                    <div className="text-xs text-slate-500 font-medium">Sabor completo</div>
                    <div className="text-sm font-black text-red-600 mt-1">
                      R$ {product.price.toFixed(2)}
                    </div>
                  </div>
                </button>

                {/* Opção MEIO A MEIO */}
                <button
                  type="button"
                  onClick={() => setPizzaMode('MEIO_A_MEIO')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                    pizzaMode === 'MEIO_A_MEIO'
                      ? 'border-amber-500 bg-amber-50/80 text-amber-950 shadow-sm ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">🌓</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      pizzaMode === 'MEIO_A_MEIO' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      2 Sabores
                    </span>
                  </div>
                  <div>
                    <div className="font-black text-sm uppercase tracking-tight">Meio a Meio</div>
                    <div className="text-xs text-slate-500 font-medium">Divida em 2 sabores</div>
                    <div className="text-xs font-black text-amber-700 mt-1">
                      Soma das metades
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Se for MEIO A MEIO, abre a seleção do segundo sabor */}
          {isPizza && pizzaMode === 'MEIO_A_MEIO' && (
            <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
              
              {/* 1º Sabor (Fixo da pizza aberta) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                    1/2
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">1º Sabor (Metade 1)</div>
                    <div className="font-black text-slate-800 text-sm truncate uppercase">{product.name}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Metade</div>
                  <div className="text-sm font-black text-red-600">R$ {firstHalfPrice.toFixed(2)}</div>
                </div>
              </div>

              {/* 2º Sabor (Seleção do cliente) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-white text-[11px] font-black flex items-center justify-center shadow-sm">
                      2/2
                    </span>
                    Escolha o 2º Sabor da Pizza:
                  </label>
                  {selectedSecondFlavor && (
                    <button
                      type="button"
                      onClick={() => setSelectedSecondFlavor(null)}
                      className="text-xs font-black text-red-600 hover:text-red-700 underline cursor-pointer"
                    >
                      Trocar sabor
                    </button>
                  )}
                </div>

                {/* 2º Sabor já selecionado */}
                {selectedSecondFlavor ? (
                  <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
                        {selectedSecondFlavor.image ? (
                          <img src={selectedSecondFlavor.image} alt={selectedSecondFlavor.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-2xl">🍕</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-black text-emerald-900 uppercase truncate">
                            {selectedSecondFlavor.name}
                          </span>
                          <span className="text-[10px] bg-emerald-200 text-emerald-900 font-black px-2 py-0.5 rounded-full">
                            ✓ Escolhido
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {selectedSecondFlavor.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Metade</div>
                      <div className="text-sm font-black text-emerald-700">R$ {secondHalfPrice.toFixed(2)}</div>
                    </div>
                  </div>
                ) : (
                  /* Lista de seleção de outros sabores */
                  <div className="space-y-2">
                    {/* Campo de busca se houver mais de 3 sabores */}
                    {availableSecondFlavors.length > 3 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={flavorSearch}
                          onChange={e => setFlavorSearch(e.target.value)}
                          placeholder="Buscar sabor por nome..."
                          className="w-full px-4 py-2.5 pl-9 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white transition-all"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                        {flavorSearch && (
                          <button
                            type="button"
                            onClick={() => setFlavorSearch('')}
                            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}

                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-2xl p-2 bg-slate-50/50">
                      {availableSecondFlavors.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-medium">
                          Nenhum outro sabor encontrado {flavorSearch ? `para "${flavorSearch}"` : ''}.
                        </div>
                      ) : (
                        availableSecondFlavors.map(flavor => {
                          const flavorHalf = flavor.price / 2;
                          const combined = firstHalfPrice + flavorHalf;
                          return (
                            <button
                              type="button"
                              key={flavor.id}
                              onClick={() => setSelectedSecondFlavor(flavor)}
                              className="w-full p-2.5 rounded-xl text-left bg-white hover:bg-red-50 border border-slate-100 hover:border-red-200 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                                  {flavor.image ? (
                                    <img src={flavor.image} alt={flavor.name} className="w-full h-full object-contain" />
                                  ) : (
                                    <span className="text-lg">🍕</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-slate-800 uppercase truncate group-hover:text-red-600 transition-colors">
                                    {flavor.name}
                                  </div>
                                  <p className="text-[10px] text-slate-400 line-clamp-1">{flavor.description}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-black text-red-600">
                                  + R$ {flavorHalf.toFixed(2)}
                                </div>
                                <div className="text-[9px] text-slate-400 font-semibold">
                                  Total: R$ {combined.toFixed(2)}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Banner de Soma das Metades */}
                {selectedSecondFlavor && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1 text-amber-950">
                    <div className="font-black flex items-center gap-1.5 uppercase text-[11px] tracking-wide text-amber-900">
                      <span>🧮</span>
                      <span>Soma das Metades Calculada:</span>
                    </div>
                    <div className="text-[11px] text-amber-900 flex flex-wrap items-center gap-1.5 font-medium">
                      <span>1/2 {product.name} (R$ {firstHalfPrice.toFixed(2)})</span>
                      <span>+</span>
                      <span>1/2 {selectedSecondFlavor.name} (R$ {secondHalfPrice.toFixed(2)})</span>
                      <span className="font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded">
                        = R$ {calculatedBasePrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Adicionais / Bordas recheadas */}
          {complements.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Adicionais & Bordas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {complements.filter(c => c.active && (!c.applicable_categories || c.applicable_categories.includes(product.category))).map(comp => (
                  <button 
                    type="button"
                    key={comp.id}
                    onClick={() => handleToggleComplement(comp)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      selectedComplements.find(c => c.id === comp.id) 
                        ? 'border-red-500 bg-red-50 text-red-800 shadow-md' 
                        : 'border-slate-100 bg-white text-slate-600 hover:border-red-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs uppercase tracking-wide">{comp.name}</span>
                    <span className="font-black text-xs text-red-600">+ R$ {comp.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar: Quantity & Add Button */}
        <div className="p-4 sm:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-20">
          <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">
            <button 
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))} 
              className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-400 hover:text-red-600 font-black text-lg transition-colors cursor-pointer"
            >
              -
            </button>
            <span className="text-xl font-black text-slate-800 w-8 text-center">{quantity}</span>
            <button 
              type="button"
              onClick={() => setQuantity(quantity + 1)} 
              className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-400 hover:text-red-600 font-black text-lg transition-colors cursor-pointer"
            >
              +
            </button>
          </div>
          
          <button 
            type="button"
            onClick={handleConfirmAdd}
            disabled={!canAddToCart()}
            className={`w-full sm:flex-1 py-4 px-6 rounded-2xl font-black uppercase text-sm tracking-widest text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer ${
              !canAddToCart()
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                : 'bg-red-600 hover:bg-red-700 shadow-red-900/20'
            }`}
          >
            <span>
              {product.outOfStock 
                ? 'Produto Esgotado' 
                : !isStoreOpen 
                ? 'Loja Fechada'
                : (isPizza && pizzaMode === 'MEIO_A_MEIO' && !selectedSecondFlavor)
                ? 'Escolha o 2º Sabor para Continuar'
                : (isPizza && pizzaMode === 'MEIO_A_MEIO')
                ? `Adicionar Meio a Meio • R$ ${totalPrice.toFixed(2)}`
                : `Adicionar Inteira • R$ ${totalPrice.toFixed(2)}`
              }
            </span>
            {canAddToCart() && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">➜</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
