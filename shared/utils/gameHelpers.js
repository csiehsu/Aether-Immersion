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
  DEFAULT_MAX_WEIGHT,
  TOTAL_CREATION_STATS,
  DEFAULT_INITIAL_STATS,
  STATUS_THRESHOLD_WELL_FED,
  STATUS_THRESHOLD_LIGHT_FED,
  STATUS_THRESHOLD_FAMISHED,
  STATUS_BUFF_MULTIPLIER,
  STATUS_DEBUFF_MULTIPLIER,
  ENERGY_HP_REGEN_CYCLE,
  PERMANENT_DURABILITY,
} from '../constants/gameConstants.js';

import {
  calculateEffectiveEnergyCost,
  calculateStatEnergyDiscount,
  calculateMaxExecutableBySatiety,
  getStatusEffects,
  isPlayerComatose,
} from './energyHelper.js';

export {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  MAX_ENERGY,
  DEFAULT_MAX_WEIGHT,
  TOTAL_CREATION_STATS,
  DEFAULT_INITIAL_STATS,
  STATUS_THRESHOLD_WELL_FED,
  STATUS_THRESHOLD_LIGHT_FED,
  STATUS_THRESHOLD_FAMISHED,
  STATUS_BUFF_MULTIPLIER,
  STATUS_DEBUFF_MULTIPLIER,
  ENERGY_HP_REGEN_CYCLE,
  PERMANENT_DURABILITY,
  calculateEffectiveEnergyCost,
  calculateStatEnergyDiscount,
  calculateMaxExecutableBySatiety,
  getStatusEffects,
  isPlayerComatose,
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
 * 檢查兩份營養加成物件是否完全一致。
 * @param {Object} [bonusA]
 * @param {Object} [bonusB]
 * @returns {boolean}
 */
export const areBonusNutritionsEqual = (bonusA, bonusB) => {
  const a = bonusA || {};
  const b = bonusB || {};
  const allKeys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  for (const k of allKeys) {
    const valA = Number(a[k]) || 0;
    const valB = Number(b[k]) || 0;
    if (valA !== valB) return false;
  }
  return true;
};

export const FRESHNESS_TIERS = {
  FRESH: 'FRESH',      // 新鮮: > 90%
  STALE: 'STALE',      // 普通/熟成: 31% ~ 90%
  SPOILING: 'SPOILING',// 臨期: 1% ~ 30%
  ROTTED: 'ROTTED',    // 腐敗: <= 0%
};

/**
 * 取得道具的保鮮等級 (Freshness Tier)。
 * 規則與進度條紅黃綠三色對齊：
 * > 90% -> FRESH (綠色)
 * 31% ~ 90% -> STALE (黃色)
 * 1% ~ 30% -> SPOILING (紅色)
 * <= 0% -> ROTTED (已腐敗)
 * @param {number} durability - 當前耐久度
 * @param {number} maxDurability - 最大耐久度
 * @returns {string} FRESH | STALE | SPOILING | ROTTED
 */
export const getFreshnessTier = (durability, maxDurability) => {
  const cur = Number(durability) || 0;
  const max = Number(maxDurability) || cur || 1;
  if (cur <= 0) return FRESHNESS_TIERS.ROTTED;
  const percent = Math.round((cur / max) * 100);
  if (percent > 90) return FRESHNESS_TIERS.FRESH;
  if (percent > 30) return FRESHNESS_TIERS.STALE;
  return FRESHNESS_TIERS.SPOILING;
};

/**
 * 計算兩組相同物品合併時的加權平均耐久度與最大耐久度。
 * 公式：weighted = round((durA * countA + durB * countB) / (countA + countB))
 * @param {number} durA - A 組當前耐久度
 * @param {number} maxA - A 組最大耐久度
 * @param {number} countA - A 組數量
 * @param {number} durB - B 組當前耐久度
 * @param {number} maxB - B 組最大耐久度
 * @param {number} countB - B 組數量
 * @returns {{ durability: number, maxDurability: number }}
 */
export const calculateWeightedDurability = (durA, maxA, countA, durB, maxB, countB) => {
  const cA = Math.max(1, Number(countA) || 1);
  const cB = Math.max(1, Number(countB) || 1);
  const totalCount = cA + cB;
  const dA = Number(durA) || 0;
  const dB = Number(durB) || 0;
  const mA = Number(maxA) || dA || 1;
  const mB = Number(maxB) || dB || 1;

  const weightedDur = Math.max(1, Math.round((dA * cA + dB * cB) / totalCount));
  const weightedMax = Math.max(weightedDur, Math.round((mA * cA + mB * cB) / totalCount));

  return { durability: weightedDur, maxDurability: weightedMax };
};

/**
 * 檢查兩件道具是否符合堆疊規則。
 * 1. 同一 itemId、相同客製名稱、相同附加營養、非帶內容物容器。
 * 2. 腐壞消耗品：同一保鮮檔位 (FRESH / STALE / SPOILING) 允許堆疊。
 * 3. 非腐壞耐用裝備：durability > 0 維持獨立實體，不可堆疊。
 * 4. 無耐久道具：一律可堆疊。
 * @param {Object} itemA
 * @param {Object} itemB
 * @param {Array<Object>} [dbItems=[]]
 * @returns {boolean}
 */
export const canItemsStack = (itemA, itemB, dbItems = []) => {
  if (!itemA || !itemB) return false;
  const idA = itemA.itemId || itemA.id || '';
  const idB = itemB.itemId || itemB.id || '';
  if (!idA || !idB || idA !== idB) return false;
  if ((itemA.customName || '') !== (itemB.customName || '')) return false;
  if (!areBonusNutritionsEqual(itemA.bonusNutrition, itemB.bonusNutrition)) return false;

  // 容器類道具或帶有實質內容物者不可堆疊，各自為獨立實體
  const hasSubstantiveContentsA = Boolean(itemA.contents && (itemA.contents.itemId || itemA.contents.amount > 0));
  const hasSubstantiveContentsB = Boolean(itemB.contents && (itemB.contents.itemId || itemB.contents.amount > 0));
  if (hasSubstantiveContentsA || hasSubstantiveContentsB) {
    return false;
  }

  const isContainerA = Boolean(
    itemA.isContainer ||
    (Array.isArray(dbItems) && dbItems.some((d) => d.itemId === idA && (Array.isArray(d.type) ? d.type.includes('CONTAINER') : d.type === 'CONTAINER')))
  );
  const isContainerB = Boolean(
    itemB.isContainer ||
    (Array.isArray(dbItems) && dbItems.some((d) => d.itemId === idB && (Array.isArray(d.type) ? d.type.includes('CONTAINER') : d.type === 'CONTAINER')))
  );
  if (isContainerA || isContainerB) {
    return false;
  }

  const dbItem = Array.isArray(dbItems) ? dbItems.find((d) => d.itemId === idA) : null;
  const isDecayA = isDecayItem(itemA, dbItem);
  const isDecayB = isDecayItem(itemB, dbItem);

  // 若為腐壞道具：相同保鮮檔位 (Tier) 允許堆疊合併
  if (isDecayA && isDecayB) {
    const tierA = getFreshnessTier(itemA.durability, itemA.maxDurability);
    const tierB = getFreshnessTier(itemB.durability, itemB.maxDurability);
    if (tierA === FRESHNESS_TIERS.ROTTED || tierB === FRESHNESS_TIERS.ROTTED) {
      return false;
    }
    return tierA === tierB;
  }

  const durA = itemA.durability !== undefined && itemA.durability !== null && itemA.durability > 0 ? itemA.durability : -1;
  const durB = itemB.durability !== undefined && itemB.durability !== null && itemB.durability > 0 ? itemB.durability : -1;

  // 具有耐久度且非腐敗之耐久裝備 (如武器、鎬、工具)，仍維持獨立實體不可堆疊
  if (durA > 0 || durB > 0) {
    return false;
  }
  return durA <= 0 && durB <= 0;
};

/**
 * 依耐久度百分比取得進度條顏色。
 * 規則：30% 以下為紅色，31-90% 為黃色，91% 以上為綠色。
 * @param {number} percent - 耐久度百分比 (0-100)。
 * @returns {string} 色碼字串。
 */
export const getDurabilityColor = (percent) => {
  if (percent <= 30) return '#ef4444'; // 紅色
  if (percent <= 90) return '#eab308'; // 黃色
  return '#22c55e';                    // 綠色
};

/**
 * 依負重百分比取得進度條顏色。
 * 規則與物品腐壞機制相同但順序相反（低為綠、高為紅）：
 * 30% 以下為綠色，31-90% 為黃色，91% 以上或超重為紅色。
 * @param {number} percent - 負重百分比 (0-100)。
 * @param {boolean} [isOverburdened=false] - 是否處於負重超載狀態。
 * @returns {string} 色碼字串。
 */
export const getWeightColor = (percent, isOverburdened = false) => {
  if (isOverburdened || percent > 90) return '#ef4444'; // 紅色
  if (percent > 30) return '#eab308';                   // 黃色
  return '#22c55e';                                     // 綠色
};

/**
 * 判斷指定道具實體或基礎定義是否為永久免損耗道具。
 * 規則：道具實體或基礎定義之 durability 等於 PERMANENT_DURABILITY (-1)。
 * @param {Object} item - 道具實體物件。
 * @param {Object} [dbItem] - 物品基礎定義物件。
 * @returns {boolean} 是否為永久免損耗道具。
 */
export const isPermanentItem = (item, dbItem) => {
  if (!item && !dbItem) return false;
  const dur = (item?.durability !== undefined && item?.durability !== null)
    ? Number(item.durability)
    : ((dbItem?.durability !== undefined && dbItem?.durability !== null) ? Number(dbItem.durability) : PERMANENT_DURABILITY);
  return dur === PERMANENT_DURABILITY;
};

/**
 * 判斷指定工具實體是否具備可用性（耐久度 > 0 或為永久免損耗工具）。
 * @param {Object} item - 工具實體物件。
 * @param {Object} [dbItem] - 物品基礎定義物件。
 * @returns {boolean} 工具是否可用。
 */
export const isToolUsable = (item, dbItem) => {
  if (!item && !dbItem) return false;
  if (isPermanentItem(item, dbItem)) return true;
  const dur = (item?.durability !== undefined && item?.durability !== null)
    ? Number(item.durability)
    : ((dbItem?.durability !== undefined && dbItem?.durability !== null) ? Number(dbItem.durability) : 0);
  return dur > 0;
};

/**
 * 計算道具的當前耐久度百分比 (0-100)。
 * 規則：若為永久免損耗道具或無有效耐久度則回傳 -1。
 * @param {Object} item - 道具實體物件。
 * @param {Object} [dbItem] - 物品基礎定義物件。
 * @returns {number} 0 到 100 之間的數值，永久道具或無耐久度則為 -1。
 */
export const getItemDurabilityPercent = (item, dbItem) => {
  if (isPermanentItem(item, dbItem)) return PERMANENT_DURABILITY;
  const curDur = (item?.durability !== undefined && item?.durability !== null && item.durability > 0)
    ? item.durability
    : -1;
  if (curDur <= 0) return -1;

  const maxDur = (item?.maxDurability !== undefined && item?.maxDurability > 0)
    ? item.maxDurability
    : ((dbItem?.durability !== undefined && dbItem.durability > 0) ? dbItem.durability : curDur);

  return Math.min(100, Math.max(0, (curDur / maxDur) * 100));
};

/**
 * 依耐久度百分比取得道具狀態文字與顏色樣式。
 * 規則：
 * - 永久免損耗 (-1 / PERMANENT_DURABILITY)：已具備 (Available) 綠色
 * - 91% 以上（綠色）：穩固 (Sturdy)
 * - 31% - 90%（黃色）：普通 (Decent)
 * - 30% 以下（紅色）：破舊 (Worn)
 *
 * @param {number} percent - 耐久度百分比 (0-100)，永久道具為 -1。
 * @param {string} [language='zh-TW'] - 語系代碼 ('zh-TW' 或 'en')。
 * @returns {{ text: string, color: string, badgeStyle: { background: string, color: string, border: string } }}
 */
export const getDurabilityStatusInfo = (percent, language = 'zh-TW') => {
  if (percent === PERMANENT_DURABILITY || percent === -1) {
    return {
      text: language === 'en' ? 'Available' : '已具備',
      color: '#4ade80',
      badgeStyle: {
        background: 'rgba(34, 197, 94, 0.15)',
        color: '#4ade80',
        border: '1px solid rgba(34, 197, 94, 0.3)',
      },
    };
  }
  if (percent <= 30) {
    return {
      text: language === 'en' ? 'Worn' : '破舊',
      color: '#ef4444',
      badgeStyle: {
        background: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.3)',
      },
    };
  }
  if (percent <= 90) {
    return {
      text: language === 'en' ? 'Decent' : '普通',
      color: '#eab308',
      badgeStyle: {
        background: 'rgba(234, 179, 8, 0.15)',
        color: '#facc15',
        border: '1px solid rgba(234, 179, 8, 0.3)',
      },
    };
  }
  return {
    text: language === 'en' ? 'Sturdy' : '穩固',
    color: '#22c55e',
    badgeStyle: {
      background: 'rgba(34, 197, 94, 0.15)',
      color: '#4ade80',
      border: '1px solid rgba(34, 197, 94, 0.3)',
    },
  };
};

/**
 * 比較兩道具之耐久度，依指定排序方式排序（耐久度相同時維持原順序）。
 * 排序規則：
 * - 'asc'（升序，消耗優先）：有限耐久度由低到高排在最前面，永久免損耗道具 (-1) 排在最後面。
 * - 'desc'（降序，優選優先）：永久免損耗道具視同無窮大耐久排在最前，其次為有限耐久度由高到低。
 * @param {Object} a - 道具 A。
 * @param {Object} b - 道具 B。
 * @param {'asc'|'desc'|boolean} [order='asc'] - 排序方式：'asc'（預設，最低耐久優先）或 'desc'（最高耐久優先）。
 * @returns {number}
 */
export const compareItemDurability = (a, b, order = 'asc') => {
  const isAPerm = isPermanentItem(a);
  const isBPerm = isPermanentItem(b);
  if (isAPerm && isBPerm) return 0;
  if (!isAPerm && isBPerm) return order === 'desc' || order === false ? 1 : -1;
  if (isAPerm && !isBPerm) return order === 'desc' || order === false ? -1 : 1;

  const durA = (a?.durability !== undefined && a?.durability !== null && a.durability > 0) ? a.durability : -1;
  const durB = (b?.durability !== undefined && b?.durability !== null && b.durability > 0) ? b.durability : -1;
  if (durA > 0 && durB > 0) {
    const isDesc = order === 'desc' || order === false;
    return isDesc ? durB - durA : durA - durB;
  }
  return 0;
};

/**
 * 判斷指定道具是否會隨時間腐敗。
 * 規則：道具定義中的 type 包含 'DECAY' 且具有耐久度 (durability > 0)；工具或無 DECAY 標籤者不腐爛。
 * @param {Object} item - 道具實體物件。
 * @param {Object} [dbItem] - 物品基礎定義物件。
 * @returns {boolean} 是否會腐爛。
 */
export const isDecayItem = (item, dbItem) => {
  if (!item && !dbItem) return false;
  const curDur = (item?.durability !== undefined && item?.durability !== null) ? Number(item.durability) : -1;
  const maxDur = (item?.maxDurability !== undefined && item?.maxDurability !== null) ? Number(item.maxDurability) : -1;
  const baseDur = (dbItem?.durability !== undefined && dbItem?.durability !== null) ? Number(dbItem.durability) : -1;
  const hasDurability = curDur > 0 || maxDur > 0 || baseDur > 0;
  if (!hasDurability) return false;

  const rawType = dbItem?.type || item?.type;
  if (!rawType) return false;
  if (Array.isArray(rawType)) {
    return rawType.includes('DECAY');
  }
  if (typeof rawType === 'string') {
    return rawType.split(',').map((t) => t.trim()).includes('DECAY');
  }
  return false;
};

/**
 * 結算道具清單的腐爛狀態。
 * 規則：
 * 1. 每 1 分鐘 -1 耐久度，以道具獨立時間戳 (lastDecayedAt) 為準。
 * 2. 耐久度扣至 <= 0 時自動刪除。
 * 3. 推進時間戳時保留未滿 1 分鐘的餘額 (lastTime + elapsedMinutes * 60000)。
 * 4. 若為玩家道具 (isPlayer=true) 且發生腐爛，記錄腐爛物品資訊以便後續發送系統訊息。
 *
 * @param {Array<Object>} [items=[]] - 道具實體清單（背包或地面物品）。
 * @param {Array<Object>} [allDbItems=[]] - 物品基礎定義清單。
 * @param {Object} [options={}] - 選項物件。
 * @param {boolean} [options.isPlayer=false] - 是否為玩家背包物品。
 * @param {number|Date} [options.currentTime] - 當前結算時間（預設為 Date.now()）。
 * @returns {{ updatedItems: Array<Object>, rottedItems: Array<Object>, isChanged: boolean }}
 */
export const settleItemDecay = (items = [], allDbItems = [], options = {}) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { updatedItems: [], rottedItems: [], isChanged: false };
  }

  const isPlayer = Boolean(options.isPlayer);
  const now = options.currentTime ? new Date(options.currentTime).getTime() : Date.now();
  const dbItemMap = new Map();
  if (Array.isArray(allDbItems)) {
    for (const d of allDbItems) {
      if (d && d.itemId) {
        dbItemMap.set(d.itemId, d);
      }
    }
  }

  const updatedItems = [];
  const rottedItems = [];
  let isChanged = false;

  for (const rawItem of items) {
    const item = rawItem && rawItem.toObject ? rawItem.toObject() : { ...rawItem };
    const dbItem = dbItemMap.get(item.itemId);

    if (!isDecayItem(item, dbItem)) {
      updatedItems.push(item);
      continue;
    }

    const lastTime = item.lastDecayedAt ? new Date(item.lastDecayedAt).getTime() : now;
    if (!item.lastDecayedAt) {
      item.lastDecayedAt = new Date(now).toISOString();
      isChanged = true;
    }

    const elapsedMs = Math.max(0, now - lastTime);
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    if (elapsedMinutes <= 0) {
      updatedItems.push(item);
      continue;
    }

    isChanged = true;
    const currentDur = Number(item.durability) || 0;
    const newDurability = currentDur - elapsedMinutes;

    if (newDurability <= 0) {
      if (isPlayer) {
        const itemName = item.customName || dbItem?.name || item.itemId;
        const itemNameEn = item.customNameEn || dbItem?.nameEn || dbItem?.name || item.itemId;
        rottedItems.push({
          instanceId: item.instanceId,
          itemId: item.itemId,
          name: itemName,
          nameEn: itemNameEn,
          count: item.count || 1,
        });
      }
      // 耐久 <= 0 時自動刪除，不推入 updatedItems
    } else {
      const newLastDecayedAt = new Date(lastTime + elapsedMinutes * 60000).toISOString();
      updatedItems.push({
        ...item,
        durability: newDurability,
        lastDecayedAt: newLastDecayedAt,
      });
    }
  }

  // 跨檔位降級後的同檔位自動整併 (依加權平均耐久度合併同檔位堆疊)
  const consolidatedItems = [];
  for (const item of updatedItems) {
    const dbItem = dbItemMap.get(item.itemId);
    if (!isDecayItem(item, dbItem)) {
      consolidatedItems.push(item);
      continue;
    }
    const matchIdx = consolidatedItems.findIndex((c) => canItemsStack(c, item, allDbItems));
    if (matchIdx >= 0) {
      const existing = consolidatedItems[matchIdx];
      const oldCount = existing.count || 1;
      const addCount = item.count || 1;
      const newTotal = oldCount + addCount;
      const weighted = calculateWeightedDurability(
        existing.durability,
        existing.maxDurability,
        oldCount,
        item.durability,
        item.maxDurability,
        addCount
      );
      consolidatedItems[matchIdx] = {
        ...existing,
        count: newTotal,
        durability: weighted.durability,
        maxDurability: weighted.maxDurability,
        lastDecayedAt: new Date(Math.max(
          new Date(existing.lastDecayedAt || now).getTime(),
          new Date(item.lastDecayedAt || now).getTime()
        )).toISOString(),
      };
      isChanged = true;
    } else {
      consolidatedItems.push(item);
    }
  }

  return { updatedItems: consolidatedItems, rottedItems, isChanged };
};

/**
 * 取得背包中符合特定工具類型的所有可用工具實體（耐久度 > 0 或永久免損耗工具），並依耐久度升序排序（最低耐久者優先，永久工具排在最後）。
 * @param {Array<Object>} [inventory=[]] - 玩家背包清單。
 * @param {string} toolType - 所需工具類型。
 * @param {Array<Object>} [allDbItems=[]] - 物品基礎定義清單。
 * @returns {Array<Object>} 排序後的工具實體陣列。
 */
export const getMatchingToolsAscending = (inventory = [], toolType, allDbItems = []) => {
  if (!Array.isArray(inventory) || !toolType) return [];
  const dbItemMap = new Map();
  if (Array.isArray(allDbItems)) {
    for (const d of allDbItems) {
      if (d && d.itemId) dbItemMap.set(d.itemId, d);
    }
  }

  const matching = [];
  for (const item of inventory) {
    if (!item || !item.itemId) continue;
    const dbItem = dbItemMap.get(item.itemId);
    const rawTypes = dbItem?.type || item.type;
    const types = Array.isArray(rawTypes) ? rawTypes : (rawTypes ? [rawTypes] : []);
    if (!types.includes(toolType)) continue;

    // 檢查耐久度：實體或基礎定義為可用工具（耐久 > 0 或為永久免損耗工具）
    if (isToolUsable(item, dbItem)) {
      matching.push(item);
    }
  }

  // 依耐久度升序排序（最低耐久度者排第一位，永久免損耗工具排在最後）
  matching.sort((a, b) => compareItemDurability(a, b, 'asc'));
  return matching;
};

/**
 * 計算單一工具在單次精力消耗下最大可執行的次數。
 * 規則：
 * 1. 若單次精力消耗 <= 0，工具不限制次數 (Infinity)。
 * 2. 若為永久免損耗工具 (durability === -1)，工具不限制次數 (Infinity)。
 * 3. 若工具耐久度不足以執行 1 次 (0 < durability < singleCost)，無論玩家選擇幾次，都只執行 1 次，接著毀壞。
 * 4. 若耐久度 >= singleCost，可執行 Math.ceil(durability / singleCost) 次（最後一次即使剩餘耐久不足 1 次精力，亦允許執行最後 1 次後損毀）。
 *
 * @param {Object} tool - 工具實體物件。
 * @param {number} singleCost - 單次行動實際精力消耗。
 * @returns {number} 最大可執行次數。
 */
export const calculateToolMaxExecutions = (tool, singleCost) => {
  if (typeof singleCost !== 'number' || singleCost <= 0) return Infinity;
  if (isPermanentItem(tool)) return Infinity;
  const dur = Number(tool?.durability) || 0;
  if (dur <= 0) return 0;
  return Math.max(1, Math.ceil(dur / singleCost));
};

/**
 * 計算所有需求工具在該行動下的最大可執行次數（瓶頸最小值）。
 * 若工具需求已由場景設施 (locBuildingTypes) 提供，則免扣耐久且不限制次數。
 *
 * @param {Array<Object>} [inventory=[]] - 玩家背包清單。
 * @param {Array<string>} [requiredToolTypes=[]] - 行動所需工具類型。
 * @param {number} [singleCost=0] - 單次行動實際精力消耗。
 * @param {Array<Object>} [allDbItems=[]] - 物品基礎定義清單。
 * @param {Array<string>} [locBuildingTypes=[]] - 場景設施類型。
 * @returns {{ maxExecutableQty: number, selectedTools: Map<string, Object> }}
 */
export const calculateMaxExecutableByTools = (
  inventory = [],
  requiredToolTypes = [],
  singleCost = 0,
  allDbItems = [],
  locBuildingTypes = []
) => {
  const nonConsumables = (requiredToolTypes || []).filter((t) => t !== 'BAIT');
  if (nonConsumables.length === 0) {
    return { maxExecutableQty: Infinity, selectedTools: new Map() };
  }

  let minLimit = Infinity;
  const selectedTools = new Map();

  for (const toolType of nonConsumables) {
    // 1. 若場景內已有固定建築（如工作檯、爐台），免扣耐久且不限次數
    if (Array.isArray(locBuildingTypes) && locBuildingTypes.includes(toolType)) {
      continue;
    }

    // 2. 需由背包提供：篩選並按耐久升序排序
    const matching = getMatchingToolsAscending(inventory, toolType, allDbItems);
    if (matching.length === 0) {
      return { maxExecutableQty: 0, selectedTools };
    }

    const chosenTool = matching[0];
    selectedTools.set(toolType, chosenTool);

    const limit = calculateToolMaxExecutions(chosenTool, singleCost);
    if (limit < minLimit) {
      minLimit = limit;
    }
  }

  return {
    maxExecutableQty: minLimit,
    selectedTools,
  };
};

/**
 * 扣除背包工具的耐久度，若耐久度扣至 <= 0 則自背包中刪除該道具實體，並回傳損壞的工具資訊。
 *
 * @param {Array<Object>} [inventory=[]] - 玩家背包清單。
 * @param {Map<string, Object>|Array<Object>} [toolsToConsume=[]] - 欲扣除的工具實體。
 * @param {number} [totalEnergyCost=0] - 該次行動實際消耗的總精力量。
 * @returns {{ updatedInventory: Array<Object>, brokenTools: Array<Object> }}
 */
export const applyToolsDurabilityDeduction = (
  inventory = [],
  toolsToConsume = [],
  totalEnergyCost = 0
) => {
  const toolList = Array.isArray(toolsToConsume)
    ? toolsToConsume
    : (toolsToConsume instanceof Map ? Array.from(toolsToConsume.values()) : []);

  if (toolList.length === 0 || totalEnergyCost <= 0) {
    return { updatedInventory: [...inventory], brokenTools: [] };
  }

  const brokenTools = [];
  const brokenInstanceIds = new Set();
  const updatedDurabilityMap = new Map();

  for (const tool of toolList) {
    // 永久免損耗工具不扣除耐久度
    if (isPermanentItem(tool)) {
      continue;
    }

    const curDur = Number(tool.durability) || 0;
    const newDur = Math.round((curDur - totalEnergyCost) * 100) / 100;

    if (newDur <= 0) {
      brokenInstanceIds.add(tool.instanceId);
      brokenTools.push({
        ...tool,
        durability: 0,
      });
    } else {
      updatedDurabilityMap.set(tool.instanceId, newDur);
    }
  }

  const updatedInventory = [];
  for (const item of inventory) {
    if (brokenInstanceIds.has(item.instanceId)) {
      // 耐久扣至 <= 0，直接自背包中刪除該道具實體
      continue;
    }
    if (updatedDurabilityMap.has(item.instanceId)) {
      updatedInventory.push({
        ...item,
        durability: updatedDurabilityMap.get(item.instanceId),
      });
    } else {
      updatedInventory.push({ ...item });
    }
  }

  return { updatedInventory, brokenTools };
};

/**
 * 檢查路徑連線的通行道具需求（驗證背包是否具備且符合 isToolUsable）。
 * 支援透過 requiredItemId 指定特定道具，或透過 requiredItemType 指定特定道具類型。
 *
 * @param {Object} [connection] - 路徑連線物件（包含 requiredItemId, requiredItemType, consumeOnTravel 等）。
 * @param {Array<Object>} [inventory=[]] - 玩家背包清單。
 * @param {Array<Object>} [allDbItems=[]] - 物品基礎定義清單。
 * @returns {{
 *   canTravel: boolean,
 *   requiredItemId?: string,
 *   requiredItemType?: string,
 *   requiredItemName?: string,
 *   requiredItemNameEn?: string,
 *   consumeOnTravel: boolean,
 *   matchedItem?: Object|null,
 *   messageZh?: string,
 *   messageEn?: string
 * }} 檢驗結果物件。
 */
export const checkTravelRequirements = (connection, inventory = [], allDbItems = []) => {
  if (!connection) {
    return { canTravel: true, consumeOnTravel: false };
  }

  const reqItemId = connection.requiredItemId || '';
  const reqItemType = connection.requiredItemType || '';
  const consumeOnTravel = Boolean(connection.consumeOnTravel);

  // 無任何道具需求限制
  if (!reqItemId && !reqItemType) {
    return { canTravel: true, consumeOnTravel: false };
  }

  const dbItemMap = new Map();
  if (Array.isArray(allDbItems)) {
    for (const d of allDbItems) {
      if (d && d.itemId) dbItemMap.set(d.itemId, d);
    }
  }

  // 1. 指定特定物品 ID 檢查
  if (reqItemId) {
    const dbReqItem = dbItemMap.get(reqItemId);
    const reqName = dbReqItem?.name || reqItemId;
    const reqNameEn = dbReqItem?.nameEn || dbReqItem?.name || reqItemId;

    // 搜尋背包中符合該 itemId 且數量 > 0 且具備可用性 (isToolUsable) 的道具
    const matchedItem = (inventory || []).find((inv) => {
      if (!inv || inv.itemId !== reqItemId) return false;
      if ((inv.count || 1) <= 0) return false;
      const dbI = dbItemMap.get(inv.itemId);
      return isToolUsable(inv, dbI);
    });

    if (!matchedItem) {
      return {
        canTravel: false,
        requiredItemId: reqItemId,
        requiredItemName: reqName,
        requiredItemNameEn: reqNameEn,
        consumeOnTravel,
        messageZh: `前往該地點需要持有【${reqName}】！`,
        messageEn: `Traveling to this location requires [${reqNameEn}]!`,
      };
    }

    return {
      canTravel: true,
      requiredItemId: reqItemId,
      requiredItemName: reqName,
      requiredItemNameEn: reqNameEn,
      consumeOnTravel,
      matchedItem,
    };
  }

  // 2. 指定物品類型檢查
  if (reqItemType) {
    const matchedTypeItem = (inventory || []).find((inv) => {
      if (!inv || (inv.count || 1) <= 0) return false;
      const dbI = dbItemMap.get(inv.itemId);
      const rawTypes = dbI?.type || inv.type;
      const types = Array.isArray(rawTypes) ? rawTypes : (rawTypes ? [rawTypes] : []);
      if (!types.includes(reqItemType)) return false;
      return isToolUsable(inv, dbI);
    });

    if (!matchedTypeItem) {
      return {
        canTravel: false,
        requiredItemType: reqItemType,
        consumeOnTravel,
        messageZh: `前往該地點需要具備相關道具！`,
        messageEn: `Traveling to this location requires a suitable item!`,
      };
    }

    const dbMatched = dbItemMap.get(matchedTypeItem.itemId);
    return {
      canTravel: true,
      requiredItemType: reqItemType,
      requiredItemName: dbMatched?.name || matchedTypeItem.itemId,
      requiredItemNameEn: dbMatched?.nameEn || dbMatched?.name || matchedTypeItem.itemId,
      consumeOnTravel,
      matchedItem: matchedTypeItem,
    };
  }

  return { canTravel: true, consumeOnTravel: false };
};

/**
 * 依堆疊規則將道具新增至地面放置物清單 (placedItems)。
 * 1. 容器或帶內容物道具：維持獨立實體。
 * 2. 具有耐久度且非腐壞之裝備/工具：維持獨立實體。
 * 3. 腐壞消耗品：同一保鮮檔位 (FRESH / STALE / SPOILING) 自動堆疊合併，並採加權平均耐久度。
 * 4. 無耐久道具：自動堆疊合併。
 * @param {Array<Object>} [placedItems=[]]
 * @param {Object} itemToAdd
 * @param {Array<Object>} [dbItems=[]]
 * @returns {Array<Object>}
 */
export const addItemToPlacedItems = (placedItems = [], itemToAdd, dbItems = []) => {
  const updated = (placedItems || []).map((p) => (p && p.toObject ? p.toObject() : { ...p }));
  const addCount = Math.max(1, Number(itemToAdd.count) || 1);
  const dbItem = Array.isArray(dbItems) ? dbItems.find((d) => d.itemId === itemToAdd.itemId) : null;
  const isDecay = isDecayItem(itemToAdd, dbItem);

  const isContainerItem = Boolean(
    itemToAdd.isContainer ||
    (itemToAdd.contents && (itemToAdd.contents.itemId || itemToAdd.contents.amount > 0)) ||
    (Array.isArray(dbItems) && dbItems.some((d) => d.itemId === itemToAdd.itemId && (Array.isArray(d.type) ? d.type.includes('CONTAINER') : d.type === 'CONTAINER')))
  );

  // 非腐敗但具有耐久度的裝備/工具，或者容器，維持獨立實體
  const isEquipDurabilityItem = !isDecay && itemToAdd.durability !== undefined && itemToAdd.durability !== null && itemToAdd.durability > 0;

  if (isEquipDurabilityItem || isContainerItem) {
    for (let k = 0; k < addCount; k++) {
      updated.push({
        instanceId: (k === 0 && itemToAdd.instanceId) ? itemToAdd.instanceId : generateInstanceId(),
        itemId: itemToAdd.itemId,
        count: 1,
        durability: itemToAdd.durability,
        maxDurability: itemToAdd.maxDurability !== undefined && itemToAdd.maxDurability > 0 ? itemToAdd.maxDurability : itemToAdd.durability,
        quality: itemToAdd.quality || '普通',
        customName: itemToAdd.customName || '',
        customNameEn: itemToAdd.customNameEn || '',
        bonusNutrition: itemToAdd.bonusNutrition ? { ...itemToAdd.bonusNutrition } : undefined,
        contents: itemToAdd.contents ? { ...itemToAdd.contents } : undefined,
        triggerQuestId: itemToAdd.triggerQuestId || '',
        lastDecayedAt: itemToAdd.lastDecayedAt ? new Date(itemToAdd.lastDecayedAt).toISOString() : new Date().toISOString(),
      });
    }
    return updated;
  }

  // 嘗試堆疊 (同檔位腐敗消耗品，或無耐久道具)
  const matchIdx = updated.findIndex((p) => canItemsStack(p, itemToAdd, dbItems));

  if (matchIdx >= 0) {
    const existing = updated[matchIdx];
    const oldCount = existing.count || 1;
    const newTotalCount = oldCount + addCount;

    let mergedDurability = existing.durability;
    let mergedMaxDurability = existing.maxDurability;

    if (isDecay && existing.durability > 0 && itemToAdd.durability > 0) {
      const weighted = calculateWeightedDurability(
        existing.durability,
        existing.maxDurability,
        oldCount,
        itemToAdd.durability,
        itemToAdd.maxDurability,
        addCount
      );
      mergedDurability = weighted.durability;
      mergedMaxDurability = weighted.maxDurability;
    }

    updated[matchIdx] = {
      ...existing,
      count: newTotalCount,
      durability: mergedDurability,
      maxDurability: mergedMaxDurability,
      lastDecayedAt: itemToAdd.lastDecayedAt ? new Date(itemToAdd.lastDecayedAt).toISOString() : (existing.lastDecayedAt || new Date().toISOString()),
    };
  } else {
    // 新增為單一堆疊實體 (count: addCount)
    updated.push({
      instanceId: itemToAdd.instanceId || generateInstanceId(),
      itemId: itemToAdd.itemId,
      count: addCount,
      durability: itemToAdd.durability !== undefined ? itemToAdd.durability : -1,
      maxDurability: itemToAdd.maxDurability !== undefined ? itemToAdd.maxDurability : -1,
      quality: itemToAdd.quality || '普通',
      customName: itemToAdd.customName || '',
      customNameEn: itemToAdd.customNameEn || '',
      bonusNutrition: itemToAdd.bonusNutrition ? { ...itemToAdd.bonusNutrition } : undefined,
      triggerQuestId: itemToAdd.triggerQuestId || '',
      lastDecayedAt: itemToAdd.lastDecayedAt ? new Date(itemToAdd.lastDecayedAt).toISOString() : new Date().toISOString(),
    });
  }
  return updated;
};

/**
 * 統一將道具新增至背包陣列。
 * 1. 容器或帶內容物道具：維持獨立實體。
 * 2. 具有耐久度且非腐壞之裝備/工具：維持獨立實體。
 * 3. 腐壞消耗品：同一保鮮檔位 (FRESH / STALE / SPOILING) 自動堆疊合併，並採加權平均耐久度。
 * 4. 無耐久道具：自動堆疊合併。
 * @param {Array<Object>} [inventory=[]] - 現有背包陣列。
 * @param {string} itemId - 道具識別碼。
 * @param {number} [count=1] - 增加的道具數量。
 * @param {Object} [options={}] - 其他附加選項（如 durability、quality、instanceId）。
 * @param {number} [options.durability] - 耐久度數值。
 * @param {number} [options.maxDurability] - 最大耐久度數值。
 * @param {string} [options.quality] - 品質標籤。
 * @param {string} [options.instanceId] - 自訂實體識別碼。
 * @param {string} [options.customName] - 自訂/詞綴中文名稱。
 * @param {string} [options.customNameEn] - 自訂/詞綴英文名稱。
 * @param {Object} [options.bonusNutrition] - 附加營養值物件。
 * @param {Date|string} [options.lastDecayedAt] - 道具時間戳。
 * @param {Array<Object>} [dbItems=[]] - 物品基礎定義物件陣列。
 * @returns {Array<Object>} 更新後的背包陣列。
 */
export const addItemsToInventory = (inventory = [], itemId, count = 1, options = {}, dbItems = []) => {
  const addQty = Math.max(1, Number(count) || 1);
  const updated = [...inventory];
  const dbItem = Array.isArray(dbItems) ? dbItems.find((d) => d.itemId === itemId) : null;
  const targetItem = {
    itemId,
    customName: options.customName || '',
    customNameEn: options.customNameEn || '',
    bonusNutrition: options.bonusNutrition,
    contents: options.contents,
    durability: options.durability,
    maxDurability: options.maxDurability,
    quality: options.quality || '普通',
  };
  const isDecay = isDecayItem(targetItem, dbItem);

  const isContainerItem = Boolean(
    options.isContainer ||
    (options.contents && (options.contents.itemId || options.contents.amount > 0)) ||
    (Array.isArray(dbItems) && dbItems.some((d) => d.itemId === itemId && (Array.isArray(d.type) ? d.type.includes('CONTAINER') : d.type === 'CONTAINER')))
  );

  // 非腐敗但具有耐久度的裝備/工具，或者容器，維持獨立實體
  const isEquipDurabilityItem = !isDecay && options.durability !== undefined && options.durability !== null && options.durability > 0;
  const itemLastDecayedAt = options.lastDecayedAt ? new Date(options.lastDecayedAt).toISOString() : new Date().toISOString();

  if (isEquipDurabilityItem || isContainerItem) {
    for (let k = 0; k < addQty; k++) {
      updated.push({
        instanceId: (k === 0 && options.instanceId) ? options.instanceId : generateInstanceId(),
        itemId,
        count: 1,
        durability: options.durability,
        maxDurability: options.maxDurability !== undefined && options.maxDurability > 0 ? options.maxDurability : options.durability,
        quality: options.quality || '普通',
        lastDecayedAt: itemLastDecayedAt,
        ...(options.contents ? { contents: { ...options.contents } } : {}),
        ...(targetItem.customName ? { customName: targetItem.customName, customNameEn: targetItem.customNameEn } : {}),
        ...(targetItem.bonusNutrition ? { bonusNutrition: targetItem.bonusNutrition } : {}),
      });
    }
    return updated;
  }

  // 檢查是否可堆疊 (同檔位腐敗道具或無耐久道具)
  const existingIdx = updated.findIndex((i) => canItemsStack(i, targetItem, dbItems));

  if (existingIdx >= 0) {
    const existing = updated[existingIdx];
    const oldCount = existing.count || 1;
    const newTotalCount = oldCount + addQty;

    let mergedDurability = existing.durability;
    let mergedMaxDurability = existing.maxDurability;

    if (isDecay && existing.durability > 0 && options.durability > 0) {
      const weighted = calculateWeightedDurability(
        existing.durability,
        existing.maxDurability,
        oldCount,
        options.durability,
        options.maxDurability,
        addQty
      );
      mergedDurability = weighted.durability;
      mergedMaxDurability = weighted.maxDurability;
    }

    const updatedItem = {
      ...existing,
      count: newTotalCount,
      durability: mergedDurability,
      maxDurability: mergedMaxDurability,
      lastDecayedAt: options.lastDecayedAt ? new Date(options.lastDecayedAt).toISOString() : (existing.lastDecayedAt || itemLastDecayedAt),
      ...(targetItem.customName ? { customName: targetItem.customName, customNameEn: targetItem.customNameEn } : {}),
      ...(targetItem.bonusNutrition ? { bonusNutrition: targetItem.bonusNutrition } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
    };
    updated[existingIdx] = updatedItem;
    return updated;
  }

  // 新增獨立堆疊
  updated.push({
    instanceId: options.instanceId || generateInstanceId(),
    itemId,
    count: addQty,
    durability: options.durability !== undefined ? options.durability : -1,
    maxDurability: options.maxDurability !== undefined && options.maxDurability > 0 ? options.maxDurability : (options.durability > 0 ? options.durability : -1),
    quality: options.quality || '普通',
    lastDecayedAt: itemLastDecayedAt,
    ...(options.contents ? { contents: { ...options.contents } } : {}),
    ...(targetItem.customName ? { customName: targetItem.customName, customNameEn: targetItem.customNameEn } : {}),
    ...(targetItem.bonusNutrition ? { bonusNutrition: targetItem.bonusNutrition } : {}),
  });
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
 * 生活技能各等級所需的累計總經驗值門檻清單。
 * Lv0: 0, Lv1: 500, Lv2: 1000, Lv3: 2000, Lv4: 4000, Lv5: 7000
 */
export const SKILL_EXP_THRESHOLDS = [0, 500, 1000, 2000, 4000, 7000];

/**
 * 生活技能等級上限（暫定為 5）。
 */
export const MAX_SKILL_LEVEL = 5;

/**
 * 依據累積總經驗值計算當前生活技能等級（0 ~ 5）。
 * @param {number} totalExp - 當前累積經驗值。
 * @returns {number} 當前等級。
 */
export const calculateSkillLevel = (totalExp = 0) => {
  const exp = Math.max(0, Number(totalExp) || 0);
  for (let lvl = MAX_SKILL_LEVEL; lvl >= 0; lvl--) {
    if (exp >= SKILL_EXP_THRESHOLDS[lvl]) {
      return lvl;
    }
  }
  return 0;
};

/**
 * 取得生活技能升至下一級所需的累計總經驗值門檻。
 * 若已達等級上限 (5)，回傳上限門檻 (7000)。
 * @param {number} [level=0] - 當前技能等級。
 * @returns {number} 升級所需的累計總經驗值。
 */
export const getRequiredExpForNextLevel = (level = 0) => {
  const currentLvl = Math.max(0, Math.floor(Number(level) || 0));
  if (currentLvl >= MAX_SKILL_LEVEL) {
    return SKILL_EXP_THRESHOLDS[MAX_SKILL_LEVEL];
  }
  return SKILL_EXP_THRESHOLDS[currentLvl + 1];
};

/**
 * 計算生活技能等級加成後的最終成功率（百分比 0 ~ 100）。
 * 每 1 級增加 5% 成功率加成（Lv0 +0%、Lv1 +5%，以此類推），上限為 100%。
 * @param {number} [baseRate=100] - 基礎成功率。
 * @param {number} [skillLevel=0] - 相關生活技能等級。
 * @returns {number} 最終成功率整數百分比。
 */
export const calculateSuccessRate = (baseRate = 100, skillLevel = 0) => {
  const base = typeof baseRate === 'number' && !isNaN(baseRate) ? baseRate : 100;
  const level = Math.max(0, Math.floor(Number(skillLevel) || 0));
  const bonus = level * 5;
  return Math.min(100, Math.max(0, Math.round(base + bonus)));
};

/**
 * 將經驗值四捨五入至小數點後兩位，消除浮點數二進位精度誤差。
 * @param {number} val - 欲處理的經驗值數值。
 * @returns {number} 四捨五入後的數值。
 */
export const roundExp = (val) => {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
};

/**
 * 累加生活技能經驗值，並處理升級與等級上限判定。
 * 累積經驗超過 7000 時仍可持續獲得經驗，但不會提升等級（上限為 5）。
 * @param {{ level: number, exp: number }} skillObj - 技能資料物件。
 * @param {number} expToAdd - 獲得的經驗值點數。
 * @returns {{ level: number, exp: number, leveledUp: boolean, levelsGained: number }} 更新後的技能狀態。
 */
export const addLifeSkillExp = (skillObj = {}, expToAdd = 0) => {
  const rawCurrentExp = Math.max(0, Number(skillObj?.exp) || 0);
  const rawExpToAdd = Math.max(0, Number(expToAdd) || 0);
  const totalExp = roundExp(rawCurrentExp + rawExpToAdd);

  const oldLevel = typeof skillObj?.level === 'number'
    ? skillObj.level
    : calculateSkillLevel(rawCurrentExp);
  const newLevel = calculateSkillLevel(totalExp);
  const levelsGained = Math.max(0, newLevel - oldLevel);

  return {
    level: newLevel,
    exp: totalExp,
    leveledUp: levelsGained > 0,
    levelsGained,
  };
};

/**
 * 計算玩家負重上限。
 * 規則：負重上限為固定 100 kg，不再由力量屬性加成（力量改為影響採集類工作速度）。
 * @param {Object} [player] - 玩家物件（保留參數以維護向後相容性）。
 * @returns {number} 負重上限值（預設 100 kg）。
 */
export const calculateMaxWeight = (player) => {
  return DEFAULT_MAX_WEIGHT;
};

/**
 * 計算單一道具實體的實際重量（若為容器且內存液體，則累加液體重量）。
 * @param {Object} invItem - 背包或地面道具實體。
 * @param {Array<Object>} [items=[]] - 全域道具定義資料。
 * @returns {number} 該物品單個實體的實際重量。
 */
export const getItemActualWeight = (invItem, items = []) => {
  if (!invItem) return 0;
  const dbItem = (items || []).find((i) => i.itemId === invItem.itemId);
  const baseWeight = dbItem?.weight ?? 1;

  let liquidWeight = 0;
  if (invItem.contents && invItem.contents.amount > 0 && invItem.contents.itemId) {
    const dbLiquid = (items || []).find((i) => i.itemId === invItem.contents.itemId);
    liquidWeight = (dbLiquid?.weight ?? 0) * invItem.contents.amount;
  }

  return Math.round((baseWeight + liquidWeight) * 100) / 100;
};

/**
 * 計算背包中所有物品的總負重（含容器內存液體）。
 * @param {Array<Object>} [inventory=[]] - 玩家背包陣列。
 * @param {Array<Object>} [items=[]] - 全域道具定義資料。
 * @returns {number} 當前總重量（保留一位小數）。
 */
export const calculateCurrentWeight = (inventory = [], items = []) => {
  const dbItemMap = new Map();
  if (Array.isArray(items)) {
    for (const i of items) {
      if (i && i.itemId) dbItemMap.set(i.itemId, i);
    }
  }

  const total = (inventory || []).reduce((sum, inv) => {
    const dbItem = dbItemMap.get(inv.itemId);
    const baseWeight = dbItem?.weight ?? 1;

    let liquidWeight = 0;
    if (inv.contents && inv.contents.amount > 0 && inv.contents.itemId) {
      const dbLiquid = dbItemMap.get(inv.contents.itemId);
      liquidWeight = (dbLiquid?.weight ?? 0) * inv.contents.amount;
    }

    const itemTotalWeight = (baseWeight + liquidWeight) * (inv.count || 1);
    return sum + itemTotalWeight;
  }, 0);
  return Math.round(total * 10) / 10;
};

/**
 * 檢查玩家是否處於負重超載狀態。
 * 當背包總重嚴格大於負重上限時判定為超重。
 * @param {Object} player - 玩家物件。
 * @param {Array<Object>} [inventory=[]] - 玩家背包陣列。
 * @param {Array<Object>} [items=[]] - 全域道具定義資料。
 * @returns {boolean} 是否超重。
 */
export const isPlayerOverburdened = (player, inventory = [], items = []) => {
  if (!player) return false;
  return calculateCurrentWeight(inventory, items) > calculateMaxWeight(player);
};



/**
 * 計算玩家背包中針對特定液體道具的可用容器容量總和。
 * 規則：
 * 1. 容器定義之 type 包含 'CONTAINER'。
 * 2. 容器定義之 allowedContent 允許 'LIQUID'。
 * 3. 一個容器只能裝一種液體：
 *    - 若容器已有液體且非目標液體，不可裝載。
 *    - 若容器為空，或已裝有相同液體且存量 < 上限，則可繼續裝載。
 *
 * @param {Array<Object>} [inventory=[]] - 玩家背包。
 * @param {string} targetLiquidItemId - 採集或注入之液體道具 ID。
 * @param {Array<Object>} [allDbItems=[]] - 道具原型定義清單。
 * @returns {{ matchingContainers: Array<Object>, totalAvailableCapacity: number, hasAnyContainers: boolean }}
 */
export const calculateLiquidContainerCapacity = (inventory = [], targetLiquidItemId, allDbItems = []) => {
  if (!Array.isArray(inventory) || !targetLiquidItemId) {
    return { matchingContainers: [], totalAvailableCapacity: 0, hasAnyContainers: false };
  }

  const dbItemMap = new Map();
  if (Array.isArray(allDbItems)) {
    for (const d of allDbItems) {
      if (d && d.itemId) dbItemMap.set(d.itemId, d);
    }
  }

  const matchingContainers = [];
  let totalAvailableCapacity = 0;
  let hasAnyContainers = false;

  for (const inv of inventory) {
    const dbI = dbItemMap.get(inv.itemId);
    if (!dbI) continue;
    const types = Array.isArray(dbI.type) ? dbI.type : (dbI.type ? [dbI.type] : []);
    if (!types.includes('CONTAINER')) continue;

    const allowed = dbI.allowedContent || 'LIQUID';
    if (allowed !== 'LIQUID') continue;

    hasAnyContainers = true;
    const maxCapacity = dbI.capacity || 10;
    const currentAmount = inv.contents?.amount || 0;
    const currentLiquid = inv.contents?.itemId || '';

    // 若裝有其他液體，則不可裝此液體
    if (currentAmount > 0 && currentLiquid && currentLiquid !== targetLiquidItemId) {
      continue;
    }

    const availableSpace = Math.max(0, maxCapacity - currentAmount);
    if (availableSpace > 0) {
      matchingContainers.push({
        invItem: inv,
        availableSpace,
        maxCapacity,
        currentAmount,
      });
      totalAvailableCapacity += availableSpace;
    }
  }

  return { matchingContainers, totalAvailableCapacity, hasAnyContainers };
};

/**
 * 將指定數量的液體注入背包中的可用容器中（優先注入已裝有同種液體的容器）。
 * @param {Array<Object>} [inventory=[]] - 玩家背包。
 * @param {string} targetLiquidItemId - 液體道具 ID。
 * @param {number} amountToFill - 欲注入之液體總份數。
 * @param {Array<Object>} [allDbItems=[]] - 道具原型定義清單。
 * @returns {Array<Object>} 更新後的背包陣列。
 */
export const fillLiquidContainers = (inventory = [], targetLiquidItemId, amountToFill, allDbItems = []) => {
  if (!Array.isArray(inventory) || amountToFill <= 0) return inventory;

  const dbItemMap = new Map();
  if (Array.isArray(allDbItems)) {
    for (const d of allDbItems) {
      if (d && d.itemId) dbItemMap.set(d.itemId, d);
    }
  }

  let remaining = amountToFill;

  // 找出所有可用容器索引
  const eligibleIndices = [];
  for (let idx = 0; idx < inventory.length; idx++) {
    const inv = inventory[idx];
    const dbI = dbItemMap.get(inv.itemId);
    if (!dbI) continue;
    const types = Array.isArray(dbI.type) ? dbI.type : (dbI.type ? [dbI.type] : []);
    if (!types.includes('CONTAINER')) continue;
    const allowed = dbI.allowedContent || 'LIQUID';
    if (allowed !== 'LIQUID') continue;

    const maxCap = dbI.capacity || 10;
    const curAmount = inv.contents?.amount || 0;
    const curLiquid = inv.contents?.itemId || '';

    if (curAmount > 0 && curLiquid && curLiquid !== targetLiquidItemId) {
      continue;
    }

    if (curAmount < maxCap) {
      eligibleIndices.push(idx);
    }
  }

  // 排序：優先填充已有相同液體的容器（減少半滿水壺），其次為空水壺
  eligibleIndices.sort((a, b) => {
    const amountA = inventory[a].contents?.amount || 0;
    const amountB = inventory[b].contents?.amount || 0;
    return amountB - amountA;
  });

  for (const idx of eligibleIndices) {
    if (remaining <= 0) break;
    const inv = inventory[idx];
    const dbI = dbItemMap.get(inv.itemId);
    const maxCap = dbI?.capacity || 10;

    if (!inv.contents) {
      inv.contents = { itemId: '', amount: 0 };
    }

    const curAmount = inv.contents.amount || 0;
    const space = Math.max(0, maxCap - curAmount);
    if (space > 0) {
      const fill = Math.min(space, remaining);
      inv.contents.itemId = targetLiquidItemId;
      inv.contents.amount = curAmount + fill;
      remaining -= fill;
    }
  }

  return inventory;
};

/**
 * 檢查獲得道具（購買、採集等）時是否解鎖新製作配方。
 * 比對方式一律依據配方中定義的 triggerItem 是否包含該獲得道具的 itemId。
 *
 * @param {Array} currentUnlocked - 玩家目前已解鎖配方陣列（元素可為字串或物件 { recipeId }）。
 * @param {Array} recipes - 配方資料陣列。
 * @param {string} acquiredItemId - 所獲得道具的 itemId。
 * @returns {{ newlyUnlockedRecipes: Array, updatedUnlocked: Array }} 新解鎖的配方陣列與更新後的解鎖清單。
 */
export const checkRecipeUnlocks = (currentUnlocked = [], recipes = [], acquiredItemId = '') => {
  if (!acquiredItemId || !Array.isArray(recipes) || recipes.length === 0) {
    return {
      newlyUnlockedRecipes: [],
      updatedUnlocked: Array.isArray(currentUnlocked) ? [...currentUnlocked] : [],
    };
  }

  const updatedUnlocked = Array.isArray(currentUnlocked) ? [...currentUnlocked] : [];
  const newlyUnlockedRecipes = [];

  for (const recipe of recipes) {
    const rId = recipe.recipeId || recipe.id;
    if (!rId) continue;

    const alreadyUnlocked = updatedUnlocked.some((ur) => {
      return typeof ur === 'string' ? ur === rId : ur?.recipeId === rId;
    });
    if (alreadyUnlocked) continue;

    const triggers = Array.isArray(recipe.triggerItem)
      ? recipe.triggerItem
      : (recipe.triggerItem ? [recipe.triggerItem] : []);

    if (triggers.includes(acquiredItemId)) {
      newlyUnlockedRecipes.push(recipe);
      updatedUnlocked.push({ recipeId: rId });
    }
  }

  return { newlyUnlockedRecipes, updatedUnlocked };
};

/**
 * 檢查食用或飲用特定數量之營養道具時，是否會導致玩家飽食度或水分超過上限（120）。
 *
 * @param {Object} playerOrStats - 玩家物件或玩家 stats 物件。
 * @param {Object} nutrition - 營養物件，包含 food, water 等增益值。
 * @param {number} [qty=1] - 攝取數量。
 * @returns {{ wouldExceed: boolean, wouldExceedFood: boolean, wouldExceedWater: boolean, potentialFoodGain: number, potentialWaterGain: number }}
 */
export const checkNutritionOverLimit = (playerOrStats = {}, nutrition = {}, qty = 1) => {
  const stats = playerOrStats.stats || playerOrStats || {};
  const currentWater = stats.water ?? MAX_WATER;
  const currentFood = stats.food ?? MAX_FOOD;

  const count = Math.max(0, Number(qty) || 0);
  const potentialFoodGain = (nutrition.food || 0) * count;
  const potentialWaterGain = (nutrition.water || 0) * count;

  const wouldExceedFood =
    potentialFoodGain > 0 && Math.round((currentFood + potentialFoodGain) * 100) / 100 > MAX_FOOD;
  const wouldExceedWater =
    potentialWaterGain > 0 && Math.round((currentWater + potentialWaterGain) * 100) / 100 > MAX_WATER;

  return {
    wouldExceed: Boolean(wouldExceedFood || wouldExceedWater),
    wouldExceedFood,
    wouldExceedWater,
    potentialFoodGain,
    potentialWaterGain,
  };
};

/**
 * 根據玩家目前飽食度與水分，以及單份營養數據與可用持有量，
 * 計算出在「不超過上限 120」的前提下最多能吃/喝多少（吃飽/喝飽之數量）。
 *
 * @param {Object} playerOrStats - 玩家物件或玩家 stats 物件。
 * @param {Object} singleNutrition - 單份營養物件，包含 food, water 等增益值。
 * @param {number} [availableQty=1] - 目前持有數量或容器液體存量。
 * @returns {number} 最大可攝取數量（若已飽腹或吃 1 個都會溢出則回傳 0）。
 */
export const calculateMaxConsumableQty = (playerOrStats = {}, singleNutrition = {}, availableQty = 1) => {
  const stats = playerOrStats.stats || playerOrStats || {};
  const currentWater = stats.water ?? MAX_WATER;
  const currentFood = stats.food ?? MAX_FOOD;

  const maxAvailable = Math.max(0, Math.floor(Number(availableQty) || 0));
  if (maxAvailable <= 0) return 0;

  const unitFood = singleNutrition.food || 0;
  const unitWater = singleNutrition.water || 0;

  // 若該物品不提供飽食度亦不提供水分，則非飽食/補水道具，無法吃飽/喝飽
  if (unitFood <= 0 && unitWater <= 0) {
    return 0;
  }

  let maxByFood = Infinity;
  if (unitFood > 0) {
    const room = MAX_FOOD - currentFood;
    if (room <= 0) return 0;
    maxByFood = Math.floor(Math.round(room * 100) / Math.round(unitFood * 100));
  }

  let maxByWater = Infinity;
  if (unitWater > 0) {
    const room = MAX_WATER - currentWater;
    if (room <= 0) return 0;
    maxByWater = Math.floor(Math.round(room * 100) / Math.round(unitWater * 100));
  }

  const allowable = Math.min(maxByFood, maxByWater);
  if (allowable <= 0) return 0;

  return Math.min(maxAvailable, allowable);
};


