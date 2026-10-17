import mongoose from 'mongoose';
import {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  MAX_ENERGY,
  DEFAULT_INITIAL_STATS,
} from '../../src/constants/gameConstants.js';

const InventoryItemSchema = new mongoose.Schema(
  {
    instanceId: { type: String, default: '' },
    itemId: { type: String, default: '' },
    count: { type: Number, default: 1 },
    durability: { type: Number, default: -1 },
    quality: { type: String, default: '普通' },
  },
  { _id: false }
);

const StatsSchema = new mongoose.Schema(
  {
    strength: { type: Number, default: DEFAULT_INITIAL_STATS.strength },
    speed: { type: Number, default: DEFAULT_INITIAL_STATS.speed },
    dexterity: { type: Number, default: DEFAULT_INITIAL_STATS.dexterity },
    maxHp: { type: Number, default: MAX_HP },
    defense: { type: Number, default: DEFAULT_INITIAL_STATS.defense },
    water: { type: Number, default: MAX_WATER },
    food: { type: Number, default: MAX_FOOD },
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

const PlayerQuestProgressSchema = new mongoose.Schema(
  {
    objectiveIndex: { type: Number, required: true },
    currentCount: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false }
);

const PlayerQuestSchema = new mongoose.Schema(
  {
    questId: { type: String, required: true },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'READY_TO_SUBMIT', 'COMPLETED', 'FAILED'],
      default: 'IN_PROGRESS',
    },
    progress: [PlayerQuestProgressSchema],
    acceptedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { _id: false }
);

const UnlockedRecipeSchema = new mongoose.Schema(
  {
    recipeId: { type: String, required: true },
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
      default: () => ({ ...DEFAULT_INITIAL_STATS }),
    },
    skills: {
      type: [PlayerSkillSchema],
      default: () => [{ skillId: 'NORMAL_ATTACK', level: 1 }],
    },
    level: { type: Number, default: 1 },
    hp: { type: Number, default: MAX_HP },
    money: { type: Number, default: 0 },
    energy: { type: Number, default: MAX_ENERGY },
    maxEnergy: { type: Number, default: MAX_ENERGY },
    lastEnergyRecoveredAt: { type: Date, default: Date.now },
    energySpentAccumulator: { type: Number, default: 0 },
    hpRegenAccumulator: { type: Number, default: 0 },
    location: { type: String, default: 'AZURE_BAY_PORT' },
    mentor: { type: String, default: 'Martha' },
    knownLocations: {
      type: [String],
      default: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
    },
    inventory: [InventoryItemSchema],
    unlockedRecipes: [UnlockedRecipeSchema],
    quests: [PlayerQuestSchema],
  },
  { timestamps: true }
);

export const Player = mongoose.model('Player', PlayerSchema);
