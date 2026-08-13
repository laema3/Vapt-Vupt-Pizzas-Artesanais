import re

with open('src/components/PizzaPricingCalculator.tsx', 'r') as f:
    content = f.read()

# Let's inspect matchedProd line
old_line = "const matchedProd = products.find(p => p.id === recipe.productId) || findProductForRecipe(recipe.name, recipe.productId, products);"
new_line = """const matchingProds = findAllProductsForRecipe(recipe.name, recipe.productId, products);
                 const matchedProd = matchingProds.find(p => !p.hidden) || matchingProds[0] || products.find(p => p.id === recipe.productId) || findProductForRecipe(recipe.name, recipe.productId, products);"""

if old_line in content:
    content = content.replace(old_line, new_line, 1)
    print("Replaced matchedProd calculation successfully")
else:
    print("old_line not found")

with open('src/components/PizzaPricingCalculator.tsx', 'w') as f:
    f.write(content)
