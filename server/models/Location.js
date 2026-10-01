import mongoose from 'mongoose';

const GatherableSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    name: { type: String },
    nameEn: { type: String },
    icon: { type: String, default: '🌿' },
    yield: { type: String },
    yieldEn: { type: String },
    cost: { type: Number, default: 5 },
    chance: { type: Number, default: 100 },
    desc: { type: String, default: '' },
    descEn: { type: String, default: '' },
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
    npcs: [{ type: String }],
    hasEvent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Location = mongoose.model('Location', LocationSchema);
