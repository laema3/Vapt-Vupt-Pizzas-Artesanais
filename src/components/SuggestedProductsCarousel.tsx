import React, { useRef, useMemo } from 'react';
import { Product, CategoryItem, CartItem } from '../types';

interface SuggestedProductsCarouselProps {
  currentProduct?: Product | null;
  allProducts: Product[];
  categories: CategoryItem[];
  onAddProduct: (product: Product, quantity: number) => void;
  onUpdateQuantity?: (productId: string, delta: number) => void;
  cartItems?: CartItem[];
  title?: string;
  subtitle?: string;
  logoUrl?: string;
}

export const SuggestedProductsCarousel: React.FC<SuggestedProductsCarouselProps> = ({
  currentProduct,
  allProducts = [],
  categories = [],
  onAddProduct,
  onUpdateQuantity,
  cartItems = [],
  title = "Outros itens que você pode gostar",
  subtitle = "Aproveite para incluir bebidas geladas ou sobremesas no seu pedido",
  logoUrl
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filtra e classifica produtos para sugerir itens ideais (bebidas, sobremesas, acompanhamentos)
  const suggestedProducts = useMemo(() => {
    if (!allProducts || allProducts.length === 0) return [];

    const nonSuggestedIds = new Set<string>();
    if (currentProduct) {
      nonSuggestedIds.add(currentProduct.id);
    }

    const available = allProducts.filter(p => 
      !nonSuggestedIds.has(p.id) && 
      !p.hidden && 
      !p.outOfStock
    );

    // Helpers de identificação de categorias e nomes
    const isDrink = (p: Product) => {
      const text = `${p.name} ${p.category} ${p.subCategory || ''} ${p.description || ''}`.toLowerCase();
      const catObj = categories.find(c => c.id === p.category || c.name.toLowerCase() === p.category.toLowerCase());
      const catName = (catObj?.name || p.category || '').toLowerCase();
      const drinkWords = ['bebida', 'refrigerante', 'refri', 'suco', 'cerveja', 'água', 'agua', 'coca', 'guaraná', 'guarana', 'fanta', 'sprite', 'heineken', 'chopp', 'lata', 'litro', '2l', '600ml'];
      return drinkWords.some(w => text.includes(w) || catName.includes(w));
    };

    const isDessert = (p: Product) => {
      const text = `${p.name} ${p.category} ${p.subCategory || ''} ${p.description || ''}`.toLowerCase();
      const catObj = categories.find(c => c.id === p.category || c.name.toLowerCase() === p.category.toLowerCase());
      const catName = (catObj?.name || p.category || '').toLowerCase();
      const dessertWords = ['sobremesa', 'doce', 'torta', 'brownie', 'sorvete', 'açai', 'acai', 'mousse', 'pudim', 'chocolate', 'nutella', 'ninho'];
      return dessertWords.some(w => text.includes(w) || catName.includes(w));
    };

    const isSide = (p: Product) => {
      const text = `${p.name} ${p.category} ${p.subCategory || ''}`.toLowerCase();
      const sideWords = ['porção', 'porcao', 'batata', 'entrada', 'petisco', 'pastel', 'fritas'];
      return sideWords.some(w => text.includes(w));
    };

    const isPizza = (p: Product) => {
      const text = `${p.name} ${p.category} ${p.subCategory || ''} ${p.description || ''}`.toLowerCase();
      const catObj = categories.find(c => c.id === p.category || c.name.toLowerCase() === p.category.toLowerCase());
      const catName = (catObj?.name || p.category || '').toLowerCase();
      const pizzaWords = ['pizza', 'calzone', 'brotinho', 'broto', 'gigante', 'salgada', 'doce'];
      return pizzaWords.some(w => text.includes(w) || catName.includes(w));
    };

    // Separa por prioridade: bebidas primeiro, depois sobremesas, depois acompanhamentos, outros não-pizzas, e por fim outras pizzas
    const drinks = available.filter(isDrink);
    const desserts = available.filter(p => !isDrink(p) && isDessert(p));
    const sides = available.filter(p => !isDrink(p) && !isDessert(p) && isSide(p));
    const otherNonPizzas = available.filter(p => !isDrink(p) && !isDessert(p) && !isSide(p) && !isPizza(p));
    const otherPizzas = available.filter(p => !isDrink(p) && !isDessert(p) && !isSide(p) && isPizza(p));

    // Combina: Bebidas primeiro, depois Sobremesas, depois Acompanhamentos, depois outros
    const combined = [...drinks, ...desserts, ...sides, ...otherNonPizzas, ...otherPizzas];

    return combined.slice(0, 16);
  }, [allProducts, currentProduct, categories]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 260;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const getProductCartCount = (productId: string) => {
    return cartItems
      .filter(item => item.id === productId || item.id.startsWith(`${productId}_`))
      .reduce((acc, item) => acc + item.quantity, 0);
  };

  if (suggestedProducts.length === 0) return null;

  return (
    <div className="w-full space-y-3 pt-4 border-t border-slate-100">
      {/* Cabeçalho do Carrossel com Botões de Navegação */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5 truncate">
            <span className="text-base text-amber-500">✨</span>
            <span>{title}</span>
          </h4>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Setas de rolagem para desktop */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-black text-xs transition-colors cursor-pointer"
            title="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-black text-xs transition-colors cursor-pointer"
            title="Próximo"
          >
            ›
          </button>
        </div>
      </div>

      {/* Container Rolável de Produtos (Carrossel Horizontal) */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto pb-3 pt-1 px-0.5 no-scrollbar scroll-smooth snap-x touch-pan-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {suggestedProducts.map(item => {
          const cartCount = getProductCartCount(item.id);
          const isItemInCart = cartCount > 0;

          return (
            <div 
              key={item.id}
              className="w-36 sm:w-40 shrink-0 snap-start bg-white rounded-2xl p-2.5 border border-slate-200 hover:border-red-200 hover:shadow-md transition-all flex flex-col justify-between group shadow-sm"
            >
              {/* Imagem do Produto */}
              <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-50 mb-2 flex items-center justify-center p-1 border border-slate-100">
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <img 
                    src={logoUrl || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200'} 
                    alt="Logo" 
                    className="w-full h-full object-contain rounded-lg opacity-40"
                    referrerPolicy="no-referrer"
                  />
                )}

                {isItemInCart && (
                  <span className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-in zoom-in-75">
                    {cartCount}x
                  </span>
                )}
              </div>

              {/* Informações */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h5 className="font-black text-xs text-slate-800 uppercase tracking-tight line-clamp-1 group-hover:text-red-600 transition-colors" title={item.name}>
                    {item.name}
                  </h5>
                  <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5">
                    {item.description || item.category}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                  <span className="font-black text-xs text-red-600">
                    R$ {item.price.toFixed(2)}
                  </span>

                  {/* Botão de Adição / Quantidade */}
                  {isItemInCart ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-1 text-emerald-800">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onUpdateQuantity) {
                            const targetItem = cartItems.find(ci => ci.id === item.id || ci.id.startsWith(`${item.id}_`));
                            if (targetItem) {
                              onUpdateQuantity(targetItem.id, -1);
                            }
                          }
                        }}
                        className="w-6 h-6 rounded-lg bg-white text-emerald-700 font-black text-xs flex items-center justify-center hover:bg-emerald-100 active:scale-95 transition-all shadow-xs cursor-pointer"
                        title="Diminuir"
                      >
                        -
                      </button>
                      <span className="text-[11px] font-black px-1">{cartCount}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddProduct(item, 1);
                        }}
                        className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                        title="Aumentar"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddProduct(item, 1);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider py-1.5 px-2 rounded-xl transition-all shadow-sm shadow-emerald-900/10 active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>＋</span>
                      <span>Adicionar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
