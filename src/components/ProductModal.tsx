import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Complement, CategoryItem, CartItem } from '../types';
import { SuggestedProductsCarousel } from './SuggestedProductsCarousel';

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
    },
    extraOptions?: {
      selectedBorda?: Complement;
      selectedAdditionals?: Complement[];
    }
  ) => void;
  isStoreOpen: boolean;
  logoUrl: string;
  scheduleAllowed?: boolean;
  onAddSuggestedProduct?: (product: Product, quantity: number) => void;
  cartItems?: CartItem[];
  onUpdateCartQuantity?: (productId: string, delta: number) => void;
}

const NO_BORDA_COMPLEMENT: Complement = {
  id: 'sem_borda',
  name: 'Sem Borda Recheada',
  price: 0,
  active: true,
  type: 'BORDA',
};

// Identifica se um produto é uma pizza doce
const checkIfProductIsSweetPizza = (
  product: Product | null | undefined, 
  categories: CategoryItem[] = []
): boolean => {
  if (!product) return false;
  const name = (product.name || '').toLowerCase().trim();
  const cat = (product.category || '').toLowerCase().trim();
  const sub = (product.subCategory || '').toLowerCase().trim();
  const desc = (product.description || '').toLowerCase().trim();

  // Localiza objeto da categoria
  const catObj = categories.find(c => 
    c.id === product.category || 
    c.name.toLowerCase().trim() === cat
  );
  const categoryName = (catObj?.name || product.category || '').toLowerCase().trim();

  // Categorias ou subcategorias explícitas de doces
  const sweetCategoryKeywords = ['doce', 'doces', 'sweet', 'sobremesa', 'sobremesas'];
  if (sweetCategoryKeywords.some(kw => categoryName.includes(kw) || sub.includes(kw))) {
    return true;
  }

  // Palavras-chave inequívocas de sabores doces
  const sweetKeywords = [
    'doce', 'doces', 'chocolate', 'nutella', 'ninho', 'brigadeiro',
    'morango', 'banana', 'romeu e julieta', 'romeu & julieta', 'goiabada',
    'churros', 'prestígio', 'prestigio', 'sensação', 'sensacao',
    'confete', 'm&m', 'm&ms', 'kit kat', 'kitkat', 'ovomaltine',
    'beijinho', 'doce de leite', 'marshmallow', 'oreo', 'ouro branco',
    'sonho de valsa', 'maracujá', 'maracuja', 'limão', 'limao',
    'coco com leite condensado', 'banana com canela', 'abacaxi', 'paçoca', 'pacoca', 'brownie'
  ];

  if (sweetKeywords.some(kw => name.includes(kw) || desc.includes(kw))) {
    return true;
  }

  return false;
};

// Identifica de forma rigorosa se um produto é uma pizza (doce ou salgada)
const checkIfProductIsPizza = (
  product: Product | null | undefined, 
  categories: CategoryItem[] = []
): boolean => {
  if (!product) return false;
  const name = (product.name || '').toLowerCase().trim();
  const cat = (product.category || '').toLowerCase().trim();
  const sub = (product.subCategory || '').toLowerCase().trim();
  const desc = (product.description || '').toLowerCase().trim();

  // Localiza o objeto de categoria para conferir pelo ID ou Nome
  const catObj = categories.find(c => 
    c.id === product.category || 
    c.name.toLowerCase().trim() === cat
  );
  const categoryName = (catObj?.name || product.category || '').toLowerCase().trim();

  // Se o próprio nome ou descrição contiver termo de pizza
  const explicitPizzaTerms = ['pizza', 'calzone', 'brotinho', 'broto'];
  const hasExplicitPizzaTerm = explicitPizzaTerms.some(term => name.includes(term) || desc.includes(term));

  // Lista de itens estritamente NÃO-pizza (bebidas, porções, lanches convencionais)
  const nonPizzaKeywords = [
    'bebida', 'refrigerante', 'refri', 'suco', 'cerveja', 'água', 'agua', 
    'drink', 'drinks', 'chopp', 'chope', 'vinho', 'dose', 'energético', 'energetico', 
    'porção', 'porções', 'porcao', 'porcoes', 'batata', 'frita', 'fritas', 
    'entrada', 'entradas', 'acompanhamento', 'acompanhamentos', 'petisco', 'petiscos',
    'hamburguer', 'hambúrguer', 'burger', 'lanche', 'sanduiche', 'sanduíche', 
    'pastel', 'caldo', 'salgado', 'salgados', 'coca', 'guaraná', 'guarana', 
    'fanta', 'sprite', 'pepsi', 'heineken', 'stella', 'brahma', 'skol', 'budweiser',
    'corona', 'amstel', 'eisenbahn', 'del valle', 'red bull', 'monster', 'lata', 'litro', 'long neck'
  ];

  // Se tem termo estrito de bebida/lanche/porção E NÃO tem pizza no nome
  if (!hasExplicitPizzaTerm && nonPizzaKeywords.some(term => 
    categoryName.includes(term) || 
    cat.includes(term) || 
    sub.includes(term) || 
    name.includes(term)
  )) {
    return false;
  }

  // Se contiver a palavra "pizza" explicitamente no nome, categoria, subcategoria ou descrição
  if (
    hasExplicitPizzaTerm || 
    categoryName.includes('pizza') || 
    sub.includes('pizza')
  ) {
    return true;
  }

  // Categorias clássicas de pizzarias (salgadas e doces)
  const pizzaCategoryKeywords = [
    'salgada', 'salgadas', 'doce', 'doces', 'sweet', 'tradicionais', 'tradicional', 
    'especiais', 'especial', 'premium', 'gourmet', 'calzone', 'calzones', 
    'brotinho', 'broto', 'gigante', 'grande', 'média', 'media', 'pequena'
  ];

  if (pizzaCategoryKeywords.some(kw => categoryName.includes(kw) || sub.includes(kw))) {
    return true;
  }

  // Se for pizza doce pelo perfil de recheio doce da pizzaria
  if (checkIfProductIsSweetPizza(product, categories)) {
    return true;
  }

  // Por padrão: se não tem indicação de ser pizza, NÃO é pizza!
  return false;
};

export const ProductModal: React.FC<ProductModalProps> = ({ 
  product, 
  allProducts = [], 
  complements, 
  categories, 
  onClose, 
  onAdd, 
  isStoreOpen, 
  logoUrl,
  scheduleAllowed = true,
  onAddSuggestedProduct,
  cartItems = [],
  onUpdateCartQuantity
}) => {
  const [quantity, setQuantity] = useState(1);
  const [bordaSelection, setBordaSelection] = useState<Complement | 'NONE' | null>(null);
  const [selectedAdicionais, setSelectedAdicionais] = useState<Complement[]>([]);
  const [pizzaMode, setPizzaMode] = useState<'INTEIRA' | 'MEIO_A_MEIO'>('INTEIRA');
  const [selectedSecondFlavor, setSelectedSecondFlavor] = useState<Product | null>(null);
  const [flavorSearch, setFlavorSearch] = useState('');
  const [bordaHighlightAlert, setBordaHighlightAlert] = useState(false);

  // Refs para auto-scroll suave entre opções
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const secondFlavorSectionRef = useRef<HTMLDivElement>(null);
  const bordaSectionRef = useRef<HTMLDivElement>(null);
  const adicionaisSectionRef = useRef<HTMLDivElement>(null);
  const footerSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (targetRef: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      if (targetRef.current) {
        targetRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 130);
  };

  useEffect(() => {
    if (product) {
      const isOutOfStock = Boolean(
        product.outOfStock === true ||
        (product as any).status === 'ESGOTADO' ||
        String((product as any).status || '').toUpperCase() === 'ESGOTADO' ||
        String((product as any).status || '').toUpperCase() === 'OUT_OF_STOCK' ||
        String((product as any).status || '').toUpperCase() === 'SEM_ESTOQUE' ||
        (product as any).isOutOfStock === true ||
        ((product as any).stock !== undefined && (product as any).stock !== null && Number((product as any).stock) <= 0)
      );

      if (isOutOfStock) {
        try {
          alert(`⚠️ O produto "${product.name}" está ESGOTADO no momento. Não é possível prosseguir para montagem de pedido deste produto.`);
        } catch (_e) { void _e; }
        onClose();
        return;
      }

      setQuantity(1);
      setBordaSelection(null);
      setSelectedAdicionais([]);
      setPizzaMode('INTEIRA');
      setSelectedSecondFlavor(null);
      setFlavorSearch('');
      setBordaHighlightAlert(false);
    }
  }, [product, onClose]);

  // Identifica se o produto atual é uma pizza (doce ou salgada)
  const isPizza = useMemo(() => checkIfProductIsPizza(product, categories), [product, categories]);

  // Identifica se o produto atual é uma pizza doce
  const isSweetPizza = useMemo(() => {
    return Boolean(isPizza && checkIfProductIsSweetPizza(product, categories));
  }, [isPizza, product, categories]);

  // Separar Bordas e Adicionais aplicáveis (BORDAS PARA TODAS AS PIZZAS, INCLUINDO DOCES)
  const applicableComplements = useMemo(() => {
    if (!product || !complements) return [];
    return complements.filter(c => {
      if (!c.active) return false;
      const isBordaComp = c.type === 'BORDA' || c.name.toLowerCase().includes('borda');
      // Bordas NUNCA são aplicáveis se o produto não for pizza!
      if (isBordaComp && !isPizza) return false;

      // Se não houver restrição específica de categorias, aplica para todas as pizzas
      if (!c.applicable_categories || c.applicable_categories.length === 0) {
        return true;
      }
      return c.applicable_categories.includes(product.category) || 
             c.applicable_categories.includes(product.id);
    });
  }, [product, complements, isPizza]);

  const bordaItems = useMemo(() => {
    // Bordas são estritamente exclusivas para pizzas (salgadas e doces)
    if (!isPizza) return [];
    const list = applicableComplements.filter(c => 
      c.type === 'BORDA' || c.name.toLowerCase().includes('borda')
    );
    return list;
  }, [applicableComplements, isPizza]);

  const adicionalItems = useMemo(() => {
    const list = applicableComplements.filter(c => 
      c.type !== 'BORDA' && !c.name.toLowerCase().includes('borda')
    );
    return list;
  }, [applicableComplements]);

  // Lista de outros sabores de pizza disponíveis para a segunda metade
  // REGRA: Se for pizza doce, aceita apenas outras pizzas doces! Se for salgada, aceita apenas outras salgadas!
  const availableSecondFlavors = useMemo(() => {
    if (!isPizza || !product || !allProducts || allProducts.length === 0) return [];
    return allProducts.filter(p => {
      if (p.id === product.id) return false;
      const isOut = Boolean(
        p.outOfStock === true ||
        (p as any).status === 'ESGOTADO' ||
        String((p as any).status || '').toUpperCase() === 'ESGOTADO' ||
        String((p as any).status || '').toUpperCase() === 'OUT_OF_STOCK' ||
        String((p as any).status || '').toUpperCase() === 'SEM_ESTOQUE' ||
        (p as any).isOutOfStock === true ||
        ((p as any).stock !== undefined && (p as any).stock !== null && Number((p as any).stock) <= 0)
      );
      if (p.hidden || isOut) return false;
      if (!checkIfProductIsPizza(p, categories)) return false;

      // REGRA SOLICITADA: Pizza doce apenas com doce; Pizza salgada apenas com salgada
      const pIsSweet = checkIfProductIsSweetPizza(p, categories);
      if (isSweetPizza) {
        if (!pIsSweet) return false;
      } else {
        if (pIsSweet) return false;
      }

      if (flavorSearch.trim()) {
        const query = flavorSearch.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesDesc = (p.description || '').toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [isPizza, isSweetPizza, product, allProducts, categories, flavorSearch]);

  // Objeto de borda efetivo (se 'NONE', vira objeto sem_borda com price: 0)
  const effectiveBorda: Complement | null = useMemo(() => {
    if (!isPizza) return null;
    if (bordaSelection === 'NONE') return NO_BORDA_COMPLEMENT;
    if (bordaSelection && typeof bordaSelection === 'object') return bordaSelection;
    return null;
  }, [isPizza, bordaSelection]);

  // Lista combinada de complementos para salvar no pedido
  const selectedComplements = useMemo(() => {
    return [
      ...(effectiveBorda ? [effectiveBorda] : []),
      ...selectedAdicionais
    ];
  }, [effectiveBorda, selectedAdicionais]);

  // Regra de obrigatoriedade da borda (EXCLUSIVA para pizzas com bordas cadastradas)
  const isBordaMandatory = Boolean(isPizza && bordaItems.length > 0);
  const hasBordaDecision = !isBordaMandatory || bordaSelection !== null;

  // Seleção de Borda: Apenas 1 borda. Ao escolher uma, as demais ficam desabilitadas.
  const handleSelectBorda = (borda: Complement) => {
    setBordaHighlightAlert(false);
    if (bordaSelection !== 'NONE' && bordaSelection?.id === borda.id) {
      // Desmarca a borda atual
      setBordaSelection(null);
    } else {
      // Seleciona a borda escolhida
      setBordaSelection(borda);
      // Auto-scroll para a próxima etapa
      if (adicionalItems.length > 0) {
        scrollToSection(adicionaisSectionRef);
      } else {
        scrollToSection(footerSectionRef);
      }
    }
  };

  // Seleção explícita de "SEM BORDA"
  const handleSelectNoBorda = () => {
    setBordaHighlightAlert(false);
    if (bordaSelection === 'NONE') {
      setBordaSelection(null);
    } else {
      setBordaSelection('NONE');
      // Auto-scroll para a próxima etapa
      if (adicionalItems.length > 0) {
        scrollToSection(adicionaisSectionRef);
      } else {
        scrollToSection(footerSectionRef);
      }
    }
  };

  // Seleção de Adicionais: Até no máximo 3 adicionais.
  const handleToggleAdicional = (adicional: Complement) => {
    const isSelected = selectedAdicionais.some(a => a.id === adicional.id);
    if (isSelected) {
      setSelectedAdicionais(prev => prev.filter(a => a.id !== adicional.id));
    } else {
      if (selectedAdicionais.length >= 3) {
        return;
      }
      setSelectedAdicionais(prev => [...prev, adicional]);
    }
  };

  if (!product) return null;

  // Metade da primeira pizza
  const firstHalfPrice = product.price / 2;
  // Metade da segunda pizza (se selecionada)
  const secondHalfPrice = selectedSecondFlavor ? (selectedSecondFlavor.price / 2) : 0;

  // Preço base da pizza
  const calculatedBasePrice = (isPizza && pizzaMode === 'MEIO_A_MEIO')
    ? (selectedSecondFlavor ? (firstHalfPrice + secondHalfPrice) : product.price)
    : product.price;

  const bordaPrice = (bordaSelection && bordaSelection !== 'NONE') ? bordaSelection.price : 0;
  const complementsTotal = bordaPrice + selectedAdicionais.reduce((acc, a) => acc + (a.price || 0), 0);
  const unitPrice = calculatedBasePrice + complementsTotal;
  const totalPrice = unitPrice * quantity;

  const canAddToCart = () => {
    if ((!isStoreOpen && !scheduleAllowed) || product.outOfStock) return false;
    if (isPizza && pizzaMode === 'MEIO_A_MEIO' && !selectedSecondFlavor) return false;
    if (isPizza && !hasBordaDecision) return false;
    return true;
  };

  const handleConfirmAdd = () => {
    if (isPizza && pizzaMode === 'MEIO_A_MEIO' && !selectedSecondFlavor) {
      scrollToSection(secondFlavorSectionRef);
      return;
    }
    if (isPizza && !hasBordaDecision) {
      setBordaHighlightAlert(true);
      scrollToSection(bordaSectionRef);
      return;
    }
    if (!canAddToCart()) return;
    
    onAdd(
      product, 
      quantity, 
      selectedComplements, 
      isPizza ? {
        mode: pizzaMode,
        secondFlavor: selectedSecondFlavor || undefined,
        calculatedBasePrice
      } : undefined,
      {
        selectedBorda: isPizza ? (effectiveBorda || undefined) : undefined,
        selectedAdditionals: selectedAdicionais.length > 0 ? selectedAdicionais : undefined,
      }
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
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* Header & Description */}
          <div>
            <div className="flex justify-between items-start gap-4">
              <div>
                {isPizza && (
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isSweetPizza 
                        ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {isSweetPizza ? '🍫 Pizza Doce' : '🍕 Pizza Salgada'}
                    </span>
                  </div>
                )}
                <h2 className="text-2xl sm:text-3xl font-black text-red-600 uppercase tracking-tighter leading-tight">
                  {product.name}
                </h2>
              </div>
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
                    if (bordaItems.length > 0) {
                      scrollToSection(bordaSectionRef);
                    } else if (adicionalItems.length > 0) {
                      scrollToSection(adicionaisSectionRef);
                    } else {
                      scrollToSection(footerSectionRef);
                    }
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
                  onClick={() => {
                    setPizzaMode('MEIO_A_MEIO');
                    scrollToSection(secondFlavorSectionRef);
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                    pizzaMode === 'MEIO_A_MEIO'
                      ? (isSweetPizza 
                          ? 'border-pink-500 bg-pink-50/80 text-pink-950 shadow-sm ring-2 ring-pink-500/20' 
                          : 'border-amber-500 bg-amber-50/80 text-amber-950 shadow-sm ring-2 ring-amber-500/20')
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{isSweetPizza ? '🍫' : '🌓'}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      pizzaMode === 'MEIO_A_MEIO' 
                        ? (isSweetPizza ? 'bg-pink-600 text-white' : 'bg-amber-600 text-white') 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isSweetPizza ? '2 Sabores Doces' : '2 Sabores'}
                    </span>
                  </div>
                  <div>
                    <div className="font-black text-sm uppercase tracking-tight">Meio a Meio</div>
                    <div className="text-xs text-slate-500 font-medium">
                      {isSweetPizza ? 'Divida em 2 sabores doces' : 'Divida em 2 sabores'}
                    </div>
                    <div className={`text-xs font-black mt-1 ${isSweetPizza ? 'text-pink-700' : 'text-amber-700'}`}>
                      Soma das metades
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Se for MEIO A MEIO, abre a seleção do segundo sabor */}
          {isPizza && pizzaMode === 'MEIO_A_MEIO' && (
            <div ref={secondFlavorSectionRef} className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
              
              {/* Informativo da regra de combinação meio a meio */}
              <div className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs font-bold ${
                isSweetPizza 
                  ? 'bg-pink-50 border-pink-200 text-pink-950' 
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <span className="text-lg shrink-0">{isSweetPizza ? '🍫' : '🍕'}</span>
                <div>
                  <div className="font-black uppercase text-[11px] tracking-wide">
                    {isSweetPizza 
                      ? 'Combinação Meio a Meio: Apenas Pizzas Doces' 
                      : 'Combinação Meio a Meio: Apenas Pizzas Salgadas'}
                  </div>
                  <p className="text-[11px] font-medium mt-0.5 opacity-90">
                    {isSweetPizza
                      ? 'Para garantir a melhor combinação e preparo, pizzas doces podem ser montadas apenas com outros sabores de pizza doce.'
                      : 'A segunda metade deve ser combinada com outro sabor de pizza salgada do nosso cardápio.'}
                  </p>
                </div>
              </div>

              {/* 1º Sabor (Fixo da pizza aberta) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-8 h-8 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${
                    isSweetPizza ? 'bg-pink-600' : 'bg-red-600'
                  }`}>
                    1/2
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">1º Sabor (Metade 1)</div>
                    <div className="font-black text-slate-800 text-sm truncate uppercase">{product.name}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Metade</div>
                  <div className={`text-sm font-black ${isSweetPizza ? 'text-pink-600' : 'text-red-600'}`}>
                    R$ {firstHalfPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 2º Sabor (Seleção do cliente) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg text-white text-[11px] font-black flex items-center justify-center shadow-sm ${
                      isSweetPizza ? 'bg-pink-500' : 'bg-amber-500'
                    }`}>
                      2/2
                    </span>
                    {isSweetPizza ? 'Escolha o 2º Sabor Doce da Pizza:' : 'Escolha o 2º Sabor da Pizza:'}
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
                          <span className="text-2xl">{isSweetPizza ? '🍫' : '🍕'}</span>
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
                          placeholder={isSweetPizza ? "Buscar sabor de pizza doce..." : "Buscar sabor por nome..."}
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
                          {isSweetPizza 
                            ? `Nenhum outro sabor de pizza doce disponível${flavorSearch ? ` para "${flavorSearch}"` : ''}.`
                            : `Nenhum outro sabor encontrado${flavorSearch ? ` para "${flavorSearch}"` : ''}.`}
                        </div>
                      ) : (
                        availableSecondFlavors.map(flavor => {
                          const flavorHalf = flavor.price / 2;
                          const combined = firstHalfPrice + flavorHalf;
                          return (
                            <button
                              type="button"
                              key={flavor.id}
                              onClick={() => {
                                setSelectedSecondFlavor(flavor);
                                if (bordaItems.length > 0) {
                                  scrollToSection(bordaSectionRef);
                                } else if (adicionalItems.length > 0) {
                                  scrollToSection(adicionaisSectionRef);
                                } else {
                                  scrollToSection(footerSectionRef);
                                }
                              }}
                              className="w-full p-2.5 rounded-xl text-left bg-white hover:bg-red-50 border border-slate-100 hover:border-red-200 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                                  {flavor.image ? (
                                    <img src={flavor.image} alt={flavor.name} className="w-full h-full object-contain" />
                                  ) : (
                                    <span className="text-lg">{isSweetPizza ? '🍫' : '🍕'}</span>
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

          {/* Bordas Recheadas (Exclusivo para Pizzas: 1 Borda Recheada OU SEM BORDA) */}
          {isPizza && bordaItems.length > 0 && (
            <div 
              ref={bordaSectionRef} 
              className={`space-y-3 pt-4 border-t border-slate-100 transition-all rounded-2xl ${
                bordaHighlightAlert ? 'p-3.5 bg-amber-50/90 border-2 border-amber-400 ring-4 ring-amber-300/30' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">{isSweetPizza ? '🍫' : '🥖'}</span>
                    <span>Recheio na Borda da Pizza</span>
                    {isBordaMandatory && (
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase transition-all ${
                        bordaSelection === null
                          ? 'bg-amber-500 text-white animate-pulse shadow-sm'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {bordaSelection === null ? '⚠️ Escolha Obrigatória' : '✓ Escolhido'}
                      </span>
                    )}
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {bordaSelection === 'NONE'
                      ? '✓ Opção escolhida: Massa tradicional sem recheio na borda.'
                      : (bordaSelection && typeof bordaSelection === 'object')
                      ? `✓ Borda "${bordaSelection.name}" selecionada. As demais foram desabilitadas.`
                      : isSweetPizza
                      ? 'Escolha o recheio na borda para a sua pizza doce (ou selecione "SEM BORDA" para a massa tradicional).'
                      : 'Escolha obrigatória: selecione 1 borda recheada ou marque "SEM BORDA" logo abaixo.'}
                  </p>
                </div>
                {bordaSelection !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setBordaSelection(null);
                      setBordaHighlightAlert(false);
                    }}
                    className="text-xs font-black text-slate-500 hover:text-red-600 underline cursor-pointer"
                  >
                    Trocar escolha
                  </button>
                )}
              </div>

              {bordaHighlightAlert && (
                <div className="bg-amber-100/90 border border-amber-300 text-amber-950 text-xs px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 animate-bounce">
                  <span>👉</span>
                  <span>Por favor, selecione uma Borda Recheada ou clique em <strong>SEM BORDA</strong> para continuar!</span>
                </div>
              )}

              {/* Opções de Bordas Recheadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {bordaItems.map(borda => {
                  const isSelected = bordaSelection !== 'NONE' && bordaSelection?.id === borda.id;
                  const isDisabled = Boolean(bordaSelection !== null && !isSelected);

                  return (
                    <button 
                      type="button"
                      key={borda.id}
                      disabled={isDisabled}
                      onClick={() => handleSelectBorda(borda)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-amber-500 bg-amber-50/90 text-amber-950 shadow-md ring-2 ring-amber-400/30 cursor-pointer' 
                          : isDisabled
                          ? 'border-slate-100 bg-slate-50/70 text-slate-300 opacity-50 cursor-not-allowed select-none'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/30 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-black transition-all ${
                          isSelected 
                            ? 'bg-amber-500 text-white' 
                            : isDisabled 
                            ? 'border border-slate-200 text-transparent' 
                            : 'border border-slate-300 text-transparent'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </span>
                        <div className="min-w-0">
                          <span className={`font-bold text-xs uppercase tracking-tight block truncate ${
                            isSelected ? 'text-amber-950' : isDisabled ? 'text-slate-400' : 'text-slate-800'
                          }`}>
                            {borda.name}
                          </span>
                          {isDisabled && (
                            <span className="text-[9px] font-bold text-slate-400 block">
                              🔒 Desabilitada (1 já escolhida)
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`font-black text-xs shrink-0 pl-2 ${
                        isSelected ? 'text-amber-700' : isDisabled ? 'text-slate-300' : 'text-slate-900'
                      }`}>
                        + R$ {borda.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Opção SEM BORDA (Logo abaixo das opções de borda) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSelectNoBorda}
                  disabled={Boolean(bordaSelection !== null && bordaSelection !== 'NONE')}
                  className={`w-full p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between text-left ${
                    bordaSelection === 'NONE'
                      ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-md ring-2 ring-emerald-400/30 cursor-pointer'
                      : (bordaSelection !== null && bordaSelection !== 'NONE')
                      ? 'border-slate-100 bg-slate-50/60 text-slate-300 opacity-50 cursor-not-allowed select-none'
                      : 'border-dashed border-slate-300 bg-slate-50/80 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-700 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-black transition-all ${
                      bordaSelection === 'NONE'
                        ? 'bg-emerald-600 text-white'
                        : (bordaSelection !== null && bordaSelection !== 'NONE')
                        ? 'border border-slate-200 text-transparent'
                        : 'border border-slate-400 text-transparent'
                    }`}>
                      {bordaSelection === 'NONE' ? '✓' : ''}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-xs sm:text-sm uppercase tracking-tight ${
                          bordaSelection === 'NONE' ? 'text-emerald-950' : 'text-slate-800'
                        }`}>
                          SEM BORDA
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                          bordaSelection === 'NONE' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                        }`}>
                          Tradicional
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Massa tradicional artesanal da casa, sem recheio na borda.
                      </p>
                      {(bordaSelection !== null && bordaSelection !== 'NONE') && (
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                          🔒 Desabilitado (Borda recheada já escolhida)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className={`font-black text-xs block ${
                      bordaSelection === 'NONE' ? 'text-emerald-700' : 'text-slate-500'
                    }`}>
                      R$ 0,00
                    </span>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase">Grátis</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Adicionais (Até no máximo 3 adicionais) */}
          {adicionalItems.length > 0 && (
            <div ref={adicionaisSectionRef} className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">➕</span>
                    <span>Adicionais</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                      selectedAdicionais.length === 3
                        ? 'bg-red-100 text-red-700'
                        : selectedAdicionais.length > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedAdicionais.length}/3 Escolhidos
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedAdicionais.length === 3 
                      ? '⚠️ Limite de 3 adicionais atingido. Desmarque um para escolher outro.' 
                      : 'Escolha até no máximo 3 adicionais opcionais.'}
                  </p>
                </div>
                {selectedAdicionais.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedAdicionais([])}
                    className="text-xs font-black text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    Limpar adicionais
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {adicionalItems.map(adic => {
                  const isSelected = selectedAdicionais.some(a => a.id === adic.id);
                  const isMaxReached = selectedAdicionais.length >= 3;
                  const isDisabled = isMaxReached && !isSelected;

                  return (
                    <button 
                      type="button"
                      key={adic.id}
                      disabled={isDisabled}
                      onClick={() => handleToggleAdicional(adic)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-red-500 bg-red-50/90 text-red-900 shadow-sm ring-2 ring-red-400/20 cursor-pointer' 
                          : isDisabled
                          ? 'border-slate-100 bg-slate-50/70 text-slate-300 opacity-50 cursor-not-allowed select-none'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 font-black transition-all ${
                          isSelected 
                            ? 'bg-red-600 text-white' 
                            : isDisabled 
                            ? 'border border-slate-200 text-transparent' 
                            : 'border border-slate-300 text-transparent'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </span>
                        <div className="min-w-0">
                          <span className={`font-bold text-xs uppercase tracking-tight block truncate ${
                            isSelected ? 'text-red-950' : isDisabled ? 'text-slate-400' : 'text-slate-800'
                          }`}>
                            {adic.name}
                          </span>
                          {isDisabled && (
                            <span className="text-[9px] font-bold text-slate-400 block">
                              🔒 Limite de 3 atingido
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`font-black text-xs shrink-0 pl-2 ${
                        isSelected ? 'text-red-600' : isDisabled ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        + R$ {adic.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Carrossel de Sugestões de Outros Itens na Hora da Compra */}
          {allProducts && allProducts.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5 p-3.5 sm:p-4 rounded-3xl border border-amber-200/70 shadow-xs">
                <SuggestedProductsCarousel
                  currentProduct={product}
                  allProducts={allProducts}
                  categories={categories}
                  onAddProduct={(suggested, qty) => {
                    if (onAddSuggestedProduct) {
                      onAddSuggestedProduct(suggested, qty);
                    } else {
                      onAdd(suggested, qty);
                    }
                  }}
                  onUpdateQuantity={onUpdateCartQuantity}
                  cartItems={cartItems}
                  title="Outros itens que você pode gostar"
                  subtitle="Aproveite para incluir bebidas geladas ou sobremesas no seu pedido"
                  logoUrl={logoUrl}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar: Quantity & Add Button */}
        <div ref={footerSectionRef} className="p-4 sm:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-20">
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
                ? (isPizza && !hasBordaDecision)
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                : 'bg-red-600 hover:bg-red-700 shadow-red-900/20'
            }`}
          >
            <span>
              {product.outOfStock 
                ? 'Produto Esgotado' 
                : (!isStoreOpen && !scheduleAllowed)
                ? 'Loja Fechada'
                : (isPizza && pizzaMode === 'MEIO_A_MEIO' && !selectedSecondFlavor)
                ? 'Escolha o 2º Sabor para Continuar'
                : (isPizza && isBordaMandatory && bordaSelection === null)
                ? '⚠️ Escolha a Borda (ou Sem Borda)'
                : (isPizza && pizzaMode === 'MEIO_A_MEIO')
                ? `Adicionar Meio a Meio • R$ ${totalPrice.toFixed(2)}`
                : `Adicionar ao Pedido • R$ ${totalPrice.toFixed(2)}`
              }
            </span>
            {canAddToCart() && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">➜</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
