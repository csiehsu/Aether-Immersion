import mongoose from 'mongoose';

const BattleSkillEffectSchema = new mongoose.Schema(
  {
    target: { type: String, enum: ['SELF', 'ENEMY'], default: 'ENEMY' },
    statusId: { type: String, required: true },
    duration: { type: Number, default: 1 },
    chance: { type: Number, default: 1.0 },
  },
  { _id: false }
);

const BattleSkillSchema = new mongoose.Schema(
  {
    skillId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    hitRateFormula: { type: String, default: '(attacker.dexterity - defender.speed) / defender.speed * 0.25 + 0.5' },
    damageFormula: { type: String, default: 'attacker.strength - defender.defense' },
    coolDown: { type: Number, default: 0 },
    hitCount: { type: Number, default: 1 },
    requiredWeaponTypes: [{ type: String }],
    requiredLevel: { type: Number, default: 1 },
    effects: [BattleSkillEffectSchema],
  },
  { timestamps: true }
);

export const BattleSkill = mongoose.model('BattleSkill', BattleSkillSchema);
