/**
 * Utility functions for game entity icons, item fallbacks, inventory management, and combat calculation.
 */

const NPC_ICON_MAP = {
  Seagull: '🕊️',
  Crab: '🦀',
  Jellyfish: '🪼',
  Garrick: '👨‍🍳',
  Martha: '🛒',
  Vance: '🎣',
  Corinne: '👩‍🌾',
  Brock: '⛏️',
};

import {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  MAX_ENERGY,
  DEFAULT_INITIAL_STATS,
  STATUS_THRESHOLD_WELL_FED,
  STATUS_THRESHOLD_LIGHT_FED,
  STATUS_THRESHOLD_FAMISHED,
  STATUS_BUFF_MULTIPLIER,
  STATUS_DEBUFF_MULTIPLIER,
  ENERGY_HP_REGEN_CYCLE,
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
  STATUS_BUFF_MULTIPLIER,
  STATUS_DEBUFF_MULTIPLIER,
  ENERGY_HP_REGEN_CYCLE,
};

/**
 * 依據 NPC 資料取得對應的 Emoji 圖示。
 * @param {Object} npc - NPC 物件（可包含 npcId、id、icon）。
 * @returns {string} 對應的 Emoji 圖示字串。
 */
export const getNpcIcon = (npc) => {
  if (!npc) return '🐾';
  if (npc.icon) return npc.icon;
  const npcId = npc.npcId || npc.id;
  return NPC_ICON_MAP[npcId] || '🐾';
};

/**
 * 依據道具物件取得對應的 Emoji 圖示，若無則回傳預設圖示。
 * @param {Object} item - 道具物件（可包含 icon 欄位）。
 * @param {string} [defaultIcon='🐟'] - 預設回退圖示。
 * @returns {string} 道具的 Emoji 圖示。
 */
export const getItemIcon = (item, defaultIcon = '🐟') => {
  if (!item) return defaultIcon;
  return item.icon || defaultIcon;
};

/**
 * 生成全域唯一的實體識別碼 (Instance ID)。
 * @param {string} [prefix='inst'] - 識別碼前綴字串。
 * @returns {string} 包含前綴、時間戳與隨機碼的唯一字串。
 */
export const generateInstanceId = (prefix = 'inst') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 標準化並校準玩家各項能力值，補齊預設值（例如 water、food 預設為 120）。
 * @param {Object} [rawStats={}] - 原始能力值物件。
 * @param {Object} [fallback={}] - 回退值物件（包含舊版欄位別名或預設數值）。
 * @returns {{ strength: number, speed: number, dexterity: number, maxHp: number, defense: number, water: number, food: number }} 標準化後的能力值物件。
 */
export const normalizePlayerStats = (rawStats = {}, fallback = {}) => {
  const dexVal = rawStats.dexterity ?? fallback.dexterity ?? fallback.dex ?? 1;
  return {
    strength: rawStats.strength ?? fallback.strength ?? fallback.str ?? 1,
    speed: rawStats.speed ?? fallback.speed ?? fallback.spd ?? 1,
    dexterity: dexVal,
    maxHp: rawStats.maxHp ?? fallback.maxHp ?? MAX_HP,
    defense: rawStats.defense ?? fallback.defense ?? 0,
    water: rawStats.water ?? fallback.water ?? MAX_WATER,
    food: rawStats.food ?? fallback.food ?? MAX_FOOD,
  };
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
 * 依據玩家當前狀態計算行動的實際精力消耗。
 * 支援小數精度（保留三位小數）。
 * @param {Object} player - 玩家物件。
 * @param {number} baseEnergyCost - 基礎精力消耗。
 * @returns {number} 折算後的實際精力消耗。
 */
export const calculateEffectiveEnergyCost = (player, baseEnergyCost) => {
  if (typeof baseEnergyCost !== 'number' || baseEnergyCost <= 0) return 0;
  const effects = getStatusEffects(player);
  let multiplier = 1.0;
  for (const eff of effects) {
    if (typeof eff.energyCostMultiplier === 'number') {
      multiplier *= eff.energyCostMultiplier;
    }
  }
  return Math.round(baseEnergyCost * multiplier * 1000) / 1000;
};

/**
 * 統一將道具新增至背包陣列；若相同 itemId 已存在則增加堆疊數量，否則新增實體。
 * @param {Array<Object>} [inventory=[]] - 現有背包陣列。
 * @param {string} itemId - 道具識別碼。
 * @param {number} [count=1] - 增加的道具數量。
 * @param {Object} [options={}] - 其他附加選項（如 durability、quality、instanceId）。
 * @param {number} [options.durability] - 耐久度數值。
 * @param {string} [options.quality] - 品質標籤。
 * @param {string} [options.instanceId] - 自訂實體識別碼。
 * @param {string} [options.customName] - 自訂/詞綴中文名稱。
 * @param {string} [options.customNameEn] - 自訂/詞綴英文名稱。
 * @param {Object} [options.bonusNutrition] - 附加營養值物件。
 * @returns {Array<Object>} 更新後的背包陣列。
 */
export const addItemsToInventory = (inventory = [], itemId, count = 1, options = {}) => {
  const addQty = Math.max(1, Number(count) || 1);
  const updated = [...inventory];
  const targetCustomName = options.customName || '';
  const targetCustomNameEn = options.customNameEn || '';
  const targetBonus = options.bonusNutrition;

  const existingIdx = updated.findIndex((i) => {
    if (i.itemId !== itemId) return false;
    if ((i.customName || '') !== targetCustomName) return false;

    if (options.durability !== undefined) {
      const oldDur = i.durability !== undefined && i.durability > 0 ? i.durability : -1;
      const newDur = options.durability > 0 ? options.durability : -1;
      if (oldDur <= 0 && newDur <= 0) return true;
      if (oldDur > 0 && newDur > 0) {
        return newDur >= oldDur * 0.9 && newDur <= oldDur * 1.1;
      }
      return false;
    }
    return true;
  });

  if (existingIdx >= 0) {
    const existing = updated[existingIdx];
    const oldCount = existing.count || 1;
    const newTotalCount = oldCount + addQty;
    const updatedItem = {
      ...existing,
      count: newTotalCount,
      ...(targetCustomName ? { customName: targetCustomName, customNameEn: targetCustomNameEn } : {}),
      ...(targetBonus ? { bonusNutrition: targetBonus } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
    };

    if (existing.durability !== undefined && existing.durability > 0 && options.durability !== undefined && options.durability > 0) {
      updatedItem.durability = Math.round(
        (existing.durability * oldCount + options.durability * addQty) / newTotalCount
      );
    } else if (options.durability !== undefined) {
      updatedItem.durability = options.durability;
    }

    updated[existingIdx] = updatedItem;
  } else {
    updated.push({
      instanceId: options.instanceId || generateInstanceId(),
      itemId,
      count: addQty,
      durability: options.durability !== undefined ? options.durability : -1,
      quality: options.quality || '普通',
      ...(targetCustomName ? { customName: targetCustomName, customNameEn: targetCustomNameEn } : {}),
      ...(targetBonus ? { bonusNutrition: targetBonus } : {}),
    });
  }

  return updated;
};

/**
 * 戰鬥回合行動計算：計算命中機率、是否命中及傷害數值。
 * @param {Object} [attacker={}] - 攻擊方角色/生物物件。
 * @param {Object} [defender={}] - 防守方角色/生物物件。
 * @returns {{ isHit: boolean, damage: number, hitRate: number, atkSpeed: number, defSpeed: number, atkStr: number, defDef: number }} 回合計算結果物件。
 */
export const calculateCombatTurn = (attacker = {}, defender = {}) => {
  const atkSpeed = attacker.stats?.speed ?? attacker.spd ?? 1;
  const defSpeed = defender.stats?.speed ?? defender.spd ?? 1;
  const atkStr = attacker.stats?.strength ?? attacker.stats?.str ?? attacker.str ?? 1;
  const defDef = defender.stats?.defense ?? defender.stats?.def ?? defender.def ?? 0;

  const hitRate = Math.min(1, Math.max(0.1, ((atkSpeed - defSpeed) / defSpeed) * 0.5 + 0.5));
  const isHit = Math.random() <= hitRate;
  const damage = isHit ? Math.max(1, atkStr - defDef) : 0;

  return { isHit, damage, hitRate, atkSpeed, defSpeed, atkStr, defDef };
};

/**
 * 取得生活技能升至下一級所需的經驗值門檻。
 * 規則：每級門檻 = level * 100（例：LV.1 需 100，LV.2 需 200，LV.3 需 300）。
 * @param {number} level - 當前技能等級。
 * @returns {number} 升級所需經驗值。
 */
export const getRequiredExpForNextLevel = (level = 1) => {
  return Math.max(1, Math.floor(Number(level) || 1)) * 100;
};

/**
 * 累加生活技能經驗值，並處理升級與溢出經驗值結算。
 * @param {{ level: number, exp: number }} skillObj - 技能資料物件。
 * @param {number} expToAdd - 獲得的經驗值點數。
 * @returns {{ level: number, exp: number, leveledUp: boolean, levelsGained: number }} 更新後的技能狀態。
 */
export const addLifeSkillExp = (skillObj = {}, expToAdd = 0) => {
  let currentLevel = Math.max(1, Number(skillObj?.level) || 1);
  let currentExp = Math.max(0, Number(skillObj?.exp) || 0) + Math.max(0, Number(expToAdd) || 0);
  let levelsGained = 0;

  while (true) {
    const reqExp = getRequiredExpForNextLevel(currentLevel);
    if (currentExp >= reqExp) {
      currentExp -= reqExp;
      currentLevel += 1;
      levelsGained += 1;
    } else {
      break;
    }
  }

  return {
    level: currentLevel,
    exp: currentExp,
    leveledUp: levelsGained > 0,
    levelsGained,
  };
};

