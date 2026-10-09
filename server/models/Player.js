import mongoose from 'mongoose';

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
    money: { type: Number, default: 0 },
    energy: { type: Number, default: 4320 },
    maxEnergy: { type: Number, default: 4320 },
    location: { type: String, default: 'AZURE_BAY_PORT' },
    mentor: { type: String, default: 'Martha' },
    knownLocations: {
      type: [String],
      default: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
    },
    inventory: [InventoryItemSchema],
    unlockedRecipes: [{ type: String }],
    unlockedClues: [{ type: String }],
    quests: [PlayerQuestSchema],
  },
  { timestamps: true }
);

export const Player = mongoose.model('Player', PlayerSchema);
