
import React from 'react';
import { Product } from '../types';

interface FoodCardProps {
  product: Product;
  onAdd: (product: Product, quantity: number, comps?: any[]) => void;
  onClick: (product: Product) => void;
  logoUrl: string;
}

export const FoodCard: React.FC<FoodCardProps> = ({ product, onAdd, onClick, logoUrl }) => {
  return (
    <div className="group relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border border-slate-100 cursor-pointer flex flex-row md:flex-col gap-4 h-full" onClick={() => onClick(product)}>
      
      {/* Imagem (Direita no Mobile, Topo no Desktop) */}
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-full md:h-40 rounded-xl overflow-hidden shrink-0 bg-white order-2 md:order-1 shadow-inner p-2 flex items-center justify-center">
        {product.image ? (
          <img src={product.image} alt={product.name} className={`w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 ${product.outOfStock ? 'opacity-40 grayscale' : ''}`} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain opacity-50" referrerPolicy="no-referrer" />
        )}
        {product.outOfStock && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center rounded-xl">
            <span className="bg-red-650 bg-red-650 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-md z-10 animate-pulse">Esgotado</span>
          </div>
        )}
      </div>

      {/* Informações (Esquerda no Mobile, Baixo no Desktop) */}
      <div className="flex-1 flex flex-col justify-between min-w-0 order-1 md:order-2">
        <div>
          <h3 className="text-base sm:text-lg font-black text-red-600 uppercase tracking-tight leading-tight group-hover:text-red-700 transition-colors line-clamp-2">{product.name}</h3>
          <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1 mb-2 leading-relaxed">
            {product.description}
          </p>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-base sm:text-lg font-black text-red-600">
            R$ {product.price.toFixed(2)}
          </span>
          <button 
            onClick={(e) => { e.stopPropagation(); if (!product.outOfStock) { onAdd(product, 1); } }}
            disabled={product.outOfStock}
            className={`px-4 py-2 rounded-xl font-black uppercase text-base tracking-widest transition-colors shadow-md flex items-center justify-center ${product.outOfStock ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'}`}
          >
            {product.outOfStock ? '✕' : '+'}
          </button>
        </div>
      </div>
    </div>
  );
};
