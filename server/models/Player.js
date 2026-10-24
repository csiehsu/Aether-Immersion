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
    contents: {
      itemId: { type: String, default: '' },
      amount: { type: Number, default: 0 },
    },
    lastDecayedAt: { type: Date, default: Date.now },
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
    level: { type: Number, default: 0 },
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

const LifeSkillEntrySchema = new mongoose.Schema(
  {
    level: { type: Number, default: 0 },
    exp: { type: Number, default: 0 },
  },
  { _id: false }
);

const LifeSkillsSchema = new mongoose.Schema(
  {
    GATHERING: { type: LifeSkillEntrySchema, default: () => ({ level: 0, exp: 0 }) },
    FISHING: { type: LifeSkillEntrySchema, default: () => ({ level: 0, exp: 0 }) },
    MINING: { type: LifeSkillEntrySchema, default: () => ({ level: 0, exp: 0 }) },
    COOKING: { type: LifeSkillEntrySchema, default: () => ({ level: 0, exp: 0 }) },
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
      default: () => [{ skillId: 'NORMAL_ATTACK', level: 0 }],
    },
    lifeSkills: {
      type: LifeSkillsSchema,
      default: () => ({
        GATHERING: { level: 0, exp: 0 },
        FISHING: { level: 0, exp: 0 },
        MINING: { level: 0, exp: 0 },
        COOKING: { level: 0, exp: 0 },
      }),
    },
    level: { type: Number, default: 1 },
    hp: { type: Number, default: MAX_HP },
    money: { type: Number, default: 0 },
    energy: { type: Number, default: MAX_ENERGY },
    maxEnergy: { type: Number, default: MAX_ENERGY },
    lastEnergyRecoveredAt: { type: Date, default: Date.now },
    energySpentAccumulator: { type: Number, default: 0 },
    hpRegenAccumulator: { type: Number, default: 0 },
    location: { type: String, default: 'AZURE_BAY_MARKET' },
    mentor: { type: String, default: '' },
    knownLocations: {
      type: [String],
      default: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET', 'AZURE_BAY_GATE', 'ROCKY_PLAIN', 'AZURE_BAY_VARIETY_SHOP', 'ROCK_WALL'],
    },
    inventory: [InventoryItemSchema],
    unlockedRecipes: [UnlockedRecipeSchema],
    quests: [PlayerQuestSchema],
  },
  { timestamps: true, versionKey: false }
);

export const Player = mongoose.model('Player', PlayerSchema);
