import mongoose from 'mongoose';

const GameLogSchema = new mongoose.Schema(
  {
    time: { type: String, required: true },
    sender: { type: String, required: true },
    senderEn: { type: String, default: '' },
    text: { type: String, required: true },
    textEn: { type: String, default: '' },
    type: { type: String, enum: ['dialogue', 'system', 'event'], default: 'dialogue' },
  },
  { timestamps: true }
);

export const GameLog = mongoose.model('GameLog', GameLogSchema);
