const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const newRules = `
    match /ingredients/{ingredientId} {
      allow read, write: if true;
    }

    match /pizza_recipes/{recipeId} {
      allow read, write: if true;
    }
  }
}`;

code = code.replace("  }\n}", newRules);
fs.writeFileSync('firestore.rules', code);
