import mongoose from 'mongoose';

const ClueSchema = new mongoose.Schema(
  {
    clueId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleEn: { type: String, default: '' },
    content: { type: String, required: true },
    contentEn: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Clue = mongoose.model('Clue', ClueSchema);
