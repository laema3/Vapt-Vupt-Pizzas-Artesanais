const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const targetStr = "{activeView === 'entregas' && (";
const block = `            {activeView === 'precificacao' && (
              <PizzaPricingCalculator />
            )}\n\n            `;

code = code.replace(targetStr, block + targetStr);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
