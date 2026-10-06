import mongoose from 'mongoose';

const InventoryItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, default: '' },
    count: { type: Number, default: 1 },
    durability: { type: Number, default: -1 },
    quality: { type: String, default: '普通' },
  },
  { _id: false }
);

const StatsSchema = new mongoose.Schema(
  {
    strength: { type: Number, default: 1 },
    speed: { type: Number, default: 1 },
    dexerity: { type: Number, default: 1 },
    maxHp: { type: Number, default: 100 },
    defense: { type: Number, default: 0 },
  },
  { _id: false }
);

const PlayerSkillSchema = new mongoose.Schema(
  {
    skillId: { type: String, default: 'NORMAL_ATTACK' },
    level: { type: Number, default: 1 },
  },
  { _id: false }
);

const PlayerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '冒險者' },
    googleId: { type: String, default: null },
    email: { type: String, default: null },
    pictureUrl: { type: String, default: null },
    isLoggedIn: { type: Boolean, default: false },
    isCharacterCreated: { type: Boolean, default: false },
    stats: {
      type: StatsSchema,
      default: () => ({ strength: 1, speed: 1, dexerity: 1, maxHp: 100, defense: 0 }),
    },
    skills: {
      type: [PlayerSkillSchema],
      default: () => [{ skillId: 'NORMAL_ATTACK', level: 1 }],
    },
    level: { type: Number, default: 1 },
    hp: { type: Number, default: 100 },
    energy: { type: Number, default: 4320 },
    maxEnergy: { type: Number, default: 4320 },
    location: { type: String, default: 'AZURE_BAY_PORT' },
    knownLocations: {
      type: [String],
      default: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
    },
    inventory: [InventoryItemSchema],
  },
  { timestamps: true }
);

export const Player = mongoose.model('Player', PlayerSchema);
