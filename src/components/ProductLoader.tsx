
import React from 'react';

interface ProductLoaderProps {
  logoUrl?: string;
  showRetry?: boolean;
}

export const ProductLoader: React.FC<ProductLoaderProps> = ({ logoUrl, showRetry }) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="relative">
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="Logo VAPT VUPT" 
            className="w-48 h-48 object-contain" 
            referrerPolicy="no-referrer" 
          />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      
      {showRetry && (
        <div className="mt-8 animate-in fade-in duration-500">
          <p className="text-slate-400 text-[10px] font-bold uppercase mb-4">O carregamento está demorando mais que o esperado...</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-900/20 active:scale-95 transition-all"
          >
            Recarregar Página
          </button>
        </div>
      )}
    </div>
  );
};

