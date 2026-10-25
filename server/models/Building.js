import mongoose from 'mongoose';

const RepairItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    rate: { type: Number, required: true },
  },
  { _id: false }
);

const BuildingSchema = new mongoose.Schema(
  {
    buildingId: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    nameEn: { type: String, default: '' },
    type: { type: String, required: true },
    durability: { type: Number, default: -1 },
    repairItems: [RepairItemSchema],
    permanent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Building = mongoose.model('Building', BuildingSchema);
