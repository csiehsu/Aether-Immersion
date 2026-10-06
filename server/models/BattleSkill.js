import mongoose from 'mongoose';

const BattleSkillSchema = new mongoose.Schema(
  {
    skillId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    hitRateFormula: { type: String, default: '(attacker.speed - defender.speed) / defender.speed * 0.5 + 0.5' },
    damageFormula: { type: String, default: 'attacker.strength - defender.defense' },
  },
  { timestamps: true }
);

export const BattleSkill = mongoose.model('BattleSkill', BattleSkillSchema);
