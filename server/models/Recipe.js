import mongoose from 'mongoose';

const ItemRequirementSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['base', 'modifier', 'default'], default: 'default' },
    type: { type: String, required: false },
    itemId: { type: String, required: false },
    quantity: { type: Number, default: 1 },
  },
  { _id: false }
);

const RecipeSchema = new mongoose.Schema(
  {
    recipeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    triggerItem: [{ type: String }],
    outputItems: [ItemRequirementSchema],
    requiredItems: [ItemRequirementSchema],
    requiredToolTypes: [{ type: String }],
    durabilityFormula: { type: String, default: '' },
    energyCost: { type: Number, default: 0 },
    outputs: { type: mongoose.Schema.Types.Mixed, default: {} },
    modifiers: { type: mongoose.Schema.Types.Mixed, default: {} },
    baseExp: { type: Number, default: 0 },
    ingredientExp: { type: mongoose.Schema.Types.Mixed, default: {} },
    skillType: { type: String, default: 'COOKING' },
  },
  { timestamps: true }
);

export const Recipe = mongoose.model('Recipe', RecipeSchema);
