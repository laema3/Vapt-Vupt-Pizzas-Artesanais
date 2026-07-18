const fs = require('fs');

const code = `import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';

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
}

export const PizzaPricingCalculator: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<PizzaRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  // New Ingredient State
  const [newIngName, setNewIngName] = useState('');
  const [newIngCost, setNewIngCost] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);

  // New Recipe State
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeMargin, setNewRecipeMargin] = useState('100'); // 100% margin standard
  const [currentRecipeIngredients, setCurrentRecipeIngredients] = useState<PizzaRecipeIngredient[]>([]);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const ings = await dbService.getAll<Ingredient>('ingredients');
        const recs = await dbService.getAll<PizzaRecipe>('pizza_recipes');
        setIngredients(ings);
        setRecipes(recs);
      } catch (e) {
        console.error("Error loading pricing data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
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
  };
  
  const handleCancelEditIngredient = () => {
    setNewIngName('');
    setNewIngCost('');
    setNewIngUnit('kg');
    setEditingIngredientId(null);
  };

  const handleRemoveIngredient = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este ingrediente?')) {
      await dbService.remove('ingredients', id);
      setIngredients(ingredients.filter(i => i.id !== id));
      
      if (editingIngredientId === id) {
        handleCancelEditIngredient();
      }
    }
  };

  const handleAddIngredientToRecipe = (ingredientId: string) => {
    if (!currentRecipeIngredients.find(i => i.ingredientId === ingredientId)) {
      setCurrentRecipeIngredients([...currentRecipeIngredients, { ingredientId, quantity: 0 }]);
    }
  };

  const updateRecipeIngredientQuantity = (ingredientId: string, quantity: number) => {
    setCurrentRecipeIngredients(currentRecipeIngredients.map(i => i.ingredientId === ingredientId ? { ...i, quantity } : i));
  };

  const removeRecipeIngredient = (ingredientId: string) => {
    setCurrentRecipeIngredients(currentRecipeIngredients.filter(i => i.ingredientId !== ingredientId));
  };

  const handleSaveRecipe = async () => {
    if (!newRecipeName) return;
    
    if (editingRecipeId) {
      const recipe = recipes.find(r => r.id === editingRecipeId);
      if (recipe) {
        const updatedRecipe = { ...recipe, name: newRecipeName, ingredients: currentRecipeIngredients, margin: parseFloat(newRecipeMargin) };
        await dbService.save('pizza_recipes', recipe.id, updatedRecipe);
        setRecipes(recipes.map(r => r.id === recipe.id ? updatedRecipe : r));
        setEditingRecipeId(null);
      }
    } else {
      const recipe: PizzaRecipe = {
        id: Math.random().toString(36).substring(7),
        name: newRecipeName,
        ingredients: currentRecipeIngredients,
        margin: parseFloat(newRecipeMargin)
      };
      await dbService.save('pizza_recipes', recipe.id, recipe);
      setRecipes([...recipes, recipe]);
    }
    
    setNewRecipeName('');
    setNewRecipeMargin('100');
    setCurrentRecipeIngredients([]);
  };

  const handleEditRecipe = (recipe: PizzaRecipe) => {
    setNewRecipeName(recipe.name);
    setNewRecipeMargin(recipe.margin.toString());
    setCurrentRecipeIngredients([...recipe.ingredients]);
    setEditingRecipeId(recipe.id);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEditRecipe = () => {
    setNewRecipeName('');
    setNewRecipeMargin('100');
    setCurrentRecipeIngredients([]);
    setEditingRecipeId(null);
  };

  const handleRemoveRecipe = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta receita?')) {
      await dbService.remove('pizza_recipes', id);
      setRecipes(recipes.filter(r => r.id !== id));
      
      if (editingRecipeId === id) {
        handleCancelEditRecipe();
      }
    }
  };

  const calculateRecipeCost = (recipeIngredients: PizzaRecipeIngredient[]) => {
    return recipeIngredients.reduce((total, ri) => {
      const ing = ingredients.find(i => i.id === ri.ingredientId);
      if (!ing) return total;
      
      let costPerUnit = ing.cost;
      let qty = ri.quantity;

      return total + (costPerUnit * qty);
    }, 0);
  };

  if (loading) return <div className="p-8 text-center animate-pulse font-bold text-slate-500">Carregando Calculadora...</div>;

  const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-red-500 transition-all";
  const labelClass = "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
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
                <tr key={ing.id} className={\`hover:bg-white transition-colors \${editingIngredientId === ing.id ? 'bg-red-50' : ''}\`}>
                  <td className="px-6 py-4">{ing.name}</td>
                  <td className="px-6 py-4">R$ {ing.cost.toFixed(2)} / {ing.unit}</td>
                  <td className="px-6 py-4 text-right space-x-4">
                    <button onClick={() => handleEditIngredient(ing)} className="text-blue-500 hover:text-blue-700 transition-colors">Editar</button>
                    <button onClick={() => handleRemoveIngredient(ing.id)} className="text-red-500 hover:text-red-700 transition-colors">Excluir</button>
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

      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center justify-between">
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
              <input type="text" value={newRecipeName} onChange={e => setNewRecipeName(e.target.value)} placeholder="Ex: Pizza Calabresa Grande" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Margem de Lucro Desejada (%)</label>
              <input type="number" value={newRecipeMargin} onChange={e => setNewRecipeMargin(e.target.value)} placeholder="Ex: 100" className={inputClass} />
            </div>
            
            <div className="space-y-2 pt-4">
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
            
            {currentRecipeIngredients.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                  <span>Custo Total Ingredientes:</span>
                  <span className="text-red-600">R$ {calculateRecipeCost(currentRecipeIngredients).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-black text-slate-800">
                  <span>Preço Sugerido (Venda):</span>
                  <span className="text-emerald-600">
                    R$ {(calculateRecipeCost(currentRecipeIngredients) * (1 + parseFloat(newRecipeMargin || '0') / 100)).toFixed(2)}
                  </span>
                </div>
                <button onClick={handleSaveRecipe} className="w-full mt-4 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all shadow-md">
                  {editingRecipeId ? 'Salvar Alterações da Receita' : 'Salvar Receita'}
                </button>
              </div>
            )}
          </div>
        </div>

        {recipes.length > 0 && (
           <div className="mt-12">
             <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Receitas Salvas</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {recipes.map(recipe => {
                 const cost = calculateRecipeCost(recipe.ingredients);
                 const price = cost * (1 + recipe.margin / 100);
                 return (
                   <div key={recipe.id} className={\`bg-slate-50 border border-slate-200 p-6 rounded-3xl relative group \${editingRecipeId === recipe.id ? 'ring-2 ring-red-500' : ''}\`}>
                     <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => handleEditRecipe(recipe)} className="text-slate-400 hover:text-blue-500 font-bold text-xs bg-white px-2 py-1 rounded shadow-sm border border-slate-200">Editar</button>
                       <button onClick={() => handleRemoveRecipe(recipe.id)} className="text-slate-400 hover:text-red-500 font-bold text-xs bg-white px-2 py-1 rounded shadow-sm border border-slate-200">Excluir</button>
                     </div>
                     <h5 className="font-black text-slate-800 text-lg mb-4 pr-24">{recipe.name}</h5>
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
                          <span>Custo</span>
                          <span className="text-red-600">R$ {cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                          <span>Margem</span>
                          <span className="text-amber-500">{recipe.margin}%</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-slate-800 uppercase tracking-widest pt-2 border-t border-slate-100">
                          <span>Venda</span>
                          <span className="text-emerald-600">R$ {price.toFixed(2)}</span>
                        </div>
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
`;

fs.writeFileSync('src/components/PizzaPricingCalculator.tsx', code);
