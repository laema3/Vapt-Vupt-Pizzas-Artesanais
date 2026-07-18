const fs = require('fs');
let code = fs.readFileSync('src/components/PizzaPricingCalculator.tsx', 'utf8');

// Add state variables
code = code.replace(
  "const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);",
  "const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);\n  const [confirmDeleteIngredientId, setConfirmDeleteIngredientId] = useState<string | null>(null);"
);

code = code.replace(
  "const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);",
  "const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);\n  const [confirmDeleteRecipeId, setConfirmDeleteRecipeId] = useState<string | null>(null);"
);

// Update handleRemoveIngredient
const oldHandleRemoveIngredient = `const handleRemoveIngredient = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este ingrediente?')) {
      await dbService.remove('ingredients', id);
      setIngredients(ingredients.filter(i => i.id !== id));
      
      if (editingIngredientId === id) {
        handleCancelEditIngredient();
      }
    }
  };`;

const newHandleRemoveIngredient = `const handleRemoveIngredient = async (id: string) => {
    await dbService.remove('ingredients', id);
    setIngredients(ingredients.filter(i => i.id !== id));
    
    if (editingIngredientId === id) {
      handleCancelEditIngredient();
    }
    setConfirmDeleteIngredientId(null);
  };`;
code = code.replace(oldHandleRemoveIngredient, newHandleRemoveIngredient);

// Update handleRemoveRecipe
const oldHandleRemoveRecipe = `const handleRemoveRecipe = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta receita?')) {
      await dbService.remove('pizza_recipes', id);
      setRecipes(recipes.filter(r => r.id !== id));
      
      if (editingRecipeId === id) {
        handleCancelEditRecipe();
      }
    }
  };`;

const newHandleRemoveRecipe = `const handleRemoveRecipe = async (id: string) => {
    await dbService.remove('pizza_recipes', id);
    setRecipes(recipes.filter(r => r.id !== id));
    
    if (editingRecipeId === id) {
      handleCancelEditRecipe();
    }
    setConfirmDeleteRecipeId(null);
  };`;
code = code.replace(oldHandleRemoveRecipe, newHandleRemoveRecipe);

// Update Ingredient buttons in the table
const oldIngButtons = `<td className="px-6 py-4 text-right space-x-4">
                    <button onClick={() => handleEditIngredient(ing)} className="text-blue-500 hover:text-blue-700 transition-colors">Editar</button>
                    <button onClick={() => handleRemoveIngredient(ing.id)} className="text-red-500 hover:text-red-700 transition-colors">Excluir</button>
                  </td>`;
                  
const newIngButtons = `<td className="px-6 py-4 text-right space-x-4">
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
                  </td>`;
code = code.replace(oldIngButtons, newIngButtons);

// Update Recipe buttons in the cards
const oldRecButtons = `<div className="absolute top-4 right-4 flex gap-2 z-10">
                       <button onClick={() => handleEditRecipe(recipe)} className="text-blue-500 hover:text-blue-700 font-bold text-xs bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 transition-colors">Editar</button>
                       <button onClick={() => handleRemoveRecipe(recipe.id)} className="text-red-500 hover:text-red-700 font-bold text-xs bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 transition-colors">Excluir</button>
                     </div>`;

const newRecButtons = `<div className="absolute top-4 right-4 flex gap-2 z-10">
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
                     </div>`;
code = code.replace(oldRecButtons, newRecButtons);

fs.writeFileSync('src/components/PizzaPricingCalculator.tsx', code);
