import {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  MAX_ENERGY,
  DEFAULT_INITIAL_STATS,
  STATUS_THRESHOLD_WELL_FED,
  STATUS_THRESHOLD_LIGHT_FED,
  STATUS_THRESHOLD_FAMISHED,
  ENERGY_RECOVERY_INTERVAL_MS,
  ENERGY_RECOVERY_AMOUNT,
  ENERGY_DRAIN_CYCLE,
  ENERGY_HP_REGEN_CYCLE,
  STATUS_BUFF_MULTIPLIER,
  STATUS_DEBUFF_MULTIPLIER,
  STAT_ENERGY_DISCOUNT_PER_POINT,
  STAT_ENERGY_MIN_MULTIPLIER,
} from '../constants/gameConstants.js';

export {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  MAX_ENERGY,
  DEFAULT_INITIAL_STATS,
  STATUS_THRESHOLD_WELL_FED,
  STATUS_THRESHOLD_LIGHT_FED,
  STATUS_THRESHOLD_FAMISHED,
  ENERGY_RECOVERY_INTERVAL_MS,
  ENERGY_RECOVERY_AMOUNT,
  ENERGY_DRAIN_CYCLE,
  ENERGY_HP_REGEN_CYCLE,
  STATUS_BUFF_MULTIPLIER,
  STATUS_DEBUFF_MULTIPLIER,
  STAT_ENERGY_DISCOUNT_PER_POINT,
  STAT_ENERGY_MIN_MULTIPLIER,
};

/**
 * 結算玩家的自然恢復精力。
 * 依據上次恢復時間戳計算經過的 15 分鐘週期數並加總精力。
 * @param {Object} player - 玩家 Mongoose 文件或資料物件。
 * @returns {boolean} 是否有精力數值或時間戳的變更。
 */
export const settleEnergyRecovery = (player) => {
  if (!player) return false;
  const maxEnergy = player.maxEnergy ?? MAX_ENERGY;
  const now = Date.now();

  // 若尚未初始化 lastEnergyRecoveredAt，設定為當前時間
  if (!player.lastEnergyRecoveredAt) {
    player.lastEnergyRecoveredAt = new Date(now);
    return true;
  }

  const lastTime = new Date(player.lastEnergyRecoveredAt).getTime();
  const elapsedMs = now - lastTime;

  // 未滿 15 分鐘，不進行結算
  if (elapsedMs < ENERGY_RECOVERY_INTERVAL_MS) {
    return false;
  }

  const currentEnergy = Math.round((player.energy ?? maxEnergy) * 10) / 10;

  // 若目前精力已達上限，重設基準時間為現在，避免滿精力期間溢補週期
  if (currentEnergy >= maxEnergy) {
    player.lastEnergyRecoveredAt = new Date(now);
    return true;
  }

  const intervals = Math.floor(elapsedMs / ENERGY_RECOVERY_INTERVAL_MS);
  if (intervals <= 0) return false;

  const addedEnergy = intervals * ENERGY_RECOVERY_AMOUNT;
  const newEnergy = Math.min(maxEnergy, Math.round((currentEnergy + addedEnergy) * 10) / 10);
  player.energy = newEnergy;

  if (newEnergy >= maxEnergy) {
    player.lastEnergyRecoveredAt = new Date(now);
  } else {
    player.lastEnergyRecoveredAt = new Date(lastTime + intervals * ENERGY_RECOVERY_INTERVAL_MS);
  }

  return true;
};

/**
 * 檢查玩家是否處於昏迷狀態。
 * 規則：水分 (water)、飽食度 (food) 或生命值 (hp) 任一項小於或等於 0 即為昏迷。
 * @param {Object} player - 玩家物件。
 * @returns {boolean} 是否昏迷。
 */
export const isPlayerComatose = (player) => {
  if (!player) return false;
  const water = player.stats?.water ?? MAX_WATER;
  const food = player.stats?.food ?? MAX_FOOD;
  const hp = player.hp ?? MAX_HP;
  return water <= 0 || food <= 0 || hp <= 0;
};

/**
 * 取得玩家當前作用中的狀態效果清單 (Status Effects)。
 * 規則（固定數值門檻：80 / 60 / 30）：
 * 1. 充沛飽足 (WELL_FED)：飽食 >= 80 且 水分 >= 80。
 *    - 行動精力消耗 × 0.9（疊加 60% 門檻效果）
 *    - 每消耗 10 點精力恢復 1 HP
 * 2. 輕度飽足 (LIGHT_FED)：飽食 >= 60 且 水分 >= 60（且未達 WELL_FED）。
 *    - 行動精力消耗 × 0.9
 * 3. 飢渴虛弱 (FAMISHED_DEHYDRATED)：飽食 < 30 且 水分 < 30（兩項皆低於 30）。
 *    - 行動精力消耗 × 1.2
 * 4. 一般狀態 (NORMAL)：其餘情況。
 *    - 行動精力消耗 × 1.0
 * 
 * @param {Object} player - 玩家物件。
 * @returns {Array<Object>} 狀態效果物件陣列。
 */
export const getStatusEffects = (player) => {
  if (!player || isPlayerComatose(player)) return [];
  const water = player.stats?.water ?? MAX_WATER;
  const food = player.stats?.food ?? MAX_FOOD;

  const effects = [];

  if (water >= STATUS_THRESHOLD_WELL_FED && food >= STATUS_THRESHOLD_WELL_FED) {
    effects.push({
      id: 'WELL_FED',
      name: '充沛飽足',
      nameEn: 'Well Fed',
      type: 'BUFF',
      energyCostMultiplier: STATUS_BUFF_MULTIPLIER,
      canRegenHp: true,
      description: `飽食與水分皆達 ${STATUS_THRESHOLD_WELL_FED} 以上：行動精力消耗 -10%，每消耗 ${ENERGY_HP_REGEN_CYCLE} 點精力恢復 1 HP`,
      descriptionEn: `Food and Water >= ${STATUS_THRESHOLD_WELL_FED}: Action energy cost -10%, restore 1 HP for every ${ENERGY_HP_REGEN_CYCLE} energy spent`,
    });
  } else if (water >= STATUS_THRESHOLD_LIGHT_FED && food >= STATUS_THRESHOLD_LIGHT_FED) {
    effects.push({
      id: 'LIGHT_FED',
      name: '輕度飽足',
      nameEn: 'Light Fed',
      type: 'BUFF',
      energyCostMultiplier: STATUS_BUFF_MULTIPLIER,
      canRegenHp: false,
      description: `飽食與水分皆達 ${STATUS_THRESHOLD_LIGHT_FED} 以上：行動精力消耗 -10%`,
      descriptionEn: `Food and Water >= ${STATUS_THRESHOLD_LIGHT_FED}: Action energy cost -10%`,
    });
  } else if (water < STATUS_THRESHOLD_FAMISHED && food < STATUS_THRESHOLD_FAMISHED) {
    effects.push({
      id: 'FAMISHED_DEHYDRATED',
      name: '飢渴虛弱',
      nameEn: 'Famished & Dehydrated',
      type: 'DEBUFF',
      energyCostMultiplier: STATUS_DEBUFF_MULTIPLIER,
      canRegenHp: false,
      description: `飽食與水分皆低於 ${STATUS_THRESHOLD_FAMISHED}：行動精力消耗 +20%`,
      descriptionEn: `Food and Water < ${STATUS_THRESHOLD_FAMISHED}: Action energy cost +20%`,
    });
  }

  return effects;
};

/**
 * 依據能力點數計算精力消耗折扣倍率（方案 B 線性折扣）。
 * 規則：以初始點數 1 為基準，每多 1 點能力節省 1% 精力，最低倍率為 0.5（最高節省 50%）。
 * @param {number} statValue - 玩家能力值 (>= 1)。
 * @returns {number} 折扣倍率 (0.5 ~ 1.0，保留三位小數)。
 */
export const calculateStatEnergyDiscount = (statValue) => {
  const stat = Number(statValue) || 1;
  const bonusPoints = Math.max(0, stat - 1);
  const discount = bonusPoints * STAT_ENERGY_DISCOUNT_PER_POINT;
  return Math.max(STAT_ENERGY_MIN_MULTIPLIER, Math.round((1 - discount) * 1000) / 1000);
};

/**
 * 依據玩家當前飽食度狀態與能力值，計算行動的實際精力消耗。
 * 支援小數精度（保留三位小數）。
 * @param {Object} player - 玩家物件。
 * @param {number} baseEnergyCost - 基礎精力消耗。
 * @param {'TRAVEL' | 'GATHER' | 'CRAFT' | string} [actionType] - 行動類型（TRAVEL: 速度加成, GATHER: 力量加成, CRAFT: 精巧加成）。
 * @returns {number} 折算後的實際精力消耗。
 */
export const calculateEffectiveEnergyCost = (player, baseEnergyCost, actionType) => {
  if (typeof baseEnergyCost !== 'number' || baseEnergyCost <= 0) return 0;

  // 1. 飽食度與水分狀態倍率（充沛飽足 0.9 / 輕度飽足 0.9 / 飢渴虛弱 1.2 / 一般 1.0）
  const effects = getStatusEffects(player);
  let statusMultiplier = 1.0;
  for (const eff of effects) {
    if (typeof eff.energyCostMultiplier === 'number') {
      statusMultiplier *= eff.energyCostMultiplier;
    }
  }

  // 2. 方案 B 能力值加成倍率（速度/力量/精巧，每 1 點能力節省 1% 精力，最低倍率 0.5）
  let statMultiplier = 1.0;
  const stats = player?.stats || {};

  if (actionType === 'TRAVEL') {
    const spd = Number(stats.speed ?? player?.spd ?? 1);
    statMultiplier = calculateStatEnergyDiscount(spd);
  } else if (actionType === 'GATHER') {
    const str = Number(stats.strength ?? player?.str ?? 1);
    statMultiplier = calculateStatEnergyDiscount(str);
  } else if (actionType === 'CRAFT') {
    const dex = Number(stats.dexterity ?? player?.dex ?? 1);
    statMultiplier = calculateStatEnergyDiscount(dex);
  }

  const finalMultiplier = statusMultiplier * statMultiplier;
  return Math.round(baseEnergyCost * finalMultiplier * 1000) / 1000;
};

/**
 * 處理精力消耗時的水分與飽食度扣除，以及狀態帶來的生命值回復。
 * 規則：
 * 1. 水分與飽食：每消耗 15 點精力扣除 1 水分與 1 飽食度。未滿 15 的消耗累計至下次。
 * 2. 飽足回血：處於充沛飽足 (WELL_FED) 時，每消耗 10 點精力恢復 1 點 HP。未滿 10 的消耗累計至下次。
 * 3. 昏迷判定：水分、飽食度或生命值只要有一項 <= 0，即處於昏迷狀態。
 * 支援小數精度（精確至小數點後三位，避免 JavaScript 浮點數誤差）。
 * @param {Object} player - 玩家物件。
 * @param {number} energyCost - 實際消耗的精力點數（支援小數）。
 * @returns {{ drainCount: number, hpGain: number, isComatose: boolean }} 扣除點數、回血點數與是否昏迷。
 */
export const applyEnergyConsumption = (player, energyCost) => {
  if (!player || typeof energyCost !== 'number' || energyCost <= 0) {
    const isComatose = isPlayerComatose(player);
    return { drainCount: 0, hpGain: 0, isComatose };
  }

  const effects = getStatusEffects(player);
  const canRegenHp = effects.some((e) => e.canRegenHp);

  // 1. 生命值回復結算 (每消耗 ENERGY_HP_REGEN_CYCLE 點精力恢復 1 點 HP)
  let hpGain = 0;
  if (canRegenHp) {
    const currentHpAccumulator = Number(player.hpRegenAccumulator) || 0;
    const totalHpSpent = Math.round((currentHpAccumulator + energyCost) * 1000) / 1000;
    hpGain = Math.floor(totalHpSpent / ENERGY_HP_REGEN_CYCLE);
    player.hpRegenAccumulator = Math.round((totalHpSpent - hpGain * ENERGY_HP_REGEN_CYCLE) * 1000) / 1000;

    if (hpGain > 0) {
      const maxHp = player.stats?.maxHp ?? player.maxHp ?? MAX_HP;
      const curHp = player.hp ?? maxHp;
      player.hp = Math.min(maxHp, curHp + hpGain);
    }
  }

  // 2. 水分與飽食度扣除結算 (每消耗 ENERGY_DRAIN_CYCLE 點精力扣 1 水分與 1 飽食度)
  const currentAccumulator = Number(player.energySpentAccumulator) || 0;
  const totalSpent = Math.round((currentAccumulator + energyCost) * 1000) / 1000;
  const drainCount = Math.floor(totalSpent / ENERGY_DRAIN_CYCLE);
  const newAccumulator = Math.round((totalSpent - drainCount * ENERGY_DRAIN_CYCLE) * 1000) / 1000;

  player.energySpentAccumulator = newAccumulator;

  if (!player.stats) {
    player.stats = { ...DEFAULT_INITIAL_STATS };
  }

  if (drainCount > 0) {
    const curWater = player.stats.water ?? MAX_WATER;
    const curFood = player.stats.food ?? MAX_FOOD;
    player.stats.water = Math.max(0, Math.min(MAX_WATER, Math.round((curWater - drainCount) * 100) / 100));
    player.stats.food = Math.max(0, Math.min(MAX_FOOD, Math.round((curFood - drainCount) * 100) / 100));
  }

  const isComatose = isPlayerComatose(player);
  return { drainCount, hpGain, isComatose };
};

