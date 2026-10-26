import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { Building } from '../models/Building.js';
import { Location } from '../models/Location.js';
import { Item } from '../models/Item.js';
import { Npc } from '../models/Npc.js';
import { Recipe } from '../models/Recipe.js';
import { BattleSkill } from '../models/BattleSkill.js';
import { Quest } from '../models/Quest.js';

import { initialBuildings } from '../seeds/seedBuildings.js';
import { initialLocations } from '../seeds/seedLocations.js';
import { initialItems } from '../seeds/seedItems.js';
import { initialNpcs } from '../seeds/seedNpcs.js';
import { initialRecipes } from '../seeds/seedRecipes.js';
import { initialBattleSkills } from '../seeds/seedBattleSkills.js';
import { initialQuests } from '../seeds/seedQuests.js';

dotenv.config();

/**
 * 解析目標資料庫名稱及過濾引數標籤。
 * 優先序：
 * 1. 命令行引數包含 '--prod' 或 '--production' -> 'AetherImmersion'（正式玩家資料庫）
 * 2. process.env.MONGODB_DB_NAME
 * 3. process.env.NODE_ENV === 'production' -> 'AetherImmersion'
 * 4. 預設（開發環境）-> 'AetherImmersion_dev'（本機開發資料庫）
 * @param {string[]} targets
 * @returns {{ targetDbName: string, filteredTargets: string[] }}
 */
export function resolveTargetDbAndTargets(targets = []) {
  const isProdFlag = targets.some((t) => ['--prod', '--production', '-p'].includes(t.toLowerCase().trim()));
  const filteredTargets = targets.filter(
    (t) => !['--prod', '--production', '-p', '--dev'].includes(t.toLowerCase().trim())
  );

  let targetDbName = 'AetherImmersion_dev';
  if (isProdFlag || process.env.NODE_ENV === 'production') {
    targetDbName = 'AetherImmersion';
  }
  if (process.env.MONGODB_DB_NAME) {
    targetDbName = process.env.MONGODB_DB_NAME;
  }

  return { targetDbName, filteredTargets };
}

/**
 * 獨立同步設施與建築物資料 (seedBuildings.js -> buildings)
 * @returns {Promise<{ name: string, updated: number, inserted: number, total: number }>}
 */
export async function syncBuildings() {
  let updated = 0;
  let inserted = 0;
  for (const b of initialBuildings) {
    const res = await Building.updateOne(
      { buildingId: b.buildingId },
      { $set: b },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }
  const result = { name: 'Buildings', updated, inserted, total: initialBuildings.length };
  console.log(`[Sync] Buildings 同步完成：更新 ${updated} 筆，新增 ${inserted} 筆，總計 ${initialBuildings.length} 筆。`);
  return result;
}

/**
 * 獨立同步地點與場景資料 (seedLocations.js -> locations)
 * 注意：會安全保留資料庫既有地點中玩家所放置/丟棄的物品 (placedItems)。
 * @returns {Promise<{ name: string, updated: number, inserted: number, total: number, preservedPlacedItems: number }>}
 */
export async function syncLocations() {
  let updated = 0;
  let inserted = 0;
  let preservedPlacedItems = 0;
  for (const loc of initialLocations) {
    const existingLoc = await Location.findOne({ locationId: loc.locationId });
    const updateData = { ...loc };

    // 若資料庫既有此地點且已有地面放置/丟棄物品，予以保留防丟失
    if (existingLoc && Array.isArray(existingLoc.placedItems) && existingLoc.placedItems.length > 0) {
      updateData.placedItems = existingLoc.placedItems;
      preservedPlacedItems += existingLoc.placedItems.length;
    }

    const res = await Location.updateOne(
      { locationId: loc.locationId },
      { $set: updateData },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }
  const result = { name: 'Locations', updated, inserted, total: initialLocations.length, preservedPlacedItems };
  console.log(`[Sync] Locations 同步完成：更新 ${updated} 筆，新增 ${inserted} 筆，總計 ${initialLocations.length} 筆（保留既有地面放置物品 ${preservedPlacedItems} 件）。`);
  return result;
}

/**
 * 獨立同步道具定義資料 (seedItems.js -> items)
 * @returns {Promise<{ name: string, updated: number, inserted: number, total: number }>}
 */
export async function syncItems() {
  let updated = 0;
  let inserted = 0;
  for (const item of initialItems) {
    const res = await Item.updateOne(
      { itemId: item.itemId },
      { $set: item },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }
  const result = { name: 'Items', updated, inserted, total: initialItems.length };
  console.log(`[Sync] Items 同步完成：更新 ${updated} 筆，新增 ${inserted} 筆，總計 ${initialItems.length} 筆。`);
  return result;
}

/**
 * 獨立同步 NPC 與生物資料 (seedNpcs.js -> npcs)
 * @returns {Promise<{ name: string, updated: number, inserted: number, total: number }>}
 */
export async function syncNpcs() {
  let updated = 0;
  let inserted = 0;
  for (const npc of initialNpcs) {
    const res = await Npc.updateOne(
      { npcId: npc.npcId },
      { $set: npc },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }
  const result = { name: 'Npcs', updated, inserted, total: initialNpcs.length };
  console.log(`[Sync] Npcs 同步完成：更新 ${updated} 筆，新增 ${inserted} 筆，總計 ${initialNpcs.length} 筆。`);
  return result;
}

/**
 * 獨立同步合成製作配方資料 (seedRecipes.js -> recipes)
 * @returns {Promise<{ name: string, updated: number, inserted: number, total: number }>}
 */
export async function syncRecipes() {
  let updated = 0;
  let inserted = 0;
  for (const recipe of initialRecipes) {
    const res = await Recipe.updateOne(
      { recipeId: recipe.recipeId },
      { $set: recipe },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }
  const result = { name: 'Recipes', updated, inserted, total: initialRecipes.length };
  console.log(`[Sync] Recipes 同步完成：更新 ${updated} 筆，新增 ${inserted} 筆，總計 ${initialRecipes.length} 筆。`);
  return result;
}

/**
 * 獨立同步戰鬥技能資料 (seedBattleSkills.js -> battleskills)
 * @returns {Promise<{ name: string, updated: number, inserted: number, total: number }>}
 */
export async function syncBattleSkills() {
  let updated = 0;
  let inserted = 0;
  for (const skill of initialBattleSkills) {
    const res = await BattleSkill.updateOne(
      { skillId: skill.skillId },
      { $set: skill },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }
  const result = { name: 'BattleSkills', updated, inserted, total: initialBattleSkills.length };
  console.log(`[Sync] BattleSkills 同步完成：更新 ${updated} 筆，新增 ${inserted} 筆，總計 ${initialBattleSkills.length} 筆。`);
  return result;
}

/**
 * 獨立同步任務資料 (seedQuests.js -> quests)
 * @returns {Promise<{ name: string, updated: number, inserted: number, total: number }>}
 */
export async function syncQuests() {
  let updated = 0;
  let inserted = 0;
  for (const quest of initialQuests) {
    const res = await Quest.updateOne(
      { questId: quest.questId },
      { $set: quest },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }
  const result = { name: 'Quests', updated, inserted, total: initialQuests.length };
  console.log(`[Sync] Quests 同步完成：更新 ${updated} 筆，新增 ${inserted} 筆，總計 ${initialQuests.length} 筆。`);
  return result;
}

/**
 * 支援的同步模組映射表
 */
export const SYNC_REGISTRY = {
  buildings: syncBuildings,
  building: syncBuildings,
  locations: syncLocations,
  location: syncLocations,
  items: syncItems,
  item: syncItems,
  npcs: syncNpcs,
  npc: syncNpcs,
  recipes: syncRecipes,
  recipe: syncRecipes,
  battleskills: syncBattleSkills,
  skills: syncBattleSkills,
  skill: syncBattleSkills,
  quests: syncQuests,
  quest: syncQuests,
};

/**
 * 執行種子資料同步主進入點
 * @param {string[]} [targets=[]] - 要同步的模組名稱清單，若為空或包含 'all' 則同步核心預設項目；支援 '--prod' 切換至正式庫
 */
export async function syncSeeds(targets = []) {
  const { targetDbName, filteredTargets } = resolveTargetDbAndTargets(targets);
  const mongoURI = process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${targetDbName}`;

  console.log(`[Sync] 準備連線至 MongoDB 資料庫: [${targetDbName}]...`);
  try {
    await mongoose.connect(mongoURI, {
      dbName: targetDbName,
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[Sync] 資料庫 [${targetDbName}] 連線成功！`);

    const cleanTargets = filteredTargets
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);

    let handlersToRun = [];

    if (cleanTargets.length === 0 || cleanTargets.includes('all')) {
      // 預設核心同步集合
      handlersToRun = [
        syncBuildings,
        syncLocations,
        syncItems,
        syncNpcs,
        syncRecipes,
      ];
      console.log('[Sync] 未指定特定模組，將依序同步全部主要集合 (buildings, locations, items, npcs, recipes)...');
    } else {
      for (const target of cleanTargets) {
        const handler = SYNC_REGISTRY[target];
        if (handler && !handlersToRun.includes(handler)) {
          handlersToRun.push(handler);
        } else if (!handler) {
          console.warn(`[Sync Warning] 未知的模組名稱: "${target}"，可選名稱: ${Object.keys(SYNC_REGISTRY).join(', ')}`);
        }
      }
    }

    if (handlersToRun.length === 0) {
      console.log('[Sync] 沒有匹配的模組可供執行。');
      return;
    }

    console.log(`[Sync] 開始執行 ${handlersToRun.length} 個指定模組的更新作業...`);
    for (const handler of handlersToRun) {
      await handler();
    }

    console.log('[Sync] 指定種子資料已順利更新至資料庫！');
  } catch (err) {
    console.error('[Sync Error] 同步作業失敗：', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[Sync] 資料庫連線已關閉。');
  }
}

// 若直接由 Node CLI 執行此腳本
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('syncSeedsToDb.js') ||
  process.argv[1].endsWith('syncSeedsToDb')
);

if (isDirectExecution) {
  const args = process.argv.slice(2);
  syncSeeds(args);
}
