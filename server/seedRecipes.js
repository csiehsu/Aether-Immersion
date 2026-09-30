import 'dotenv/config';
import { connectDB } from './config/db.js';
import { Recipe } from './models/Recipe.js';

export const initialRecipes = [
  {
    recipeId: 'recipe001',
    name: '燒烤',
    nameEn: 'Roast',
    icon: '🔥',
    outputItems: [
      {
        type: 'FOOD',
        quantity: 1,
      },
    ],
    requiredItems: [
      {
        type: 'INGREDIENTS',
        quantity: 1,
      },
    ],
    requiredToolTypes: ['HEATING'],
  },
];

export const seedRecipes = async () => {
  try {
    for (const recipeData of initialRecipes) {
      await Recipe.findOneAndUpdate(
        { recipeId: recipeData.recipeId },
        recipeData,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }
    console.log('[Seed Recipes] recipe001 (燒烤 / Roast) seeded into MongoDB.');
  } catch (err) {
    console.error('[Seed Recipes Error]', err.message);
  }
};

// Run directly if called from command line
if (process.argv[1] && process.argv[1].endsWith('seedRecipes.js')) {
  (async () => {
    const connected = await connectDB();
    if (connected) {
      await seedRecipes();
    }
    process.exit(0);
  })();
}
