import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product } from '../types';

interface Ingredient {
  id: string;
  name: string;
  cost: number;
  unit: string;
}

interface PizzaRecipeIngredient {
  ingredientId: string;
  quantity: number;
}

interface PizzaRecipe {
  id: string;
  name: string;
  ingredients: PizzaRecipeIngredient[];
  margin: number;
  productId?: string;
}

export const PizzaPricingCalculator: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<PizzaRecipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [autoSyncMenu, setAutoSyncMenu] = useState<boolean>(true);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // New Ingredient State
  const [newIngName, setNewIngName] = useState('');
  const [newIngCost, setNewIngCost] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [confirmDeleteIngredientId, setConfirmDeleteIngredientId] = useState<string | null>(null);

  // New Recipe State
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeMargin, setNewRecipeMargin] = useState('100'); // 100% margin standard
  const [newRecipeSalePrice, setNewRecipeSalePrice] = useState('');
  const [newRecipeCmv, setNewRecipeCmv] = useState('50.0'); // 50% CMV standard for 100% margin
  const [lastModifiedField, setLastModifiedField] = useState<'margin' | 'price' | 'cmv'>('margin');
  const [currentRecipeIngredients, setCurrentRecipeIngredients] = useState<PizzaRecipeIngredient[]>([]);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [confirmDeleteRecipeId, setConfirmDeleteRecipeId] = useState<string | null>(null);

  useEffect(() => {
    const unsubIngs = dbService.subscribe<Ingredient[]>('ingredients', (data) => {
      if (data) setIngredients(data);
      setLoading(false);
    });
    const unsubRecs = dbService.subscribe<PizzaRecipe[]>('pizza_recipes', (data) => {
      if (data) setRecipes(data);
    });
    const unsubProds = dbService.subscribe<Product[]>('products', (data) => {
      if (data) setProducts(data);
    });

    return () => {
      unsubIngs();
      unsubRecs();
      unsubProds();
    };
  }, []);

  const handleSaveIngredient = async () => {
    if (!newIngName || !newIngCost) return;
    
    if (editingIngredientId) {
      const ing = ingredients.find(i => i.id === editingIngredientId);
      if (ing) {
        const updatedIng = { ...ing, name: newIngName, cost: parseFloat(newIngCost), unit: newIngUnit };
        await dbService.save('ingredients', ing.id, updatedIng);
        setIngredients(ingredients.map(i => i.id === ing.id ? updatedIng : i));
        setEditingIngredientId(null);
      }
    } else {
      const ing: Ingredient = {
        id: Math.random().toString(36).substring(7),
        name: newIngName,
        cost: parseFloat(newIngCost),
        unit: newIngUnit
      };
      await dbService.save('ingredients', ing.id, ing);
      setIngredients([...ingredients, ing]);
    }
    setNewIngName('');
    setNewIngCost('');
    setNewIngUnit('kg');
  };

  const handleEditIngredient = (ing: Ingredient) => {
    setNewIngName(ing.name);
    setNewIngCost(ing.cost.toString());
    setNewIngUnit(ing.unit);
    setEditingIngredientId(ing.id);
    setTimeout(() => {
      ingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };
  
  const handleCancelEditIngredient = () => {
    setNewIngName('');
    setNewIngCost('');
    setNewIngUnit('kg');
    setEditingIngredientId(null);
  };

  const handleRemoveIngredient = async (id: string) => {
    await dbService.remove('ingredients', id);
    setIngredients(ingredients.filter(i => i.id !== id));
    
    if (editingIngredientId === id) {
      handleCancelEditIngredient();
    }
    setConfirmDeleteIngredientId(null);
  };

  const calculateRecipeCost = (recipeIngredients: PizzaRecipeIngredient[]) => {
    return recipeIngredients.reduce((total, ri) => {
      const ing = ingredients.find(i => i.id === ri.ingredientId);
      if (!ing) return total;
      
      const costPerUnit = ing.cost;
      const qty = ri.quantity;

      return total + (costPerUnit * qty);
    }, 0);
  };

  const handleMarginChange = (marginStr: string, currentIngs = currentRecipeIngredients) => {
    setNewRecipeMargin(marginStr);
    setLastModifiedField('margin');
    const m = parseFloat(marginStr);
    const cost = calculateRecipeCost(currentIngs);
    if (!isNaN(m) && cost > 0) {
      const calculatedPrice = cost * (1 + m / 100);
      setNewRecipeSalePrice(calculatedPrice.toFixed(2));
      const calculatedCmv = calculatedPrice > 0 ? (cost / calculatedPrice) * 100 : 0;
      setNewRecipeCmv(calculatedCmv.toFixed(1));
    } else if (marginStr === '') {
      setNewRecipeSalePrice('');
      setNewRecipeCmv('');
    }
  };

  const handleSalePriceChange = (priceStr: string, currentIngs = currentRecipeIngredients) => {
    setNewRecipeSalePrice(priceStr);
    setLastModifiedField('price');
    const price = parseFloat(priceStr);
    const cost = calculateRecipeCost(currentIngs);
    if (!isNaN(price) && cost > 0) {
      const calculatedMargin = ((price - cost) / cost) * 100;
      setNewRecipeMargin(calculatedMargin.toFixed(1));
      const calculatedCmv = price > 0 ? (cost / price) * 100 : 0;
      setNewRecipeCmv(calculatedCmv.toFixed(1));
    } else if (priceStr === '') {
      setNewRecipeMargin('');
      setNewRecipeCmv('');
    }
  };

  const handleCmvChange = (cmvStr: string, currentIngs = currentRecipeIngredients) => {
    setNewRecipeCmv(cmvStr);
    setLastModifiedField('cmv');
    const cmv = parseFloat(cmvStr);
    const cost = calculateRecipeCost(currentIngs);
    if (!isNaN(cmv) && cmv > 0 && cost > 0) {
      const calculatedPrice = cost / (cmv / 100);
      setNewRecipeSalePrice(calculatedPrice.toFixed(2));
      const calculatedMargin = ((calculatedPrice - cost) / cost) * 100;
      setNewRecipeMargin(calculatedMargin.toFixed(1));
    } else if (cmvStr === '') {
      setNewRecipeSalePrice('');
      setNewRecipeMargin('');
    }
  };

  const syncPricingOnIngredientsChange = (updatedIngs: PizzaRecipeIngredient[]) => {
    const cost = calculateRecipeCost(updatedIngs);
    if (cost > 0) {
      if (lastModifiedField === 'price' && newRecipeSalePrice !== '') {
        const price = parseFloat(newRecipeSalePrice);
        if (!isNaN(price)) {
          const calculatedMargin = ((price - cost) / cost) * 100;
          setNewRecipeMargin(calculatedMargin.toFixed(1));
          const calculatedCmv = price > 0 ? (cost / price) * 100 : 0;
          setNewRecipeCmv(calculatedCmv.toFixed(1));
        }
      } else if (lastModifiedField === 'cmv' && newRecipeCmv !== '') {
        const cmv = parseFloat(newRecipeCmv);
        if (!isNaN(cmv) && cmv > 0) {
          const calculatedPrice = cost / (cmv / 100);
          setNewRecipeSalePrice(calculatedPrice.toFixed(2));
          const calculatedMargin = ((calculatedPrice - cost) / cost) * 100;
          setNewRecipeMargin(calculatedMargin.toFixed(1));
        }
      } else {
        const m = parseFloat(newRecipeMargin);
        if (!isNaN(m)) {
          const calculatedPrice = cost * (1 + m / 100);
          setNewRecipeSalePrice(calculatedPrice.toFixed(2));
          const calculatedCmv = calculatedPrice > 0 ? (cost / calculatedPrice) * 100 : 0;
          setNewRecipeCmv(calculatedCmv.toFixed(1));
        }
      }
    }
  };

  const handleAddIngredientToRecipe = (ingredientId: string) => {
    if (!currentRecipeIngredients.find(i => i.ingredientId === ingredientId)) {
      const updated = [...currentRecipeIngredients, { ingredientId, quantity: 0 }];
      setCurrentRecipeIngredients(updated);
      syncPricingOnIngredientsChange(updated);
    }
  };

  const updateRecipeIngredientQuantity = (ingredientId: string, quantity: number) => {
    const updated = currentRecipeIngredients.map(i => i.ingredientId === ingredientId ? { ...i, quantity } : i);
    setCurrentRecipeIngredients(updated);
    syncPricingOnIngredientsChange(updated);
  };

  const removeRecipeIngredient = (ingredientId: string) => {
    const updated = currentRecipeIngredients.filter(i => i.ingredientId !== ingredientId);
    setCurrentRecipeIngredients(updated);
    syncPricingOnIngredientsChange(updated);
  };

  const formRef = useRef<HTMLDivElement>(null);
  const ingFormRef = useRef<HTMLDivElement>(null);

  const normalizeStr = (str: string) => {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const findProductForRecipe = (recipeName: string, productId?: string, productList: Product[] = products): Product | undefined => {
    // If productId provided, check if it's visible. If visible, return it.
    let productById: Product | undefined;
    if (productId) {
      productById = productList.find(p => p.id === productId);
      if (productById && !productById.hidden) return productById;
    }

    if (!recipeName || !recipeName.trim()) return productById;

    const normRecipe = normalizeStr(recipeName);

    // Sort products so visible products (!p.hidden) are checked FIRST
    const sortedProducts = [...productList].sort((a, b) => {
      if (!a.hidden && b.hidden) return -1;
      if (a.hidden && !b.hidden) return 1;
      return 0;
    });

    // 1. Exact match
    const exact = sortedProducts.find(p => normalizeStr(p.name) === normRecipe);
    if (exact) return exact;

    // 2. Keyword match (ignoring filler words)
    const cleanKeywords = (s: string) => s.split(' ').filter(w => !['pizza', 'pizzas', 'sabor', 'sabores', 'de', 'do', 'da', 'dos', 'das', 'com', 'ao', 'a', 'e', 'o', 'especial', 'tradicional', 'grande', 'broto', 'media'].includes(w) && w.length > 2);
    const recipeWords = cleanKeywords(normRecipe);

    if (recipeWords.length > 0) {
      const matched = sortedProducts.find(p => {
        const pWords = cleanKeywords(normalizeStr(p.name));
        if (pWords.length === 0) return false;
        const pInRecipe = pWords.every(w => normRecipe.includes(w));
        const recipeInP = recipeWords.every(w => normalizeStr(p.name).includes(w));
        return pInRecipe || recipeInP;
      });
      if (matched) return matched;
    }

    // 3. Substring match
    const sub = sortedProducts.find(p => {
      const pNorm = normalizeStr(p.name);
      return (pNorm.length > 3 && normRecipe.includes(pNorm)) || (normRecipe.length > 3 && pNorm.includes(normRecipe));
    });
    if (sub) return sub;

    return productById;
  };

  const findAllProductsForRecipe = (recipeName: string, productId?: string, productList: Product[] = products): Product[] => {
    const matchedSet = new Set<string>();
    const results: Product[] = [];

    // 1. Add by explicit ID if exists
    if (productId) {
      const p = productList.find(item => item.id === productId);
      if (p) {
        matchedSet.add(p.id);
        results.push(p);
      }
    }

    if (!recipeName || !recipeName.trim()) return results;

    const normRecipe = normalizeStr(recipeName);
    const cleanKeywords = (s: string) => s.split(' ').filter(w => !['pizza', 'pizzas', 'sabor', 'sabores', 'de', 'do', 'da', 'dos', 'das', 'com', 'ao', 'a', 'e', 'o', 'especial', 'tradicional', 'grande', 'broto', 'media'].includes(w) && w.length > 2);
    const recipeWords = cleanKeywords(normRecipe);

    productList.forEach(p => {
      if (matchedSet.has(p.id)) return;
      const pNorm = normalizeStr(p.name);

      if (pNorm === normRecipe) {
        matchedSet.add(p.id);
        results.push(p);
        return;
      }

      if (recipeWords.length > 0) {
        const pWords = cleanKeywords(pNorm);
        if (pWords.length > 0 && (pWords.every(w => normRecipe.includes(w)) || recipeWords.every(w => pNorm.includes(w)))) {
          matchedSet.add(p.id);
          results.push(p);
          return;
        }
      }

      if ((pNorm.length > 3 && normRecipe.includes(pNorm)) || (normRecipe.length > 3 && pNorm.includes(normRecipe))) {
        matchedSet.add(p.id);
        results.push(p);
      }
    });

    return results;
  };

  const handleSaveRecipe = async () => {
    if (!newRecipeName) return;
    
    const marginToSave = parseFloat(newRecipeMargin) || 0;
    const cost = calculateRecipeCost(currentRecipeIngredients);
    const calculatedPrice = parseFloat(newRecipeSalePrice) || (cost * (1 + marginToSave / 100));

    // Find linked or matching products (prioritizing visible ones)
    const matchingProducts = findAllProductsForRecipe(newRecipeName, selectedProductId, products);
    const targetProduct = matchingProducts.find(p => !p.hidden) || matchingProducts[0];

    const linkedProductId = targetProduct?.id || selectedProductId || undefined;

    // Sync ALL matching product prices in cardápio automatically if autoSyncMenu is enabled
    if (autoSyncMenu && calculatedPrice > 0 && matchingProducts.length > 0) {
      const roundedPrice = Number(calculatedPrice.toFixed(2));
      for (const prod of matchingProducts) {
        const updatedProduct: Product = { ...prod, price: roundedPrice };
        await dbService.save('products', prod.id, updatedProduct);
      }
      
      setProducts(prev => prev.map(p => {
        const isMatch = matchingProducts.some(m => m.id === p.id);
        return isMatch ? { ...p, price: roundedPrice } : p;
      }));
      
      setSyncNotification(`⚡ Preço de "${targetProduct?.name || newRecipeName}" (${matchingProducts.length} produto(s) no cardápio) atualizado para R$ ${calculatedPrice.toFixed(2)}!`);
      setTimeout(() => setSyncNotification(null), 5000);
    }

    if (editingRecipeId) {
      const recipe = recipes.find(r => r.id === editingRecipeId);
      if (recipe) {
        const updatedRecipe: PizzaRecipe = { 
          ...recipe, 
          name: newRecipeName, 
          ingredients: currentRecipeIngredients, 
          margin: marginToSave,
          productId: linkedProductId
        };
        await dbService.save('pizza_recipes', recipe.id, updatedRecipe);
        setRecipes(recipes.map(r => r.id === recipe.id ? updatedRecipe : r));
        setEditingRecipeId(null);
      }
    } else {
      const recipe: PizzaRecipe = {
        id: Math.random().toString(36).substring(7),
        name: newRecipeName,
        ingredients: currentRecipeIngredients,
        margin: marginToSave,
        productId: linkedProductId
      };
      await dbService.save('pizza_recipes', recipe.id, recipe);
      setRecipes([...recipes, recipe]);
    }
    
    setNewRecipeName('');
    setNewRecipeMargin('100');
    setNewRecipeSalePrice('');
    setNewRecipeCmv('50.0');
    setSelectedProductId('');
    setLastModifiedField('margin');
    setCurrentRecipeIngredients([]);
  };

  const syncPriceToProductDirectly = async (recipe: PizzaRecipe, explicitProductId?: string) => {
    const cost = calculateRecipeCost(recipe.ingredients);
    const price = Number((cost * (1 + recipe.margin / 100)).toFixed(2));
    
    // Find all matched products (both visible and hidden)
    const prodIdToFind = explicitProductId || recipe.productId;
    const matchingProds = findAllProductsForRecipe(recipe.name, prodIdToFind, products);
    
    if (matchingProds.length > 0) {
      // Update ALL matching products to guarantee visible store products are updated
      for (const prod of matchingProds) {
        const updatedProd = { ...prod, price };
        await dbService.save('products', prod.id, updatedProd);
      }

      setProducts(prev => prev.map(p => {
        const isMatch = matchingProds.some(m => m.id === p.id);
        return isMatch ? { ...p, price } : p;
      }));
      
      // Permanently link recipe to the visible (non-hidden) product
      const visibleProd = matchingProds.find(p => !p.hidden) || matchingProds[0];
      if (recipe.productId !== visibleProd.id) {
        const updatedRecipe = { ...recipe, productId: visibleProd.id };
        await dbService.save('pizza_recipes', recipe.id, updatedRecipe);
        setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));
      }
      
      setSyncNotification(`⚡ Preço de "${visibleProd.name}" atualizado para R$ ${price.toFixed(2)} no cardápio! (${matchingProds.length} produto(s) atualizados)`);
      setTimeout(() => setSyncNotification(null), 5000);
    } else {
      // Create new product directly in cardápio
      const newProdId = Math.random().toString(36).substring(7);
      const newProd: Product = {
        id: newProdId,
        name: recipe.name,
        description: 'Pizza artesanal com ingredientes selecionados.',
        price,
        category: 'Pizzas',
        image: '',
        rating: 5.0,
        hidden: false
      };
      await dbService.save('products', newProdId, newProd);
      setProducts(prev => [...prev, newProd]);
      
      const updatedRecipe = { ...recipe, productId: newProdId };
      await dbService.save('pizza_recipes', recipe.id, updatedRecipe);
      setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));
      
      setSyncNotification(`✨ Produto "${recipe.name}" criado no cardápio por R$ ${price.toFixed(2)}!`);
      setTimeout(() => setSyncNotification(null), 5000);
    }
  };

  const handleLinkProductToRecipe = async (recipe: PizzaRecipe, productId: string) => {
    const updatedRecipe = { ...recipe, productId: productId || undefined };
    await dbService.save('pizza_recipes', recipe.id, updatedRecipe);
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));
    
    if (productId) {
      const prod = products.find(p => p.id === productId);
      setSyncNotification(`🔗 Receita "${recipe.name}" vinculada ao produto "${prod?.name || productId}"!`);
      setTimeout(() => setSyncNotification(null), 4000);
    }
  };

  const handleSyncAllRecipes = async () => {
    let syncedCount = 0;
    const currentProds = await dbService.getAll<Product>('products');
    
    for (const recipe of recipes) {
      const cost = calculateRecipeCost(recipe.ingredients);
      const price = Number((cost * (1 + recipe.margin / 100)).toFixed(2));
      const matching = findAllProductsForRecipe(recipe.name, recipe.productId, currentProds);
      
      if (matching.length > 0 && price > 0) {
        for (const prod of matching) {
          await dbService.save('products', prod.id, { ...prod, price });
        }
        const visibleProd = matching.find(p => !p.hidden) || matching[0];
        if (recipe.productId !== visibleProd.id) {
          await dbService.save('pizza_recipes', recipe.id, { ...recipe, productId: visibleProd.id });
        }
        syncedCount++;
      }
    }
    const updatedProds = await dbService.getAll<Product>('products');
    setProducts(updatedProds);
    const updatedRecs = await dbService.getAll<PizzaRecipe>('pizza_recipes');
    setRecipes(updatedRecs);
    setSyncNotification(`⚡ ${syncedCount} receitas sincronizadas com sucesso em todos os produtos do cardápio!`);
    setTimeout(() => setSyncNotification(null), 5000);
  };

  const handleEditRecipe = (recipe: PizzaRecipe) => {
    const cost = calculateRecipeCost(recipe.ingredients || []);
    const price = cost * (1 + recipe.margin / 100);
    const cmv = price > 0 ? (cost / price) * 100 : 0;
    setNewRecipeName(recipe.name);
    setNewRecipeMargin(recipe.margin.toString());
    setNewRecipeSalePrice(cost > 0 ? price.toFixed(2) : '');
    setNewRecipeCmv(cost > 0 ? cmv.toFixed(1) : '');
    
    // Auto-detect matching product if not explicitly set
    const matched = findProductForRecipe(recipe.name, recipe.productId, products);
    setSelectedProductId(recipe.productId || matched?.id || '');
    
    setLastModifiedField('margin');
    setCurrentRecipeIngredients([...(recipe.ingredients || [])]);
    setEditingRecipeId(recipe.id);
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };
  
  const handleCancelEditRecipe = () => {
    setNewRecipeName('');
    setNewRecipeMargin('100');
    setNewRecipeSalePrice('');
    setNewRecipeCmv('50.0');
    setSelectedProductId('');
    setLastModifiedField('margin');
    setCurrentRecipeIngredients([]);
    setEditingRecipeId(null);
  };

  const getCmvBadge = (cmvVal: number) => {
    if (isNaN(cmvVal) || cmvVal <= 0) return null;
    if (cmvVal <= 30) {
      return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">CMV Ótimo ({cmvVal.toFixed(1)}%)</span>;
    } else if (cmvVal <= 35) {
      return <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">CMV Ideal ({cmvVal.toFixed(1)}%)</span>;
    } else if (cmvVal <= 40) {
      return <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">CMV Moderado ({cmvVal.toFixed(1)}%)</span>;
    } else {
      return <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">CMV Alto ({cmvVal.toFixed(1)}%)</span>;
    }
  };

  const handleRemoveRecipe = async (id: string) => {
    await dbService.remove('pizza_recipes', id);
    setRecipes(recipes.filter(r => r.id !== id));
    
    if (editingRecipeId === id) {
      handleCancelEditRecipe();
    }
    setConfirmDeleteRecipeId(null);
  };

  if (loading) return <div className="p-8 text-center animate-pulse font-bold text-slate-500">Carregando Calculadora...</div>;

  const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-red-500 transition-all";
  const labelClass = "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div ref={ingFormRef} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3">
          <span className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center text-xl">🍅</span>
          Banco de Ingredientes
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1 md:col-span-2">
            <label className={labelClass}>Nome do Ingrediente</label>
            <input type="text" value={newIngName} onChange={e => setNewIngName(e.target.value)} placeholder="Ex: Mussarela" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Custo (R$)</label>
            <input type="number" value={newIngCost} onChange={e => setNewIngCost(e.target.value)} placeholder="Ex: 35.00" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Unidade de Medida</label>
            <select value={newIngUnit} onChange={e => setNewIngUnit(e.target.value)} className={inputClass}>
              <option value="kg">Por Kg</option>
              <option value="g">Por Grama (g)</option>
              <option value="l">Por Litro</option>
              <option value="ml">Por Mililitro (ml)</option>
              <option value="un">Por Unidade</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mb-8">
          {editingIngredientId && (
            <button onClick={handleCancelEditIngredient} className="bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-300 transition-all">
              Cancelar Edição
            </button>
          )}
          <button onClick={handleSaveIngredient} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all">
            {editingIngredientId ? 'Salvar Alterações' : '+ Adicionar Ingrediente'}
          </button>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase font-black text-slate-500">
              <tr>
                <th className="px-6 py-4">Ingrediente</th>
                <th className="px-6 py-4">Custo Base</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-bold text-slate-700">
              {ingredients.map(ing => (
                <tr key={ing.id} className={`hover:bg-white transition-colors ${editingIngredientId === ing.id ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-4">{ing.name}</td>
                  <td className="px-6 py-4">R$ {ing.cost.toFixed(2)} / {ing.unit}</td>
                  <td className="px-6 py-4 text-right space-x-4">
                    <button onClick={() => handleEditIngredient(ing)} className="text-blue-500 hover:text-blue-700 transition-colors">Editar</button>
                    {confirmDeleteIngredientId === ing.id ? (
                      <span className="inline-flex gap-2 items-center">
                        <span className="text-xs text-red-500 font-bold">Tem certeza?</span>
                        <button onClick={() => handleRemoveIngredient(ing.id)} className="text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-xs transition-colors">Sim</button>
                        <button onClick={() => setConfirmDeleteIngredientId(null)} className="text-slate-500 hover:text-slate-700 transition-colors text-xs">Não</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteIngredientId(ing.id)} className="text-red-500 hover:text-red-700 transition-colors">Excluir</button>
                    )}
                  </td>
                </tr>
              ))}
              {ingredients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">Nenhum ingrediente cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={formRef} className={`bg-white p-8 rounded-[40px] border shadow-sm space-y-6 transition-all ${editingRecipeId ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-200'}`}>
        {editingRecipeId && (
          <div className="bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-md font-black text-xs flex items-center justify-between uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <span className="text-base">✏️</span> Editando Receita: <u className="underline-offset-4">{newRecipeName}</u>
            </span>
            <button onClick={handleCancelEditRecipe} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all">
              Cancelar Edição
            </button>
          </div>
        )}

        {syncNotification && (
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-lg font-black text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
            <span>{syncNotification}</span>
            <button onClick={() => setSyncNotification(null)} className="text-white hover:opacity-80 font-bold ml-4">✕</button>
          </div>
        )}

        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center text-xl">🍕</span>
            Calculadora de Precificação
          </div>
          {editingRecipeId && (
            <button onClick={handleCancelEditRecipe} className="text-xs font-bold bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300">
              Cancelar Edição
            </button>
          )}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className={labelClass}>Nome da Pizza / Receita</label>
              <input 
                type="text" 
                value={newRecipeName} 
                onChange={e => {
                  const val = e.target.value;
                  setNewRecipeName(val);
                  const matched = findProductForRecipe(val, undefined, products);
                  if (matched && !selectedProductId) {
                    setSelectedProductId(matched.id);
                  }
                }} 
                placeholder="Ex: Pizza Calabresa Grande" 
                className={inputClass} 
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Vincular ao Produto do Cardápio (Opcional)</label>
              <select 
                value={selectedProductId} 
                onChange={e => {
                  const val = e.target.value;
                  setSelectedProductId(val);
                  if (val) {
                    const p = products.find(prod => prod.id === val);
                    if (p && !newRecipeName) {
                      setNewRecipeName(p.name);
                    }
                  }
                }} 
                className={inputClass}
              >
                <option value="">-- Auto-buscar produto habilitado na loja --</option>
                {[...products]
                  .sort((a, b) => {
                    if (!a.hidden && b.hidden) return -1;
                    if (a.hidden && !b.hidden) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.hidden ? '🙈 [Oculto] ' : '👁️ [Na Loja] '} {p.name} (R$ {p.price.toFixed(2)})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1 pb-2">
              <input 
                type="checkbox" 
                id="autoSyncMenu" 
                checked={autoSyncMenu} 
                onChange={e => setAutoSyncMenu(e.target.checked)} 
                className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" 
              />
              <label htmlFor="autoSyncMenu" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                ⚡ Atualizar preço no cardápio automaticamente ao salvar
              </label>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Valor Venda (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={newRecipeSalePrice} 
                  onChange={e => handleSalePriceChange(e.target.value)} 
                  placeholder="Ex: 50.00" 
                  className={inputClass} 
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>CMV Desejado (%)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={newRecipeCmv} 
                  onChange={e => handleCmvChange(e.target.value)} 
                  placeholder="Ex: 30" 
                  className={inputClass} 
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Margem (%)</label>
                <input 
                  type="number" 
                  value={newRecipeMargin} 
                  onChange={e => handleMarginChange(e.target.value)} 
                  placeholder="Ex: 100" 
                  className={inputClass} 
                />
              </div>
            </div>

            {/* Caixa Informativa sobre CMV */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs space-y-1 text-slate-700">
              <div className="flex items-center justify-between font-black text-amber-900 uppercase tracking-wide">
                <span>💡 O que é CMV (Custo de Mercadoria Vendida)?</span>
                {newRecipeCmv && getCmvBadge(parseFloat(newRecipeCmv))}
              </div>
              <p className="text-slate-600 leading-relaxed">
                O CMV indica qual porcentagem do valor da venda é consumida pelos ingredientes. 
                Nas pizzarias, o valor ideal de CMV varia entre <strong>25% e 35%</strong> para garantir boa lucratividade.
              </p>
            </div>
            
            <div className="space-y-2 pt-2">
              <label className={labelClass}>Adicionar Ingrediente na Receita</label>
              <div className="flex gap-2">
                <select id="ing-select" className={inputClass} defaultValue="">
                  <option value="" disabled>Selecione um ingrediente...</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name} (R$ {ing.cost.toFixed(2)}/{ing.unit})</option>
                  ))}
                </select>
                <button 
                  onClick={() => {
                    const sel = document.getElementById('ing-select') as HTMLSelectElement;
                    if (sel.value) {
                      handleAddIngredientToRecipe(sel.value);
                      sel.value = "";
                    }
                  }}
                  className="bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-black hover:bg-slate-300 transition-all"
                >
                  Incluir
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Composição</h4>
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] no-scrollbar">
              {currentRecipeIngredients.length === 0 ? (
                <div className="text-center text-slate-400 text-xs font-bold py-8">Nenhum ingrediente adicionado à receita.</div>
              ) : (
                currentRecipeIngredients.map(ri => {
                  const ing = ingredients.find(i => i.id === ri.ingredientId);
                  if (!ing) return null;
                  return (
                    <div key={ri.ingredientId} className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <span className="text-xs font-bold text-slate-700 flex-1">{ing.name}</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={ri.quantity || ''} 
                          onChange={e => updateRecipeIngredientQuantity(ri.ingredientId, parseFloat(e.target.value) || 0)} 
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center focus:ring-2 focus:ring-red-500"
                          placeholder="Qtd"
                        />
                        <span className="text-[10px] font-black text-slate-400 uppercase w-8">{ing.unit}</span>
                        <button onClick={() => removeRecipeIngredient(ri.ingredientId)} className="text-red-400 hover:text-red-600 ml-2">✖</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>Custo Total Ingredientes:</span>
                <span className="text-red-600">R$ {calculateRecipeCost(currentRecipeIngredients).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>CMV da Receita:</span>
                <span className="text-amber-600 font-black">{newRecipeCmv ? `${newRecipeCmv}%` : '-'}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>Margem sobre Custo:</span>
                <span className="text-blue-600 font-black">{newRecipeMargin ? `${newRecipeMargin}%` : '-'}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-black text-slate-800 pt-1 border-t border-slate-200/60">
                <span>Preço Sugerido (Venda):</span>
                <span className="text-emerald-600">
                  R$ {(calculateRecipeCost(currentRecipeIngredients) * (1 + parseFloat(newRecipeMargin || '0') / 100)).toFixed(2)}
                </span>
              </div>
              <button 
                onClick={handleSaveRecipe} 
                disabled={!newRecipeName.trim()}
                className={`w-full mt-4 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-md ${
                  newRecipeName.trim() 
                    ? editingRecipeId ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                {editingRecipeId ? '💾 Salvar Alterações da Receita' : '🚀 Salvar Receita'}
              </button>
            </div>
          </div>
        </div>

        {recipes.length > 0 && (
           <div className="mt-12">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
               <div>
                 <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Receitas Salvas ({recipes.length})</h4>
                 <p className="text-xs text-slate-500 mt-0.5">Gerencie os custos e sincronize os preços diretamente com o cardápio</p>
               </div>
               <button 
                 onClick={handleSyncAllRecipes}
                 className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2"
               >
                 <span>⚡ Sincronizar Todos no Cardápio</span>
               </button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {recipes.map(recipe => {
                 const cost = calculateRecipeCost(recipe.ingredients);
                 const price = Number((cost * (1 + recipe.margin / 100)).toFixed(2));
                 const cmvVal = price > 0 ? (cost / price) * 100 : 0;
                 const matchingProds = findAllProductsForRecipe(recipe.name, recipe.productId, products);
                 const matchedProd = matchingProds.find(p => !p.hidden) || matchingProds[0] || products.find(p => p.id === recipe.productId) || findProductForRecipe(recipe.name, recipe.productId, products);
                 const isSynced = matchedProd && Math.abs(matchedProd.price - price) < 0.01;

                 return (
                   <div key={recipe.id} className={`bg-slate-50 border p-6 rounded-3xl relative group flex flex-col justify-between ${editingRecipeId === recipe.id ? 'ring-2 ring-red-500 border-red-400' : isSynced ? 'border-slate-200' : 'border-amber-300 bg-amber-50/20'}`}>
                     <div>
                       <div className="absolute top-4 right-4 flex gap-2 z-10">
                         <button onClick={() => handleEditRecipe(recipe)} className="text-blue-500 hover:text-blue-700 font-bold text-xs bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 transition-colors">Editar</button>
                         {confirmDeleteRecipeId === recipe.id ? (
                           <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                             <span className="text-xs text-red-500 font-bold">Excluir?</span>
                             <button onClick={() => handleRemoveRecipe(recipe.id)} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded text-xs transition-colors">Sim</button>
                             <button onClick={() => setConfirmDeleteRecipeId(null)} className="text-slate-500 hover:text-slate-700 text-xs transition-colors">Não</button>
                           </div>
                         ) : (
                           <button onClick={() => setConfirmDeleteRecipeId(recipe.id)} className="text-red-500 hover:text-red-700 font-bold text-xs bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 transition-colors">Excluir</button>
                         )}
                       </div>
                       <h5 className="font-black text-slate-800 text-lg mb-2 pr-24">{recipe.name}</h5>
                       <div className="mb-4">
                         {getCmvBadge(cmvVal)}
                       </div>
                       <div className="space-y-1 mb-6">
                         {recipe.ingredients.map(ri => {
                           const ing = ingredients.find(i => i.id === ri.ingredientId);
                           return ing ? (
                             <div key={ri.ingredientId} className="flex justify-between text-xs font-bold text-slate-500 border-b border-slate-200/50 pb-1">
                               <span>{ri.quantity} {ing.unit} {ing.name}</span>
                               <span>R$ {(ing.cost * ri.quantity).toFixed(2)}</span>
                             </div>
                           ) : null;
                         })}
                       </div>
                       <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                          <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <span>Custo Ingredientes</span>
                            <span className="text-red-600">R$ {cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <span>CMV</span>
                            <span className="text-amber-600 font-black">{cmvVal.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <span>Margem sobre Custo</span>
                            <span className="text-blue-600">{recipe.margin}%</span>
                          </div>
                          <div className="flex justify-between text-sm font-black text-slate-800 uppercase tracking-widest pt-2 border-t border-slate-100">
                            <span>Preço Venda (Calculadora)</span>
                            <span className="text-emerald-600">R$ {price.toFixed(2)}</span>
                          </div>
                       </div>
                     </div>

                      {/* Status no Cardápio & Sincronização */}
                      <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-2">
                        {matchedProd ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                              <div className="truncate mr-2 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Produto:</span>
                                  {matchedProd.hidden ? (
                                    <span className="text-[9px] font-black bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">🙈 Oculto</span>
                                  ) : (
                                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">👁️ Habilitado na Loja</span>
                                  )}
                                </div>
                                <span className="font-black text-slate-800 truncate block text-xs" title={matchedProd.name}>
                                  {matchedProd.name}
                                </span>
                                <span className="text-xs font-bold text-slate-500">
                                  Atual no Cardápio: <strong className={matchedProd.price === 0 ? 'text-red-500 underline' : 'text-slate-800'}>R$ {matchedProd.price.toFixed(2)}</strong>
                                </span>
                                {matchingProds.length > 1 && (
                                  <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
                                    ℹ️ {matchingProds.length} cadastros vinculados (ambos serão sincronizados)
                                  </span>
                                )}
                              </div>
                              {isSynced ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase whitespace-nowrap">
                                  ✓ Sincronizado
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase whitespace-nowrap animate-pulse">
                                  Divergente
                                </span>
                              )}
                            </div>
                            
                            {!isSynced && (
                              <button 
                                onClick={() => syncPriceToProductDirectly(recipe, matchedProd.id)}
                                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-black text-[11px] py-2.5 rounded-xl uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                              >
                                <span>⚡ Sincronizar "{matchedProd.name}" para R$ {price.toFixed(2)}</span>
                              </button>
                            )}

                            <div className="flex items-center gap-1 text-[10px] text-slate-400 justify-end">
                              <span>Vínculo:</span>
                              <select 
                                value={recipe.productId || matchedProd.id}
                                onChange={(e) => handleLinkProductToRecipe(recipe, e.target.value)}
                                className="bg-transparent border-0 text-blue-600 font-bold text-[10px] p-0 underline cursor-pointer focus:ring-0 max-w-[200px] truncate"
                              >
                                {[...products]
                                  .sort((a, b) => {
                                    if (!a.hidden && b.hidden) return -1;
                                    if (a.hidden && !b.hidden) return 1;
                                    return a.name.localeCompare(b.name);
                                  })
                                  .map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.hidden ? '🙈 [Oculto] ' : '👁️ [Na Loja] '} {p.name} (R$ {p.price.toFixed(2)})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-slate-600 flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Nenhum produto correspondente:</span>
                              <select 
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) handleLinkProductToRecipe(recipe, e.target.value);
                                }}
                                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-1.5 text-slate-700"
                              >
                                <option value="">🔗 Selecionar produto existente para vincular...</option>
                                {[...products]
                                  .sort((a, b) => {
                                    if (!a.hidden && b.hidden) return -1;
                                    if (a.hidden && !b.hidden) return 1;
                                    return a.name.localeCompare(b.name);
                                  })
                                  .map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.hidden ? '🙈 [Oculto] ' : '👁️ [Na Loja] '} {p.name} (R$ {p.price.toFixed(2)})
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <button 
                              onClick={() => syncPriceToProductDirectly(recipe)}
                              className="w-full bg-slate-800 hover:bg-black text-white font-black text-[11px] py-2 rounded-xl uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <span>➕ Criar Novo Produto no Cardápio (R$ {price.toFixed(2)})</span>
                            </button>
                          </div>
                        )}
                      </div>
                   </div>
                 );
               })}
             </div>
           </div>
        )}
      </div>
    </div>
  );
};
