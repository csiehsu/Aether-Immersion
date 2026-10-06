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

const PlayerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '冒險者' },
    googleId: { type: String, default: null },
    email: { type: String, default: null },
    pictureUrl: { type: String, default: null },
    isLoggedIn: { type: Boolean, default: false },
    isCharacterCreated: { type: Boolean, default: false },
    str: { type: Number, default: 1 },
    spd: { type: Number, default: 1 },
    dex: { type: Number, default: 1 },
    level: { type: Number, default: 1 },
    hp: { type: Number, default: 100 },
    maxHp: { type: Number, default: 100 },
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
