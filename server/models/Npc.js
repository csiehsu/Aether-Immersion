import mongoose from 'mongoose';

const StatsSchema = new mongoose.Schema(
  {
    strength: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    dexterity: { type: Number, default: 0 },
    spiritual: { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
    maxHP: { type: Number, default: 0 },
    maxMP: { type: Number, default: 0 },
  },
  { _id: false }
);

const DropSchema = new mongoose.Schema(
  {
    itemId: { type: String, default: '' },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
  },
  { _id: false }
);

const SkillSchema = new mongoose.Schema(
  {
    skillId: { type: String, default: 'NORMAL_ATTACK' },
    level: { type: Number, default: 1 },
  },
  { _id: false }
);

const GoodieSchema = new mongoose.Schema(
  {
    itemId: { type: String, default: '' },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const PurchaseSchema = new mongoose.Schema(
  {
    itemId: { type: String, default: '' },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const NpcSchema = new mongoose.Schema(
  {
    npcId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    icon: { type: String, default: '🐾' },
    type: { type: String, default: 'MONSTER' },
    stats: { type: StatsSchema, default: () => ({}) },
    drops: [DropSchema],
    skills: [SkillSchema],
    goodies: [GoodieSchema],
    purchase: [PurchaseSchema],
  },
  { timestamps: true }
);

export const Npc = mongoose.model('Npc', NpcSchema);
