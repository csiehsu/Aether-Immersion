import mongoose from 'mongoose';

const PrerequisiteSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['QUEST_COMPLETED', 'VISIT_LOCATION', 'HAS_ITEM'],
    },
    targetId: { type: String, required: true },
    requiredCount: { type: Number, default: 1 },
  },
  { _id: false }
);

const ObjectiveSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['SUBMIT_ITEM', 'DELIVER_ITEM', 'TALK_NPC', 'KILL_MONSTER', 'VISIT_LOCATION', 'HAS_ITEM'],
    },
    targetId: { type: String, default: '' },
    targetNpcId: { type: String, default: '' },
    requiredCount: { type: Number, default: 1 },
  },
  { _id: false }
);

const RewardItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    count: { type: Number, default: 1 },
    quality: { type: String, default: '普通' },
  },
  { _id: false }
);

const RewardsSchema = new mongoose.Schema(
  {
    money: { type: Number, default: 0 },
    exp: { type: Number, default: 0 },
    items: [RewardItemSchema],
    unlockedLocations: [{ type: String }],
    unlockedRecipes: [{ type: String }],
  },
  { _id: false }
);

const GrantsOnAcceptSchema = new mongoose.Schema(
  {
    items: [RewardItemSchema],
    unlockedLocations: [{ type: String }],
    unlockedRecipes: [{ type: String }],
  },
  { _id: false }
);

const QuestSchema = new mongoose.Schema(
  {
    questId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleEn: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    completeText: { type: String, default: '' },
    autoTriggerQuestId: { type: String, default: '' },
    autoTrigger: { type: String, default: '' },
    triggerType: {
      type: String,
      enum: ['NPC', 'LOCATION', 'LOCATION_ITEM'],
      default: 'NPC',
    },
    triggerNpcId: { type: String, default: '' },
    triggerLocationId: { type: String, default: '' },
    triggerItemId: { type: String, default: '' },
    submitNpcId: { type: String, default: '' },
    autoRemoveTriggerItemOnComplete: { type: Boolean, default: true },
    prerequisites: [PrerequisiteSchema],
    minLevel: { type: Number, default: 1 },
    isRepeatable: { type: Boolean, default: false },
    objectives: [ObjectiveSchema],
    grantsOnAccept: GrantsOnAcceptSchema,
    rewards: RewardsSchema,
  },
  { timestamps: true }
);

export const Quest = mongoose.model('Quest', QuestSchema);
