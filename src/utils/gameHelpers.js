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
 * 標準化並校準玩家各項能力值，補齊預設值（例如 water、food 預設為 100）。
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
    maxHp: rawStats.maxHp ?? fallback.maxHp ?? 100,
    defense: rawStats.defense ?? fallback.defense ?? 0,
    water: rawStats.water ?? fallback.water ?? 100,
    food: rawStats.food ?? fallback.food ?? 100,
  };
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
 * @returns {Array<Object>} 更新後的背包陣列。
 */
export const addItemsToInventory = (inventory = [], itemId, count = 1, options = {}) => {
  const addQty = Math.max(1, Number(count) || 1);
  const updated = [...inventory];
  const existingIdx = updated.findIndex((i) => i.itemId === itemId);

  if (existingIdx >= 0) {
    updated[existingIdx] = {
      ...updated[existingIdx],
      count: (updated[existingIdx].count || 1) + addQty,
      ...(options.durability !== undefined ? { durability: options.durability } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
    };
  } else {
    updated.push({
      instanceId: options.instanceId || generateInstanceId(),
      itemId,
      count: addQty,
      durability: options.durability !== undefined ? options.durability : -1,
      quality: options.quality || '普通',
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
