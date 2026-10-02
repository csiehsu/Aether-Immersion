import mongoose from 'mongoose';

const GatherableSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    cost: { type: Number, default: 1 },
    chance: { type: Number, default: 100 },
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
    npcs: [{ type: String }],
    hasEvent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Location = mongoose.model('Location', LocationSchema);
