/**
 * 全域遊戲核心規則與數值常數定義 (Game Core Constants & Rules)
 * 供前端 (src) 與後端 (server) 共同調用的單一真相來源 (Single Source of Truth, SSOT)。
 */

// 生存與基礎能力值上限 / 初始預設值
export const MAX_WATER = 120; // 水分上限
export const MAX_FOOD = 120; // 飽食度上限
export const MAX_HP = 100; // 基礎生命值上限
export const MAX_ENERGY = 4320; // 基礎精力值上限
export const DEFAULT_MAX_WEIGHT = 100; // 預設背包負重上限 (kg)
export const TOTAL_CREATION_STATS = 10; // 創角可分配三維能力值總和

// 預設基礎能力值結構
export const DEFAULT_INITIAL_STATS = Object.freeze({
  strength: 1,
  speed: 1,
  dexterity: 1,
  maxHp: MAX_HP,
  defense: 0,
  water: MAX_WATER,
  food: MAX_FOOD,
});

// 狀態判定固定數值門檻（不依據上限百分比浮動，固定為常數 80、60、30）
export const STATUS_THRESHOLD_WELL_FED = 80; // 充沛飽足門檻（飽食 >= 80 且 水分 >= 80）
export const STATUS_THRESHOLD_LIGHT_FED = 60; // 輕度飽足門檻（飽食 >= 60 且 水分 >= 60）
export const STATUS_THRESHOLD_FAMISHED = 30; // 飢渴虛弱門檻（飽食 < 30 且 水分 < 30）

// 精力相關規則常數
export const ENERGY_RECOVERY_INTERVAL_MS = 15 * 60 * 1000; // 自然恢復週期（15 分鐘）
export const ENERGY_RECOVERY_AMOUNT = 15; // 每個自然週期恢復精力點數
export const ENERGY_DRAIN_CYCLE = 15; // 每累積消耗 15 點精力，扣除 1 水分與 1 飽食度
export const ENERGY_HP_REGEN_CYCLE = 10; // 充沛飽足狀態下，每累積消耗 10 點精力恢復 1 點 HP

// 狀態倍率
export const STATUS_BUFF_MULTIPLIER = 0.9; // 飽足狀態行動精力消耗折扣 (90%)
export const STATUS_DEBUFF_MULTIPLIER = 1.2; // 飢渴虛弱狀態行動精力消耗增加 (120%)

// 能力精力折扣常數（方案 B：每多 1 點能力節省 1% 精力，最低倍率 0.5 即最多節省 50%）
export const STAT_ENERGY_DISCOUNT_PER_POINT = 0.01; // 每 1 點能力節省 1% 精力
export const STAT_ENERGY_MIN_MULTIPLIER = 0.5; // 最低倍率 0.5（最高節省 50%）

// 耐久度相關常數
export const PERMANENT_DURABILITY = -1; // 永久免損耗道具/設施的哨兵值耐久度 (-1)

export const GAME_CONSTANTS = Object.freeze({
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
  ENERGY_RECOVERY_INTERVAL_MS,
  ENERGY_RECOVERY_AMOUNT,
  ENERGY_DRAIN_CYCLE,
  ENERGY_HP_REGEN_CYCLE,
  STATUS_BUFF_MULTIPLIER,
  STATUS_DEBUFF_MULTIPLIER,
  STAT_ENERGY_DISCOUNT_PER_POINT,
  STAT_ENERGY_MIN_MULTIPLIER,
  PERMANENT_DURABILITY,
});

export default GAME_CONSTANTS;
