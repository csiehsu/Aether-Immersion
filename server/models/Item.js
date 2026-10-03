import mongoose from 'mongoose';

const SmellSchema = new mongoose.Schema(
  {
    type: { type: String, default: '' },
    level: { type: Number, default: 0 },
  },
  { _id: false }
);

const NutritionSchema = new mongoose.Schema(
  {
    strength: { type: Number, default: 0 },
    hp: { type: Number, default: 0 },
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    type: [{ type: String }],
    durability: { type: Number, default: -1 },
    weight: { type: Number, default: 1 },
    smell: { type: SmellSchema, default: () => ({}) },
    nutrition: { type: NutritionSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Item = mongoose.model('Item', ItemSchema);
