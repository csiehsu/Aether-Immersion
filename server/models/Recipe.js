import mongoose from 'mongoose';

const ItemRequirementSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    quantity: { type: Number, default: 1 },
  },
  { _id: false }
);

const RecipeSchema = new mongoose.Schema(
  {
    recipeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    outputItems: [ItemRequirementSchema],
    requiredItems: [ItemRequirementSchema],
    requiredToolTypes: [{ type: String }],
    icon: { type: String, default: '🔥' },
  },
  { timestamps: true }
);

export const Recipe = mongoose.model('Recipe', RecipeSchema);
