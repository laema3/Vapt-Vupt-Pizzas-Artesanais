import * as XLSX from 'xlsx';
import { Product } from '../types';

export interface IngredientData {
  id: string;
  name: string;
  cost: number;
  unit: string;
}

export interface PizzaRecipeIngredientData {
  ingredientId: string;
  quantity: number;
}

export interface PizzaRecipeData {
  id: string;
  name: string;
  ingredients: PizzaRecipeIngredientData[];
  margin: number;
  productId?: string;
}

export function exportPricingToExcel(
  ingredients: IngredientData[],
  recipes: PizzaRecipeData[],
  products: Product[],
  calculateRecipeCost: (ings: PizzaRecipeIngredientData[]) => number
) {
  const wb = XLSX.utils.book_new();

  // Helper for CMV classification
  const getCmvStatus = (cmv: number) => {
    if (isNaN(cmv) || cmv <= 0) return 'Indefinido';
    if (cmv <= 30) return 'Ótimo (<=30%)';
    if (cmv <= 35) return 'Ideal (31-35%)';
    if (cmv <= 40) return 'Moderado (36-40%)';
    return 'Alto (>40%)';
  };

  // 1. ABA 1: Resumo de Precificação & CMV das Receitas
  const pricingSummaryRows = recipes.map(recipe => {
    const cost = calculateRecipeCost(recipe.ingredients || []);
    const suggestedPrice = Number((cost * (1 + (recipe.margin || 0) / 100)).toFixed(2));
    const cmvVal = suggestedPrice > 0 ? (cost / suggestedPrice) * 100 : 0;
    
    // Find linked product in store
    const linkedProd = products.find(p => p.id === recipe.productId) || 
      products.find(p => p.name.trim().toLowerCase() === recipe.name.trim().toLowerCase());
    
    const storePrice = linkedProd ? linkedProd.price : null;
    const priceDiff = storePrice !== null ? Number((storePrice - suggestedPrice).toFixed(2)) : null;

    let syncStatus = 'Sem Vínculo com Loja';
    if (linkedProd) {
      if (Math.abs(linkedProd.price - suggestedPrice) < 0.01) {
        syncStatus = 'Sincronizado';
      } else {
        syncStatus = 'Preço Divergente';
      }
    }

    // Ingredients summary text
    const ingredientsSummary = (recipe.ingredients || [])
      .map(ri => {
        const ing = ingredients.find(i => i.id === ri.ingredientId);
        return ing ? `${ing.name} (${ri.quantity}${ing.unit})` : null;
      })
      .filter(Boolean)
      .join(', ');

    return {
      'Nome da Pizza / Receita': recipe.name,
      'Custo dos Ingredientes (R$)': Number(cost.toFixed(2)),
      'Margem de Lucro (%)': recipe.margin,
      'Preço Sugerido Venda (R$)': suggestedPrice,
      'CMV (%)': Number(cmvVal.toFixed(1)),
      'Classificação CMV': getCmvStatus(cmvVal),
      'Produto Vinculado na Loja': linkedProd ? linkedProd.name : 'Não vinculado',
      'Preço Atual no Cardápio (R$)': storePrice !== null ? storePrice : 'N/A',
      'Diferença (Loja - Sugerido R$)': priceDiff !== null ? priceDiff : 'N/A',
      'Status de Preço': syncStatus,
      'Qtd de Insumos': (recipe.ingredients || []).length,
      'Composição': ingredientsSummary
    };
  });

  const wsPricing = XLSX.utils.json_to_sheet(
    pricingSummaryRows.length > 0 
      ? pricingSummaryRows 
      : [{ 'Aviso': 'Nenhuma receita cadastrada no momento' }]
  );

  wsPricing['!cols'] = [
    { wch: 30 }, // Nome da Receita
    { wch: 25 }, // Custo Ingredientes
    { wch: 20 }, // Margem
    { wch: 24 }, // Preço Sugerido
    { wch: 15 }, // CMV
    { wch: 22 }, // Classificação CMV
    { wch: 30 }, // Produto Loja
    { wch: 25 }, // Preço Cardápio
    { wch: 26 }, // Diferença
    { wch: 22 }, // Status
    { wch: 15 }, // Qtd Insumos
    { wch: 50 }, // Composição
  ];

  XLSX.utils.book_append_sheet(wb, wsPricing, 'Precificação & CMV');

  // 2. ABA 2: Fichas Técnicas Detalhadas (Composição item a item de cada receita)
  const technicalSheetRows: any[] = [];

  recipes.forEach(recipe => {
    const totalRecipeCost = calculateRecipeCost(recipe.ingredients || []);
    
    (recipe.ingredients || []).forEach(ri => {
      const ing = ingredients.find(i => i.id === ri.ingredientId);
      const ingCostTotal = ing ? (ing.cost * ri.quantity) : 0;
      const pctOfCost = totalRecipeCost > 0 ? ((ingCostTotal / totalRecipeCost) * 100) : 0;

      technicalSheetRows.push({
        'Receita / Pizza': recipe.name,
        'Ingrediente / Insumo': ing ? ing.name : 'Ingrediente removido',
        'Quantidade Utilizada': ri.quantity,
        'Unidade de Medida': ing ? ing.unit : '-',
        'Custo Unitário Base (R$)': ing ? Number(ing.cost.toFixed(2)) : 0,
        'Custo do Insumo na Pizza (R$)': Number(ingCostTotal.toFixed(2)),
        '% do Custo Total da Pizza': `${pctOfCost.toFixed(1)}%`,
        'Custo Total da Pizza (R$)': Number(totalRecipeCost.toFixed(2))
      });
    });
  });

  const wsTechnical = XLSX.utils.json_to_sheet(
    technicalSheetRows.length > 0 
      ? technicalSheetRows 
      : [{ 'Aviso': 'Nenhuma ficha técnica detalhada disponível' }]
  );

  wsTechnical['!cols'] = [
    { wch: 30 }, // Receita
    { wch: 26 }, // Ingrediente
    { wch: 20 }, // Qtd Utilizada
    { wch: 18 }, // Unidade
    { wch: 24 }, // Custo Unitário
    { wch: 26 }, // Custo na Pizza
    { wch: 26 }, // % Custo
    { wch: 24 }  // Custo Total
  ];

  XLSX.utils.book_append_sheet(wb, wsTechnical, 'Fichas Técnicas');

  // 3. ABA 3: Banco de Ingredientes (Todos os insumos cadastrados)
  const ingredientRows = ingredients.map(ing => {
    const usedInRecipes = recipes.filter(r => 
      (r.ingredients || []).some(ri => ri.ingredientId === ing.id)
    );

    return {
      'Nome do Ingrediente': ing.name,
      'Custo Base (R$)': Number(ing.cost.toFixed(2)),
      'Unidade': ing.unit,
      'Utilizado em N° de Receitas': usedInRecipes.length,
      'Receitas que Utilizam': usedInRecipes.map(r => r.name).join(', ') || 'Nenhuma'
    };
  });

  const wsIngredients = XLSX.utils.json_to_sheet(
    ingredientRows.length > 0 
      ? ingredientRows 
      : [{ 'Aviso': 'Nenhum ingrediente cadastrado' }]
  );

  wsIngredients['!cols'] = [
    { wch: 30 }, // Ingrediente
    { wch: 20 }, // Custo Base
    { wch: 14 }, // Unidade
    { wch: 25 }, // Utilizado em N Receitas
    { wch: 50 }  // Receitas que utilizam
  ];

  XLSX.utils.book_append_sheet(wb, wsIngredients, 'Banco de Ingredientes');

  // Gerar arquivo Excel e disparar download
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Precificacao_Bella_Borda_${dateStr}.xlsx`;

  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Erro ao exportar planilha Excel:', error);
    // Fallback: try XLSX.writeFile
    XLSX.writeFile(wb, fileName);
    return true;
  }
}
