import mongoose from 'mongoose';

const BuildingSchema = new mongoose.Schema(
  {
    buildingId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    permanent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Building = mongoose.model('Building', BuildingSchema);
