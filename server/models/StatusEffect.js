import mongoose from 'mongoose';

const StatusEffectSchema = new mongoose.Schema(
  {
    statusId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    type: { type: String, enum: ['BUFF', 'DEBUFF'], default: 'BUFF' },
    category: { type: String, default: 'STAT_MODIFIER' },
    canAct: { type: Boolean, default: true },
    statModifiers: { type: mongoose.Schema.Types.Mixed, default: {} },
    description: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
  },
  { timestamps: true }
);

export const StatusEffect = mongoose.model('StatusEffect', StatusEffectSchema);
