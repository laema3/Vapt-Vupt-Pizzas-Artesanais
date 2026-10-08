
import React from 'react';
import { Product } from '../types';

interface FoodCardProps {
  product: Product;
  onAdd: (product: Product, quantity: number, comps?: any[]) => void;
  onClick: (product: Product) => void;
  logoUrl: string;
  onShowToast?: (msg: string, type: 'success' | 'error') => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({ product, onAdd, onClick, logoUrl, onShowToast }) => {
  const isOutOfStock = Boolean(
    product.outOfStock === true ||
    (product as any).status === 'ESGOTADO' ||
    String((product as any).status || '').toUpperCase() === 'ESGOTADO' ||
    String((product as any).status || '').toUpperCase() === 'OUT_OF_STOCK' ||
    String((product as any).status || '').toUpperCase() === 'SEM_ESTOQUE' ||
    (product as any).isOutOfStock === true ||
    ((product as any).stock !== undefined && (product as any).stock !== null && Number((product as any).stock) <= 0)
  );

  const handleCardClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isOutOfStock) {
      const msg = `⚠️ O produto "${product.name}" está ESGOTADO no momento. Não é possível prosseguir para a montagem deste pedido. Por favor, escolha outro produto ou sabor disponível no nosso cardápio!`;
      try {
        alert(msg);
      } catch (_e) {
        // Ignora caso alert seja restrito pelo navegador
      }
      if (onShowToast) {
        onShowToast(msg, 'error');
      }
      return;
    }

    onClick(product);
  };

  return (
    <div 
      className={`group relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border border-slate-100 flex flex-row md:flex-col gap-4 h-full ${
        isOutOfStock ? 'cursor-not-allowed opacity-85' : 'cursor-pointer hover:border-red-200'
      }`} 
      onClick={handleCardClick}
    >
      
      {/* Imagem (Direita no Mobile, Topo no Desktop) */}
      <div 
        className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-full md:h-40 rounded-2xl overflow-hidden shrink-0 bg-slate-50 order-2 md:order-1 p-1.5 flex items-center justify-center border border-slate-100 cursor-pointer"
        onClick={handleCardClick}
      >
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name} 
            className={`w-full h-full object-contain rounded-xl group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-40 grayscale' : ''}`} 
            loading="lazy" 
            referrerPolicy="no-referrer" 
          />
        ) : (
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl opacity-50" referrerPolicy="no-referrer" />
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-2xl p-1 text-center z-10 shadow-inner">
            <span className="bg-red-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-lg border border-red-400 animate-pulse">
              🚫 ESGOTADO
            </span>
            <span className="text-[9px] text-white/90 font-bold mt-1">Indisponível</span>
          </div>
        )}
      </div>

      {/* Informações (Esquerda no Mobile, Baixo no Desktop) */}
      <div className="flex-1 flex flex-col justify-between min-w-0 order-1 md:order-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className={`text-base sm:text-lg font-black uppercase tracking-tight leading-tight line-clamp-2 ${isOutOfStock ? 'text-slate-500' : 'text-red-600 group-hover:text-red-700 transition-colors'}`}>
              {product.name}
            </h3>
            {isOutOfStock && (
              <span className="bg-red-100 text-red-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-red-200">
                Esgotado
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1 mb-2 leading-relaxed">
            {product.description}
          </p>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className={`text-base sm:text-lg font-black ${isOutOfStock ? 'text-slate-400 line-through' : 'text-red-600'}`}>
            R$ {product.price.toFixed(2)}
          </span>
          <button 
            type="button"
            onClick={handleCardClick}
            disabled={isOutOfStock}
            className={`px-4 py-2 rounded-xl font-black uppercase text-base tracking-widest transition-colors shadow-md flex items-center justify-center ${
              isOutOfStock 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-green-600 text-white hover:bg-green-700 active:scale-95 cursor-pointer'
            }`}
            title={isOutOfStock ? "Produto esgotado" : "Escolher sabor e adicionar"}
          >
            {isOutOfStock ? '✕' : '+'}
          </button>
        </div>
      </div>
    </div>
  );
};
