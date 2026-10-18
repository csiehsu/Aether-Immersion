import mongoose from 'mongoose';

const GameLogSchema = new mongoose.Schema(
  {
    time: { type: String, required: true },
    sender: { type: String, required: true },
    senderEn: { type: String, default: '' },
    text: { type: String, required: true },
    textEn: { type: String, default: '' },
    type: { type: String, enum: ['dialogue', 'system', 'event'], default: 'dialogue' },
    locationId: { type: String, default: '' },
    targetPlayerId: { type: String, default: '' },
  },
  { timestamps: true }
);

GameLogSchema.index({ locationId: 1, type: 1, createdAt: -1 });
GameLogSchema.index({ targetPlayerId: 1, type: 1, createdAt: -1 });

export const GameLog = mongoose.model('GameLog', GameLogSchema);
