import mongoose from 'mongoose';

const GatherableSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    cost: { type: Number, default: 1 },
    chance: { type: Number, default: 100 },
    maxYield: { type: Number, default: 1 },
    requiredToolTypes: [{ type: String }],
    skillType: { type: String, default: '' },
    expPerUnit: { type: Number, default: 0 },
  },
  { _id: false }
);

const ConnectionSchema = new mongoose.Schema(
  {
    targetLocationId: { type: String, required: true },
    energyCost: { type: Number, default: 1 },
  },
  { _id: false }
);

const LocationBuildingSchema = new mongoose.Schema(
  {
    buildingId: { type: String, required: true },
    lifespan: { type: Number, default: 0 },
  },
  { _id: false }
);

const PlacedItemSchema = new mongoose.Schema(
  {
    instanceId: { type: String, required: true },
    itemId: { type: String, required: true },
    count: { type: Number, default: 1 },
    durability: { type: Number, default: -1 },
    maxDurability: { type: Number, default: -1 },
    quality: { type: String, default: '普通' },
    customName: { type: String, default: '' },
    customNameEn: { type: String, default: '' },
    bonusNutrition: {
      hp: { type: Number, default: 0 },
      strength: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      dexterity: { type: Number, default: 0 },
      defense: { type: Number, default: 0 },
      maxHp: { type: Number, default: 0 },
      water: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
    },
    triggerQuestId: { type: String, default: '' },
  },
  { _id: false }
);

const LocationSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    image: { type: String, default: '' },
    gatherables: [GatherableSchema],
    connections: [ConnectionSchema],
    buildings: [LocationBuildingSchema],
    placedItems: [PlacedItemSchema],
    npcs: [{ type: String }],
    hasEvent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Location = mongoose.model('Location', LocationSchema);
