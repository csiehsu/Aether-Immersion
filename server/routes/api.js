import express from 'express';
import mongoose from 'mongoose';
import { Player } from '../models/Player.js';
import { GameLog } from '../models/GameLog.js';
import { Item } from '../models/Item.js';
import { Location } from '../models/Location.js';
import { Recipe } from '../models/Recipe.js';
import { Npc } from '../models/Npc.js';
import { Building } from '../models/Building.js';
import { BattleSkill } from '../models/BattleSkill.js';
import { Quest } from '../models/Quest.js';
import { initialItems } from '../seeds/seedItems.js';
import { initialLocations } from '../seeds/seedLocations.js';
import { initialRecipes } from '../seeds/seedRecipes.js';
import { initialNpcs } from '../seeds/seedNpcs.js';
import { initialBuildings } from '../seeds/seedBuildings.js';
import { initialBattleSkills } from '../seeds/seedBattleSkills.js';
import { initialQuests } from '../seeds/seedQuests.js';
import { isDbConnected, fetchCollectionData, generateInstanceId } from '../utils/dbHelper.js';
import {
  settleEnergyRecovery,
  applyEnergyConsumption,
  isPlayerComatose,
  calculateEffectiveEnergyCost,
  getStatusEffects,
} from '../utils/energyHelper.js';
import {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  MAX_ENERGY,
  TOTAL_CREATION_STATS,
  DEFAULT_INITIAL_STATS,
} from '../../shared/constants/gameConstants.js';
import {
  addLifeSkillExp,
  roundExp,
  calculateSkillLevel,
  calculateSuccessRate,
  addItemToPlacedItems,
  addItemsToInventory,
  isPlayerOverburdened,
  compareItemDurability,
  settleItemDecay,
  calculateMaxExecutableByTools,
  applyToolsDurabilityDeduction,
  calculateLiquidContainerCapacity,
  fillLiquidContainers,
  checkRecipeUnlocks,
} from '../../shared/utils/gameHelpers.js';

const router = express.Router();

// GET /api/health
router.get('/health', (req, res) => {
  const connected = isDbConnected();
  if (!connected) {
    return res.status(503).json({
      status: 'error',
      mongodb: 'offline',
      message: '資料庫未連線！',
      timestamp: new Date().toISOString(),
    });
  }
  res.json({
    status: 'ok',
    mongodb: 'connected',
    dbName: mongoose.connection.name,
    timestamp: new Date().toISOString(),
  });
});

// Unified Collection Routes (Deduplicated GET endpoints)
const collectionRoutes = [
  { path: '/items', model: Item, initialData: initialItems },
  { path: '/locations', model: Location, initialData: initialLocations },
  { path: '/recipes', model: Recipe, initialData: initialRecipes },
  { path: '/npcs', model: Npc, initialData: initialNpcs },
  { path: '/buildings', model: Building, initialData: initialBuildings },
  { path: '/battle-skills', model: BattleSkill, initialData: initialBattleSkills },
  { path: '/quests', model: Quest, initialData: initialQuests },
];

collectionRoutes.forEach(({ path, model, initialData }) => {
  router.get(path, async (req, res) => {
    try {
      const result = await fetchCollectionData(model, initialData);
      if (path === '/locations' && Array.isArray(result.data)) {
        let allDbItems = await Item.find();
        if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
        for (const loc of result.data) {
          if (loc.placedItems && loc.placedItems.length > 0) {
            await settleLocationPlacedItemsDecay(loc, allDbItems);
          }
        }
      }
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(`[API Error] GET ${path}:`, err);
      res.status(503).json({ success: false, error: err.message });
    }
  });
});

/**
 * 依據請求 Header (x-player-id)、Query 或 Body 取得對應玩家實體，未指定時安全 Fallback。
 * @param {express.Request} req - Express Request 物件。
 * @returns {Promise<Object|null>} 玩家 Mongoose 文件物件。
 */
const getPlayerFromReq = async (req) => {
  const pId = req.headers?.['x-player-id'] || req.query?.playerId || req.body?.playerId;
  if (pId && mongoose.isValidObjectId(pId)) {
    const player = await Player.findById(pId);
    if (player) return player;
  }
  return await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
};

/**
 * 結算玩家背包道具腐敗狀態，若有道具扣至 <= 0 則自動刪除並記錄系統提示訊息。
 * @param {Object} player - 玩家 Mongoose 文件物件。
 * @param {Array<Object>} allDbItems - 物品基礎定義清單。
 * @returns {Promise<boolean>} 若玩家背包有變更回傳 true，否則回傳 false。
 */
const settlePlayerInventoryDecay = async (player, allDbItems) => {
  if (!player || !player.inventory || player.inventory.length === 0) return false;
  const { updatedItems, rottedItems, isChanged } = settleItemDecay(
    player.inventory,
    allDbItems,
    { isPlayer: true }
  );

  if (isChanged) {
    player.inventory = updatedItems;
    player.markModified('inventory');
  }

  if (rottedItems && rottedItems.length > 0) {
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const targetPlayerId = player._id ? player._id.toString() : (player.googleId || player.name || '');
    for (const rotted of rottedItems) {
      await GameLog.create({
        time: timeStr,
        sender: '系統',
        senderEn: 'System',
        text: `${rotted.name}已腐敗。`,
        textEn: `${rotted.nameEn} has rotted.`,
        type: 'system',
        locationId: '',
        targetPlayerId,
      });
    }
  }

  return isChanged;
};

/**
 * 結算指定場景中地面放置道具的腐敗狀態，扣至 <= 0 自動刪除，不發送提示訊息。
 * @param {Object} location - 地點 Mongoose 文件物件。
 * @param {Array<Object>} allDbItems - 物品基礎定義清單。
 * @returns {Promise<boolean>} 若地面放置道具清單有變更回傳 true，否則回傳 false。
 */
const settleLocationPlacedItemsDecay = async (location, allDbItems) => {
  if (!location || !location.placedItems || location.placedItems.length === 0) return false;
  const { updatedItems, isChanged } = settleItemDecay(
    location.placedItems,
    allDbItems,
    { isPlayer: false }
  );

  if (isChanged) {
    location.placedItems = updatedItems;
    location.markModified('placedItems');
    await location.save();
  }

  return isChanged;
};

/**
 * 清理並標準化玩家背包道具結構，確保具備 instanceId、itemId、count 等必填欄位。
 * @param {Array<Object>} inventory - 原始道具陣列。
 * @returns {Array<Object>} 標準化後的道具陣列。
 */
const sanitizeInventoryItems = (inventory) => {
  if (!Array.isArray(inventory)) return [];
  const clean = [];
  for (const item of inventory) {
    const raw = item && item.toObject ? item.toObject() : item;
    if (!raw) continue;
    const itemId = raw.itemId || raw.id || '';
    if (!itemId) continue;
    const instanceId = raw.instanceId || generateInstanceId();
    clean.push({
      instanceId,
      itemId,
      count: raw.count || 1,
      durability: raw.durability !== undefined ? raw.durability : -1,
      maxDurability: raw.maxDurability !== undefined ? raw.maxDurability : (raw.durability !== undefined ? raw.durability : -1),
      quality: raw.quality || '普通',
      customName: raw.customName || '',
      customNameEn: raw.customNameEn || '',
      bonusNutrition: raw.bonusNutrition ? { ...raw.bonusNutrition } : undefined,
      contents: raw.contents ? {
        itemId: raw.contents.itemId || '',
        amount: Number(raw.contents.amount) || 0,
      } : undefined,
      lastDecayedAt: raw.lastDecayedAt ? new Date(raw.lastDecayedAt) : new Date(),
    });
  }
  return clean;
};

/**
 * 清理並標準化已解鎖配方清單，過濾空值並去除重複的配方 ID。
 * @param {Array<string|Object>|string|Object} raw - 原始配方陣列或單一配方物件/ID。
 * @returns {Array<{ recipeId: string }>} 去除重複後的配方物件陣列。
 */
const sanitizeUnlockedRecipes = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const sanitized = [];
  for (const item of list) {
    if (!item) continue;
    let rId = '';
    if (typeof item === 'string') {
      rId = item.trim();
    } else if (typeof item === 'object') {
      rId = (item.recipeId || item.id || '').toString().trim();
    }
    if (rId && !sanitized.some((r) => r.recipeId === rId)) {
      sanitized.push({ recipeId: rId });
    }
  }
  return sanitized;
};

/**
 * 統一發放道具、解鎖地點與解鎖配方至玩家資料。
 * @param {Object} player - 玩家 Mongoose 文件物件。
 * @param {Object} [grants={}] - 發放獎勵內容物件。
 * @param {Array<{ itemId: string, count?: number, quality?: string }>} [grants.items] - 要發放的道具陣列。
 * @param {Array<string>} [grants.unlockedLocations] - 要解鎖的地點 ID 陣列。
 * @param {Array<string|{ recipeId: string }>} [grants.unlockedRecipes] - 要解鎖的配方陣列。
 * @returns {void}
 */
const applyPlayerGrants = (player, grants = {}) => {
  if (!player || !grants) return;
  if (grants.items && grants.items.length > 0) {
    player.inventory = sanitizeInventoryItems(player.inventory);
    for (const gItem of grants.items) {
      const dbItem = initialItems.find((i) => i.itemId === gItem.itemId);
      const dur = gItem.durability !== undefined
        ? gItem.durability
        : (dbItem?.durability !== undefined && dbItem.durability > 0 ? dbItem.durability : -1);
      player.inventory = addItemsToInventory(
        player.inventory,
        gItem.itemId,
        gItem.count || 1,
        {
          durability: dur,
          maxDurability: dur,
          quality: gItem.quality || '普通',
        }
      );
    }
  }
  if (grants.unlockedLocations && grants.unlockedLocations.length > 0) {
    for (const locId of grants.unlockedLocations) {
      if (!player.knownLocations.includes(locId)) {
        player.knownLocations.push(locId);
      }
    }
  }
  if (grants.unlockedRecipes && grants.unlockedRecipes.length > 0) {
    const toAdd = sanitizeUnlockedRecipes(grants.unlockedRecipes);
    player.unlockedRecipes = sanitizeUnlockedRecipes(player.unlockedRecipes);
    for (const item of toAdd) {
      if (!player.unlockedRecipes.some((r) => r.recipeId === item.recipeId)) {
        player.unlockedRecipes.push(item);
      }
    }
  }
};

/**
 * 將指定場景中的地面放置道具 (Placed Item) 拾取並轉移至玩家背包中。
 * @param {Object} location - 地點 Mongoose 文件物件。
 * @param {string} instanceId - 放置道具的唯一實體識別碼。
 * @param {Object} player - 玩家 Mongoose 文件物件。
 * @returns {Object|null} 拾取成功回傳該放置道具資料，找不到則回傳 null。
 */
const transferPlacedItemToPlayer = (location, instanceId, player) => {
  if (!location || !instanceId || !player) return null;
  const placedIndex = location.placedItems.findIndex((p) => p.instanceId === instanceId);
  if (placedIndex < 0) return null;

  const itemToPick = location.placedItems[placedIndex];
  location.placedItems.splice(placedIndex, 1);

  player.inventory = sanitizeInventoryItems(player.inventory);
  player.inventory = addItemsToInventory(
    player.inventory,
    itemToPick.itemId,
    itemToPick.count || 1,
    {
      instanceId: itemToPick.instanceId,
      durability: itemToPick.durability,
      maxDurability: itemToPick.maxDurability,
      quality: itemToPick.quality || '普通',
      customName: itemToPick.customName || '',
      customNameEn: itemToPick.customNameEn || '',
      bonusNutrition: itemToPick.bonusNutrition,
      lastDecayedAt: itemToPick.lastDecayedAt || new Date(),
    }
  );
  return itemToPick;
};

/**
 * 格式化回傳至前端的玩家資料結構，補齊能力值欄位（包含 water、food）與技能預設值。
 * @param {Object} playerDoc - 玩家 Mongoose 文件或純資料物件。
 * @returns {Object} 格式化後的純玩家資料物件。
 */
const formatPlayerResponse = (playerDoc) => {
  const p = playerDoc.toObject ? playerDoc.toObject() : { ...playerDoc };
  const rawStats = p.stats || {};
  const dexVal = rawStats.dexterity ?? p.dex ?? 1;
  p.stats = {
    strength: rawStats.strength ?? p.str ?? 1,
    speed: rawStats.speed ?? p.spd ?? 1,
    dexterity: dexVal,
    maxHp: rawStats.maxHp ?? p.maxHp ?? MAX_HP,
    defense: rawStats.defense ?? 0,
    water: rawStats.water ?? MAX_WATER,
    food: rawStats.food ?? MAX_FOOD,
  };
  p.str = p.stats.strength;
  p.spd = p.stats.speed;
  p.dex = dexVal;
  p.skills = Array.isArray(p.skills) && p.skills.length > 0
    ? p.skills
    : [{ skillId: 'NORMAL_ATTACK', level: 0 }];
  p.lifeSkills = {
    GATHERING: {
      level: calculateSkillLevel(p.lifeSkills?.GATHERING?.exp || 0),
      exp: roundExp(p.lifeSkills?.GATHERING?.exp || 0),
    },
    FISHING: {
      level: calculateSkillLevel(p.lifeSkills?.FISHING?.exp || 0),
      exp: roundExp(p.lifeSkills?.FISHING?.exp || 0),
    },
    MINING: {
      level: calculateSkillLevel(p.lifeSkills?.MINING?.exp || 0),
      exp: roundExp(p.lifeSkills?.MINING?.exp || 0),
    },
    COOKING: {
      level: calculateSkillLevel(p.lifeSkills?.COOKING?.exp || 0),
      exp: roundExp(p.lifeSkills?.COOKING?.exp || 0),
    },
  };
  p.money = p.money ?? 0;
  p.mentor = p.mentor || '';
  p.unlockedRecipes = sanitizeUnlockedRecipes(p.unlockedRecipes);
  p.lastEnergyRecoveredAt = p.lastEnergyRecoveredAt
    ? new Date(p.lastEnergyRecoveredAt).toISOString()
    : new Date().toISOString();
  p.energySpentAccumulator = Number(p.energySpentAccumulator) || 0;
  p.hpRegenAccumulator = Number(p.hpRegenAccumulator) || 0;
  p.statusEffects = getStatusEffects(p);
  return p;
};


// GET /api/player
router.get('/player', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法載入玩家資料！' });
    }

    let player = await getPlayerFromReq(req);
    if (!player) {
      const defaultName = '冒險者';
      const defaultMentor = '';

      player = await Player.create({
        name: defaultName,
        mentor: defaultMentor,
        isCharacterCreated: false,
        stats: { ...DEFAULT_INITIAL_STATS },
        skills: [{ skillId: 'NORMAL_ATTACK', level: 0 }],
        lifeSkills: {
          GATHERING: { level: 0, exp: 0 },
          FISHING: { level: 0, exp: 0 },
          MINING: { level: 0, exp: 0 },
          COOKING: { level: 0, exp: 0 },
        },
        level: 1,
        hp: MAX_HP,
        money: 0,
        energy: MAX_ENERGY,
        maxEnergy: MAX_ENERGY,
        lastEnergyRecoveredAt: new Date(),
        location: 'AZURE_BAY_MARKET',
        knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET', 'AZURE_BAY_GATE', 'ROCKY_PLAIN', 'AZURE_BAY_VARIETY_SHOP', 'ROCK_WALL'],
      });
      console.log('[MongoDB] Created initial player record in MongoDB.');
    } else {
      const energyUpdated = settleEnergyRecovery(player);
      let allDbItems = await Item.find();
      if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
      const decayUpdated = await settlePlayerInventoryDecay(player, allDbItems);
      let updated = energyUpdated || decayUpdated;

      if (!player.lifeSkills) {
        player.lifeSkills = {
          GATHERING: { level: 0, exp: 0 },
          FISHING: { level: 0, exp: 0 },
          MINING: { level: 0, exp: 0 },
          COOKING: { level: 0, exp: 0 },
        };
        player.markModified('lifeSkills');
        updated = true;
      } else {
        ['GATHERING', 'FISHING', 'MINING', 'COOKING'].forEach((key) => {
          if (!player.lifeSkills[key]) {
            player.lifeSkills[key] = { level: 0, exp: 0 };
            player.markModified('lifeSkills');
            updated = true;
          } else {
            const currentExp = roundExp(player.lifeSkills[key].exp || 0);
            const correctLevel = calculateSkillLevel(currentExp);
            if (player.lifeSkills[key].level !== correctLevel || player.lifeSkills[key].exp !== currentExp) {
              player.lifeSkills[key].level = correctLevel;
              player.lifeSkills[key].exp = currentExp;
              player.markModified('lifeSkills');
              updated = true;
            }
          }
        });
      }

      if (updated) {
        player.markModified('knownLocations');
        await player.save();
      }
    }
    return res.json({ success: true, source: 'mongodb', data: formatPlayerResponse(player) });
  } catch (err) {
    console.error('[API Error] GET /api/player:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/create-character
router.post('/player/create-character', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法建立角色！' });
    }

    const { name, strength, speed, dexterity, str, spd, dex, stats } = req.body;
    const trimmedName = (name || '').trim();

    const nStr = Number(stats?.strength ?? strength ?? str);
    const nSpd = Number(stats?.speed ?? speed ?? spd);
    const nDex = Number(stats?.dexterity ?? dexterity ?? dex);

    if (!trimmedName) {
      return res.status(400).json({ success: false, message: '請輸入角色名稱！' });
    }

    if (isNaN(nStr) || isNaN(nSpd) || isNaN(nDex)) {
      return res.status(400).json({ success: false, message: '能力值必須為有效數字！' });
    }

    if (nStr < 1 || nSpd < 1 || nDex < 1) {
      return res.status(400).json({ success: false, message: '每項能力值最低必須為 1！' });
    }

    if (nStr + nSpd + nDex !== TOTAL_CREATION_STATS) {
      return res.status(400).json({ success: false, message: `三項能力值總和必須精確等於 ${TOTAL_CREATION_STATS}！` });
    }

    const maxHp = MAX_HP;
    const maxEnergy = MAX_ENERGY;

    const initialInventory = [];
    for (let i = 0; i < 10; i++) {
      initialInventory.push({
        instanceId: generateInstanceId(),
        itemId: 'item002',
        count: 1,
        durability: 1440,
        maxDurability: 1440,
        quality: '普通',
        lastDecayedAt: new Date(),
      });
    }
    initialInventory.push({
      instanceId: generateInstanceId(),
      itemId: 'item032',
      count: 1,
      durability: -1,
      maxDurability: -1,
      quality: '普通',
      contents: {
        itemId: 'item018',
        amount: 10,
      },
      lastDecayedAt: new Date(),
    });

    const defaultKnownLocations = [
      'AZURE_BAY_PORT',
      'AZURE_BAY_MARKET',
      'AZURE_BAY_GATE',
      'ROCKY_PLAIN',
      'AZURE_BAY_VARIETY_SHOP',
      'ROCK_WALL',
    ];

    const characterData = {
      name: trimmedName,
      mentor: '',
      stats: {
        strength: nStr,
        speed: nSpd,
        dexterity: nDex,
        maxHp,
        defense: 0,
        water: MAX_WATER,
        food: MAX_FOOD,
      },
      skills: [{ skillId: 'NORMAL_ATTACK', level: 0 }],
      lifeSkills: {
        GATHERING: { level: 0, exp: 0 },
        FISHING: { level: 0, exp: 0 },
        MINING: { level: 0, exp: 0 },
        COOKING: { level: 0, exp: 0 },
      },
      level: 1,
      isCharacterCreated: true,
      hp: maxHp,
      money: 0,
      energy: maxEnergy,
      maxEnergy,
      lastEnergyRecoveredAt: new Date(),
      energySpentAccumulator: 0,
      location: 'AZURE_BAY_MARKET',
      knownLocations: defaultKnownLocations,
      inventory: initialInventory,
    };

    let player = await getPlayerFromReq(req);
    if (player) {
      player.name = characterData.name;
      player.mentor = characterData.mentor;
      player.stats = characterData.stats;
      player.skills = characterData.skills;
      player.lifeSkills = characterData.lifeSkills;
      player.level = characterData.level;
      player.isCharacterCreated = characterData.isCharacterCreated;
      player.hp = characterData.hp;
      player.money = characterData.money;
      player.energy = characterData.energy;
      player.maxEnergy = characterData.maxEnergy;
      player.lastEnergyRecoveredAt = characterData.lastEnergyRecoveredAt;
      player.energySpentAccumulator = 0;
      player.location = characterData.location;
      player.knownLocations = characterData.knownLocations;
      player.inventory = characterData.inventory;
      player.markModified('knownLocations');
      player.markModified('inventory');
      await player.save();
    } else {
      player = await Player.create(characterData);
    }
    return res.json({ success: true, source: 'mongodb', data: formatPlayerResponse(player) });
  } catch (err) {
    console.error('[API Error] POST /api/player/create-character:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/player
router.put('/player', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法更新玩家資料！' });
    }
    const updateData = req.body;
    if (updateData.inventory) {
      updateData.inventory = sanitizeInventoryItems(updateData.inventory);
    }
    if (updateData.unlockedRecipes) {
      updateData.unlockedRecipes = sanitizeUnlockedRecipes(updateData.unlockedRecipes);
    }
    let player = await getPlayerFromReq(req);
    if (player) {
      settleEnergyRecovery(player);

      if (typeof updateData.energy === 'number') {
        const roundedEnergy = Math.round(updateData.energy * 10) / 10;
        const maxEnergy = player.maxEnergy ?? MAX_ENERGY;
        const wasFull = (player.energy ?? 0) >= maxEnergy;
        if (wasFull && roundedEnergy < maxEnergy && !updateData.lastEnergyRecoveredAt) {
          player.lastEnergyRecoveredAt = new Date();
        }
        updateData.energy = roundedEnergy;
      }
      if (updateData.lastEnergyRecoveredAt) {
        player.lastEnergyRecoveredAt = new Date(updateData.lastEnergyRecoveredAt);
        delete updateData.lastEnergyRecoveredAt;
      }
      if (updateData.stats) {
        if (typeof updateData.stats.water === 'number') {
          updateData.stats.water = Math.max(0, Math.min(MAX_WATER, updateData.stats.water));
        }
        if (typeof updateData.stats.food === 'number') {
          updateData.stats.food = Math.max(0, Math.min(MAX_FOOD, updateData.stats.food));
        }
        player.stats = {
          ...player.stats?.toObject(),
          ...updateData.stats,
        };
        player.markModified('stats');
        delete updateData.stats;
      }
      if (updateData.lifeSkills) {
        const merged = {
          ...player.lifeSkills?.toObject(),
          ...updateData.lifeSkills,
        };
        ['GATHERING', 'FISHING', 'MINING', 'COOKING'].forEach((k) => {
          if (merged[k]) {
            merged[k].exp = roundExp(merged[k].exp || 0);
            merged[k].level = calculateSkillLevel(merged[k].exp);
          }
        });
        player.lifeSkills = merged;
        player.markModified('lifeSkills');
        delete updateData.lifeSkills;
      }
      Object.assign(player, updateData);
      if (updateData.quests) {
        player.markModified('quests');
      }
      if (updateData.inventory) {
        player.markModified('inventory');
      }
      if (updateData.unlockedRecipes) {
        player.markModified('unlockedRecipes');
      }
      await player.save();
    }
    return res.json({ success: true, source: 'mongodb', data: formatPlayerResponse(player) });
  } catch (err) {
    console.error('[API Error] PUT /api/player:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/heartbeat
router.post('/player/heartbeat', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    const energyUpdated = settleEnergyRecovery(player);
    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
    const decayUpdated = await settlePlayerInventoryDecay(player, allDbItems);

    if (energyUpdated || decayUpdated) {
      player.markModified('inventory');
      await player.save();
    }

    return res.json({
      success: true,
      data: formatPlayerResponse(player),
      energyUpdated,
      decayUpdated,
    });
  } catch (err) {
    console.error('[API Error] POST /api/player/heartbeat:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/buy
router.post('/player/buy', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { npcId, itemId, qty = 1 } = req.body;
    const buyQty = Math.max(1, Number(qty) || 1);

    const player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    settleEnergyRecovery(player);
    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
    await settlePlayerInventoryDecay(player, allDbItems);

    let npc = await Npc.findOne({ npcId });
    if (!npc) {
      npc = initialNpcs.find((n) => n.npcId === npcId);
    }
    if (!npc) {
      return res.status(404).json({ success: false, message: '找不到指定的 NPC！' });
    }

    const goodie = (npc.goodies || []).find((g) => g.itemId === itemId);
    if (!goodie) {
      return res.status(400).json({ success: false, message: '該商人未販售此道具！' });
    }

    const unitPrice = Math.max(0, Number(goodie.price) || 0);
    const totalCost = unitPrice * buyQty;
    const currentMoney = player.money ?? 0;
    if (currentMoney < totalCost) {
      return res.status(400).json({ success: false, message: '金錢不足！' });
    }

    const boughtDbItem = allDbItems.find((i) => i.itemId === itemId);
    const boughtItemTypes = boughtDbItem && boughtDbItem.type
      ? (Array.isArray(boughtDbItem.type) ? boughtDbItem.type : [boughtDbItem.type])
      : [];

    const itemDur = (boughtDbItem?.durability !== undefined && boughtDbItem.durability > 0)
      ? boughtDbItem.durability
      : -1;
    const isContainer = boughtItemTypes.includes('CONTAINER') || (boughtDbItem?.capacity > 0);

    player.money = currentMoney - totalCost;
    player.inventory = sanitizeInventoryItems(player.inventory);
    player.inventory = addItemsToInventory(
      player.inventory,
      itemId,
      buyQty,
      {
        durability: itemDur,
        maxDurability: itemDur,
        ...(isContainer ? { isContainer: true, contents: { itemId: '', amount: 0 } } : {}),
      },
      allDbItems
    );
    player.markModified('inventory');

    let allDbRecipes = await Recipe.find();
    if (!allDbRecipes || allDbRecipes.length === 0) allDbRecipes = initialRecipes;
    const { newlyUnlockedRecipes, updatedUnlocked } = checkRecipeUnlocks(
      player.unlockedRecipes || [],
      allDbRecipes,
      itemId
    );

    if (newlyUnlockedRecipes.length > 0) {
      player.unlockedRecipes = updatedUnlocked;
      player.markModified('unlockedRecipes');
    }

    await player.save();
    return res.json({
      success: true,
      data: formatPlayerResponse(player),
      newlyUnlockedRecipes,
    });
  } catch (err) {
    console.error('[API Error] POST /api/player/buy:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/sell
router.post('/player/sell', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { npcId, itemId, qty = 1, price } = req.body;
    const sellQty = Math.max(1, Number(qty) || 1);

    const player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    settleEnergyRecovery(player);
    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
    await settlePlayerInventoryDecay(player, allDbItems);

    player.inventory = sanitizeInventoryItems(player.inventory);
    const existingIdx = player.inventory.findIndex((i) => i.itemId === itemId);
    if (existingIdx < 0) {
      return res.status(400).json({ success: false, message: '背包中無此道具！' });
    }

    const currentOwned = player.inventory[existingIdx].count || 1;
    if (currentOwned < sellQty) {
      return res.status(400).json({ success: false, message: '持有道具數量不足！' });
    }

    let unitPrice = 0;
    let npc = await Npc.findOne({ npcId });
    if (!npc) npc = initialNpcs.find((n) => n.npcId === npcId);
    if (npc) {
      const pEntry = (npc.purchase || []).find((p) => p.itemId === itemId);
      if (pEntry) {
        unitPrice = Math.max(0, Number(pEntry.price) || 0);
      }
    }
    if (unitPrice === 0 && price !== undefined) {
      unitPrice = Math.max(0, Number(price) || 0);
    }

    const totalGain = unitPrice * sellQty;
    player.money = (player.money ?? 0) + totalGain;

    if (currentOwned <= sellQty) {
      player.inventory.splice(existingIdx, 1);
    } else {
      player.inventory[existingIdx].count = currentOwned - sellQty;
    }
    player.markModified('inventory');

    await player.save();
    return res.json({
      success: true,
      data: formatPlayerResponse(player),
    });
  } catch (err) {
    console.error('[API Error] POST /api/player/sell:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/consume
router.post('/player/consume', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { instanceId, itemId, qty = 1 } = req.body;
    const targetQty = Math.max(1, Number(qty) || 1);

    const player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    settleEnergyRecovery(player);
    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
    await settlePlayerInventoryDecay(player, allDbItems);

    player.inventory = sanitizeInventoryItems(player.inventory);

    const invIndex = player.inventory.findIndex(
      (i) => (instanceId && i.instanceId === instanceId) || i.itemId === itemId
    );
    if (invIndex < 0) {
      return res.status(400).json({ success: false, message: '背包中找不到該物品！' });
    }

    const invItem = player.inventory[invIndex];
    const targetItemId = invItem.itemId;
    const dbItem = allDbItems.find((d) => d.itemId === targetItemId);

    const itemTypes = dbItem?.type
      ? (Array.isArray(dbItem.type) ? dbItem.type : [dbItem.type])
      : [];
    const isContainer = itemTypes.includes('CONTAINER') || (dbItem?.capacity > 0);

    let hpGain = 0;
    let strGain = 0;
    let spdGain = 0;
    let dexGain = 0;
    let defGain = 0;
    let maxHpGain = 0;
    let waterGain = 0;
    let foodGain = 0;
    let logActionText = '';
    let logActionTextEn = '';

    if (isContainer) {
      const storedLiquidId = invItem.contents?.itemId || '';
      const storedAmount = Number(invItem.contents?.amount) || 0;
      if (!storedLiquidId || storedAmount <= 0) {
        return res.status(400).json({ success: false, message: '容器內沒有液體可供飲用！' });
      }

      const deductDrink = Math.min(storedAmount, targetQty);
      const dbLiquidItem = allDbItems.find((i) => i.itemId === storedLiquidId);
      const nutrition = dbLiquidItem?.nutrition || {};
      const bonus = invItem.bonusNutrition || {};

      hpGain += ((nutrition.hp || 0) + (bonus.hp || 0)) * deductDrink;
      strGain += ((nutrition.strength || 0) + (bonus.strength || 0)) * deductDrink;
      spdGain += ((nutrition.speed || 0) + (bonus.speed || 0)) * deductDrink;
      dexGain += ((nutrition.dexterity || 0) + (bonus.dexterity || 0)) * deductDrink;
      defGain += ((nutrition.defense || 0) + (bonus.defense || 0)) * deductDrink;
      maxHpGain += ((nutrition.maxHp || 0) + (bonus.maxHp || 0)) * deductDrink;
      waterGain += ((nutrition.water || 0) + (bonus.water || 0)) * deductDrink;
      foodGain += ((nutrition.food || 0) + (bonus.food || 0)) * deductDrink;

      const newStoredAmount = storedAmount - deductDrink;
      invItem.contents = {
        itemId: newStoredAmount > 0 ? storedLiquidId : '',
        amount: newStoredAmount,
      };

      const liquidName = dbLiquidItem?.name || storedLiquidId;
      const liquidNameEn = dbLiquidItem?.nameEn || dbLiquidItem?.name || storedLiquidId;
      const containerName = invItem.customName || dbItem?.name || invItem.itemId;
      const containerNameEn = invItem.customNameEn || dbItem?.nameEn || dbItem?.name || invItem.itemId;
      logActionText = `飲用了 [${containerName}] 中的 [${liquidName}] x${deductDrink}`;
      logActionTextEn = `Drank [${liquidNameEn}] x${deductDrink} from [${containerNameEn}]`;
    } else {
      const matching = player.inventory
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.itemId === targetItemId)
        .sort((a, b) => compareItemDurability(a.item, b.item, 'asc'));

      let remaining = targetQty;
      let totalUsed = 0;
      const toRemove = [];

      for (const { item, idx } of matching) {
        if (remaining <= 0) break;
        const curCount = item.count || 1;
        const deduct = Math.min(curCount, remaining);

        const nutrition = dbItem?.nutrition || {};
        const bonus = item.bonusNutrition || {};
        hpGain += ((nutrition.hp || 0) + (bonus.hp || 0)) * deduct;
        strGain += ((nutrition.strength || 0) + (bonus.strength || 0)) * deduct;
        spdGain += ((nutrition.speed || 0) + (bonus.speed || 0)) * deduct;
        dexGain += ((nutrition.dexterity || 0) + (bonus.dexterity || 0)) * deduct;
        defGain += ((nutrition.defense || 0) + (bonus.defense || 0)) * deduct;
        maxHpGain += ((nutrition.maxHp || 0) + (bonus.maxHp || 0)) * deduct;
        waterGain += ((nutrition.water || 0) + (bonus.water || 0)) * deduct;
        foodGain += ((nutrition.food || 0) + (bonus.food || 0)) * deduct;

        totalUsed += deduct;
        remaining -= deduct;

        if (curCount <= deduct) {
          toRemove.push(idx);
        } else {
          item.count = curCount - deduct;
        }
      }

      player.inventory = player.inventory.filter((_, idx) => !toRemove.includes(idx));

      const itemName = invItem.customName || dbItem?.name || invItem.itemId;
      const itemNameEn = invItem.customNameEn || dbItem?.nameEn || dbItem?.name || invItem.itemId;
      logActionText = `使用了 [${itemName}] x${totalUsed}`;
      logActionTextEn = `Used [${itemNameEn}] x${totalUsed}`;
    }

    const currentStats = player.stats || {};
    const currentWater = currentStats.water ?? MAX_WATER;
    const currentFood = currentStats.food ?? MAX_FOOD;
    const wouldExceedFood = foodGain > 0 && Math.round((currentFood + foodGain) * 100) / 100 > MAX_FOOD;
    const wouldExceedWater = waterGain > 0 && Math.round((currentWater + waterGain) * 100) / 100 > MAX_WATER;

    if (wouldExceedFood || wouldExceedWater) {
      return res.status(400).json({ success: false, message: '現在還不需要這個。' });
    }

    const newStr = Math.round(((currentStats.strength ?? 1) + strGain) * 100) / 100;
    const newSpd = Math.round(((currentStats.speed ?? 1) + spdGain) * 100) / 100;
    const newDex = Math.round(((currentStats.dexterity ?? 1) + dexGain) * 100) / 100;
    const newDef = Math.round(((currentStats.defense ?? 0) + defGain) * 100) / 100;
    const newMaxHp = Math.round(((currentStats.maxHp ?? MAX_HP) + maxHpGain) * 100) / 100;
    const newWater = Math.max(0, Math.min(MAX_WATER, Math.round((currentWater + waterGain) * 100) / 100));
    const newFood = Math.max(0, Math.min(MAX_FOOD, Math.round((currentFood + foodGain) * 100) / 100));
    const currentHp = player.hp ?? MAX_HP;
    const newHp = hpGain !== 0
      ? Math.max(0, Math.min(newMaxHp, currentHp + hpGain))
      : Math.min(newMaxHp, currentHp);

    player.stats = {
      strength: newStr,
      speed: newSpd,
      dexterity: newDex,
      defense: newDef,
      maxHp: newMaxHp,
      water: newWater,
      food: newFood,
    };
    player.hp = newHp;
    player.markModified('stats');
    player.markModified('inventory');

    await player.save();

    const effects = [];
    const effectsEn = [];
    if (hpGain !== 0) {
      effects.push(`HP ${hpGain > 0 ? `+${hpGain}` : hpGain}`);
      effectsEn.push(`${hpGain > 0 ? `+${hpGain}` : hpGain} HP`);
    }
    if (strGain !== 0) {
      effects.push(`力量 +${strGain}`);
      effectsEn.push(`+${strGain} STR`);
    }
    if (spdGain !== 0) {
      effects.push(`速度 +${spdGain}`);
      effectsEn.push(`+${spdGain} SPD`);
    }
    if (dexGain !== 0) {
      effects.push(`精巧 +${dexGain}`);
      effectsEn.push(`+${dexGain} DEX`);
    }
    if (defGain !== 0) {
      effects.push(`防禦 +${defGain}`);
      effectsEn.push(`+${defGain} DEF`);
    }
    if (maxHpGain !== 0) {
      effects.push(`最大HP +${maxHpGain}`);
      effectsEn.push(`+${maxHpGain} MaxHP`);
    }
    if (waterGain !== 0) {
      effects.push(`水分 ${waterGain > 0 ? `+${waterGain}` : waterGain}`);
      effectsEn.push(`${waterGain > 0 ? `+${waterGain}` : waterGain} Water`);
    }
    if (foodGain !== 0) {
      effects.push(`飽食 ${foodGain > 0 ? `+${foodGain}` : foodGain}`);
      effectsEn.push(`${foodGain > 0 ? `+${foodGain}` : foodGain} Food`);
    }

    return res.json({
      success: true,
      data: formatPlayerResponse(player),
      logActionText,
      logActionTextEn,
      effectStr: effects.length > 0 ? ` (${effects.join(', ')})` : '',
      effectStrEn: effectsEn.length > 0 ? ` (${effectsEn.join(', ')})` : '',
    });
  } catch (err) {
    console.error('[API Error] POST /api/player/consume:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/gather
router.post('/player/gather', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法進行採集！' });
    }

    const { itemId, qty = 1 } = req.body;
    const addQty = Math.max(1, Number(qty) || 1);

    let player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家角色！' });
    }

    settleEnergyRecovery(player);

    if (isPlayerComatose(player)) {
      return res.status(400).json({ success: false, message: '角色處於昏迷狀態，無法行動！' });
    }

    let locationDoc = await Location.findOne({ locationId: player.location });
    if (!locationDoc) {
      locationDoc = initialLocations.find((l) => l.locationId === player.location);
    }
    const spot = (locationDoc?.gatherables || []).find((g) => g.itemId === itemId);
    if (!spot) {
      return res.status(400).json({ success: false, message: '當前地點無法採集該資源！' });
    }

    player.inventory = sanitizeInventoryItems(player.inventory);
    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
    await settlePlayerInventoryDecay(player, allDbItems);
    const requiredToolTypes = spot.requiredToolTypes || [];

    const unitCost = spot.cost ?? 1;
    const singleCost = calculateEffectiveEnergyCost(player, unitCost, 'GATHER');
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (singleCost > 0 && currentEnergy < singleCost) {
      return res.status(400).json({ success: false, message: '精力不足！' });
    }

    const locBuildingList = locationDoc?.buildings || [];
    const locBuildingIds = locBuildingList.map((b) => b.buildingId);
    let dbBuildings = await Building.find({ buildingId: { $in: locBuildingIds } });
    const locBuildingTypes = locBuildingList.map((b) => {
      const found = dbBuildings.find((db) => db.buildingId === b.buildingId) || initialBuildings.find((db) => db.buildingId === b.buildingId);
      return found?.type || b.buildingId;
    });

    // 依耐久度升序檢查工具需求，並計算工具最大可執行次數（瓶頸最小值）
    const { maxExecutableQty: maxByTools, selectedTools } = calculateMaxExecutableByTools(
      player.inventory,
      requiredToolTypes,
      singleCost,
      allDbItems,
      locBuildingTypes
    );

    if (maxByTools === 0) {
      return res.status(400).json({ success: false, message: '缺少採集所需工具！' });
    }

    // 檢查肉餌需求與最大可執行次數
    let maxByBait = Infinity;
    if (requiredToolTypes.includes('BAIT')) {
      const getItemTypes = (targetItemId) => {
        const found = allDbItems.find((d) => d.itemId === targetItemId);
        if (!found || !found.type) return [];
        return Array.isArray(found.type) ? found.type : [found.type];
      };
      const baitEntries = player.inventory.filter((inv) => getItemTypes(inv.itemId).includes('BAIT'));
      const totalBaitCount = baitEntries.reduce((sum, inv) => sum + (inv.count || 1), 0);
      if (totalBaitCount < 1) {
        return res.status(400).json({ success: false, message: '肉餌數量不足！' });
      }
      maxByBait = totalBaitCount;
    }

    let targetItemDoc = allDbItems.find((i) => i.itemId === itemId);
    if (!targetItemDoc) {
      targetItemDoc = await Item.findOne({ itemId }) || initialItems.find((i) => i.itemId === itemId);
    }
    const targetItemTypes = Array.isArray(targetItemDoc?.type)
      ? targetItemDoc.type
      : (targetItemDoc?.type ? [targetItemDoc.type] : []);
    const isLiquidResource = targetItemTypes.includes('LIQUID');

    let maxByContainer = Infinity;
    if (isLiquidResource) {
      const { totalAvailableCapacity } = calculateLiquidContainerCapacity(
        player.inventory,
        itemId,
        allDbItems
      );
      if (totalAvailableCapacity <= 0) {
        return res.status(400).json({ success: false, message: '無可裝的空容器。' });
      }
      maxByContainer = totalAvailableCapacity;
    }

    const maxByEnergy = singleCost > 0 ? Math.floor(currentEnergy / singleCost) : Infinity;

    // 計算實際執行次數（受限於精力、肉餌、工具耐久度與容器可用容量）
    const actualQty = Math.max(1, Math.min(addQty, maxByEnergy, maxByBait, maxByTools, maxByContainer));
    const isLimitedByTools = maxByTools < addQty && actualQty === maxByTools;
    const isLimitedByContainer = isLiquidResource && maxByContainer < addQty && actualQty === maxByContainer;

    const baseTotalCost = unitCost * actualQty;
    const totalCost = calculateEffectiveEnergyCost(player, baseTotalCost, 'GATHER');

    // 扣除肉餌
    if (requiredToolTypes.includes('BAIT')) {
      let remainingToDeduct = 1 * actualQty;
      for (const inv of player.inventory) {
        if (remainingToDeduct <= 0) break;
        const dbI = allDbItems.find((d) => d.itemId === inv.itemId);
        const types = dbI?.type ? (Array.isArray(dbI.type) ? dbI.type : [dbI.type]) : [];
        if (types.includes('BAIT')) {
          const curCount = inv.count || 1;
          if (curCount <= remainingToDeduct) {
            inv.count = 0;
            remainingToDeduct -= curCount;
          } else {
            inv.count = curCount - remainingToDeduct;
            remainingToDeduct = 0;
          }
        }
      }
      player.inventory = player.inventory.filter((i) => (i.count || 0) > 0);
    }

    const maxEnergy = player.maxEnergy ?? 4320;
    const wasFull = player.energy >= maxEnergy;
    player.energy = Math.round(Math.max(0, player.energy - totalCost) * 10) / 10;
    if (wasFull && player.energy < maxEnergy) {
      player.lastEnergyRecoveredAt = new Date();
    }
    applyEnergyConsumption(player, totalCost);
    player.markModified('stats');

    // 扣除工具耐久度，耐久度 <= 0 自動自背包刪除實體
    const { updatedInventory, brokenTools } = applyToolsDurabilityDeduction(
      player.inventory,
      selectedTools,
      totalCost
    );
    player.inventory = updatedInventory;
    player.markModified('inventory');

    // 結算生活技能經驗（採集、釣魚、挖礦）與成功率加成
    const spotSkill = spot.skillType || (
      requiredToolTypes.includes('MINING_TOOL')
        ? 'MINING'
        : (requiredToolTypes.includes('FISHING_NET') || requiredToolTypes.includes('LANDING_NET')
          ? 'FISHING'
          : 'GATHERING')
    );
    const currentSkillObj = player.lifeSkills?.[spotSkill] || { level: 0, exp: 0 };
    const currentSkillLevel = currentSkillObj.level ?? 0;
    const baseChance = typeof spot.chance === 'number' ? spot.chance : 100;
    const finalSuccessRate = calculateSuccessRate(baseChance, currentSkillLevel);

    // 依據實際採集次數、單次獲得量上限與最終成功率進行抽籤判定
    const maxYield = Math.max(1, Number(spot.maxYield) || 1);
    let successQty = 0;
    let failQty = 0;
    for (let i = 0; i < actualQty; i++) {
      if (Math.random() * 100 < finalSuccessRate) {
        successQty += 1;
      } else {
        failQty += 1;
      }
    }
    const gainedQty = successQty * maxYield;

    const expPerUnit = (typeof spot.expPerUnit === 'number')
      ? spot.expPerUnit
      : (Number(spot.expPerUnit) > 0 ? Number(spot.expPerUnit) : (spot.cost || 1));
    const expToAdd = roundExp(gainedQty * expPerUnit);

    if (spotSkill && expToAdd > 0) {
      if (!player.lifeSkills) {
        player.lifeSkills = {
          GATHERING: { level: 0, exp: 0 },
          FISHING: { level: 0, exp: 0 },
          MINING: { level: 0, exp: 0 },
          COOKING: { level: 0, exp: 0 },
        };
      }
      const currentSkill = player.lifeSkills[spotSkill] || { level: 0, exp: 0 };
      const updatedSkill = addLifeSkillExp(currentSkill, expToAdd);
      player.lifeSkills[spotSkill] = {
        level: updatedSkill.level,
        exp: updatedSkill.exp,
      };
      player.markModified('lifeSkills');
    }

    let newlyUnlockedRecipes = [];
    if (gainedQty > 0) {
      if (isLiquidResource) {
        // 液體資源注入容器實體，不作為散裝道具加入背包
        player.inventory = fillLiquidContainers(
          player.inventory,
          itemId,
          gainedQty,
          allDbItems
        );
        player.markModified('inventory');
      } else {
        const itemDurability = (targetItemDoc?.durability !== undefined && targetItemDoc.durability > 0)
          ? targetItemDoc.durability
          : -1;
        const itemMaxDurability = itemDurability > 0 ? itemDurability : -1;

        player.inventory = addItemsToInventory(
          player.inventory,
          itemId,
          gainedQty,
          {
            durability: itemDurability,
            maxDurability: itemMaxDurability,
            quality: '普通',
          },
          allDbItems
        );
        player.markModified('inventory');
      }

      // 檢查採集獲得資源是否解鎖新配方（比對 recipe.triggerItem）
      let allDbRecipes = await Recipe.find({});
      if (!allDbRecipes || allDbRecipes.length === 0) allDbRecipes = initialRecipes;

      const unlockResult = checkRecipeUnlocks(
        player.unlockedRecipes,
        allDbRecipes,
        itemId
      );
      newlyUnlockedRecipes = unlockResult.newlyUnlockedRecipes;

      if (newlyUnlockedRecipes.length > 0) {
        player.unlockedRecipes = unlockResult.updatedUnlocked;
        player.markModified('unlockedRecipes');
      }
    }

    // 日誌處理：工具耐久度不足以執行選擇次數時與工具損壞時輸出系統日誌
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const targetPlayerId = player._id ? player._id.toString() : (player.googleId || player.name || '');

    const targetItemName = targetItemDoc?.name || spot.itemId;
    const targetItemNameEn = targetItemDoc?.nameEn || targetItemDoc?.name || spot.itemId;

    await GameLog.create({
      time: timeStr,
      sender: '系統',
      senderEn: 'System',
      text: `採集${targetItemName}${actualQty}次，失敗${failQty}次。`,
      textEn: `Gathered ${targetItemNameEn} ${actualQty} times, failed ${failQty} times.`,
      type: 'system',
      locationId: '',
      targetPlayerId,
    });

    if (isLimitedByTools) {
      await GameLog.create({
        time: timeStr,
        sender: '系統',
        senderEn: 'System',
        text: `只執行了${actualQty}次，工具就壞了。`,
        textEn: `Only executed ${actualQty} times before the tool broke.`,
        type: 'system',
        locationId: '',
        targetPlayerId,
      });
    }

    if (isLimitedByContainer) {
      await GameLog.create({
        time: timeStr,
        sender: '系統',
        senderEn: 'System',
        text: `容器空間有限，只夠裝 ${actualQty} 份。`,
        textEn: `Container capacity is limited, only enough for ${actualQty} portions.`,
        type: 'system',
        locationId: '',
        targetPlayerId,
      });
    }

    for (const bTool of brokenTools) {
      const dbI = allDbItems.find((d) => d.itemId === bTool.itemId);
      const toolName = bTool.customName || dbI?.name || bTool.itemId;
      const toolNameEn = bTool.customNameEn || dbI?.nameEn || dbI?.name || bTool.itemId;
      await GameLog.create({
        time: timeStr,
        sender: '系統',
        senderEn: 'System',
        text: `${toolName}已損壞。`,
        textEn: `${toolNameEn} has broken.`,
        type: 'system',
        locationId: '',
        targetPlayerId,
      });
    }

    await player.save();
    return res.json({
      success: true,
      source: 'mongodb',
      data: formatPlayerResponse(player),
      result: { gainedQty, gainedExp: expToAdd, actualQty, requestedQty: addQty, newlyUnlockedRecipes },
    });
  } catch (err) {
    console.error('[API Error] POST /api/player/gather:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/travel
router.post('/player/travel', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法移動！' });
    }

    const { targetLocationId } = req.body;
    if (!targetLocationId) {
      return res.status(400).json({ success: false, message: '請指定目標地點！' });
    }

    let player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家角色！' });
    }

    settleEnergyRecovery(player);

    if (isPlayerComatose(player)) {
      return res.status(400).json({ success: false, message: '角色處於昏迷狀態，無法行動！' });
    }

    player.inventory = sanitizeInventoryItems(player.inventory);
    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) {
      allDbItems = initialItems;
    }
    await settlePlayerInventoryDecay(player, allDbItems);

    const invItemIds = (player.inventory || []).map((i) => i.itemId);
    let dbItems = allDbItems.filter((i) => invItemIds.includes(i.itemId));

    if (isPlayerOverburdened(player, player.inventory, dbItems)) {
      return res.status(400).json({ success: false, message: '背包負重超載，無法移動！' });
    }

    let locationDoc = await Location.findOne({ locationId: player.location });
    if (!locationDoc) {
      locationDoc = initialLocations.find((l) => l.locationId === player.location);
    } else {
      await settleLocationPlacedItemsDecay(locationDoc, allDbItems);
    }

    const targetLocDoc = await Location.findOne({ locationId: targetLocationId });
    if (targetLocDoc) {
      await settleLocationPlacedItemsDecay(targetLocDoc, allDbItems);
    }

    const connection = (locationDoc?.connections || []).find((c) => c.targetLocationId === targetLocationId);
    if (!connection) {
      return res.status(400).json({ success: false, message: '當前地點無法直接前往該目標地點！' });
    }

    const baseEnergyCost = connection.energyCost ?? 1;
    const energyCost = calculateEffectiveEnergyCost(player, baseEnergyCost, 'TRAVEL');
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (currentEnergy < energyCost) {
      return res.status(400).json({ success: false, message: '精力不足！' });
    }

    const maxEnergy = player.maxEnergy ?? 4320;
    const wasFull = player.energy >= maxEnergy;
    player.energy = Math.round(Math.max(0, player.energy - energyCost) * 10) / 10;
    if (wasFull && player.energy < maxEnergy) {
      player.lastEnergyRecoveredAt = new Date();
    }
    applyEnergyConsumption(player, energyCost);
    player.markModified('stats');

    player.location = targetLocationId;
    const known = Array.isArray(player.knownLocations) ? [...player.knownLocations] : [];
    if (!known.includes(targetLocationId)) {
      known.push(targetLocationId);
      player.knownLocations = known;
      player.markModified('knownLocations');
    }

    await player.save();
    return res.json({ success: true, source: 'mongodb', data: formatPlayerResponse(player) });
  } catch (err) {
    console.error('[API Error] POST /api/player/travel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/craft
router.post('/player/craft', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法進行合成！' });
    }

    const { recipeId, craftQty = 1, selectedMaterials = {} } = req.body;
    if (!recipeId) {
      return res.status(400).json({ success: false, message: '請指定合成配方！' });
    }

    const numCraftQty = Math.max(1, Number(craftQty) || 1);

    let player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家角色！' });
    }

    settleEnergyRecovery(player);

    if (isPlayerComatose(player)) {
      return res.status(400).json({ success: false, message: '角色處於昏迷狀態，無法行動！' });
    }

    let recipe = await Recipe.findOne({ recipeId });
    if (!recipe) {
      recipe = initialRecipes.find((r) => r.recipeId === recipeId);
    }
    if (!recipe) {
      return res.status(400).json({ success: false, message: '找不到指定配方！' });
    }

    const playerUnlocked = player.unlockedRecipes || [];
    const isUnlocked = playerUnlocked.some((ur) => {
      return typeof ur === 'string' ? ur === recipe.recipeId : ur?.recipeId === recipe.recipeId;
    });
    if (!isUnlocked) {
      return res.status(400).json({ success: false, message: '該配方尚未解鎖！' });
    }

    let locationDoc = await Location.findOne({ locationId: player.location });
    if (!locationDoc) {
      locationDoc = initialLocations.find((l) => l.locationId === player.location);
    }
    const locBuildingList = locationDoc?.buildings || [];
    const locBuildingIds = locBuildingList.map((b) => b.buildingId);
    let dbBuildings = await Building.find({ buildingId: { $in: locBuildingIds } });
    const locBuildingTypes = locBuildingList.map((b) => {
      const found = dbBuildings.find((db) => db.buildingId === b.buildingId) || initialBuildings.find((db) => db.buildingId === b.buildingId);
      return found?.type || b.buildingId;
    });

    player.inventory = sanitizeInventoryItems(player.inventory);
    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) {
      allDbItems = initialItems;
    }
    await settlePlayerInventoryDecay(player, allDbItems);
    const cleanInventory = player.inventory;
    const invItemIds = cleanInventory.map((i) => i.itemId);
    let dbItems = allDbItems.filter((i) => invItemIds.includes(i.itemId));
    const getItemTypes = (targetItemId) => {
      const found = dbItems.find((d) => d.itemId === targetItemId) || initialItems.find((d) => d.itemId === targetItemId);
      if (!found || !found.type) return [];
      return Array.isArray(found.type) ? found.type : [found.type];
    };

    const baseSingleEnergyCost = recipe.energyCost || 0;
    const singleEnergyCost = calculateEffectiveEnergyCost(player, baseSingleEnergyCost, 'CRAFT');
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (singleEnergyCost > 0 && currentEnergy < singleEnergyCost) {
      return res.status(400).json({ success: false, message: '精力不足！' });
    }

    const reqTools = recipe.requiredToolTypes || [];
    // 依耐久度升序檢查工具需求，並計算工具最大可執行次數（瓶頸最小值）
    const { maxExecutableQty: maxByTools, selectedTools } = calculateMaxExecutableByTools(
      cleanInventory,
      reqTools,
      singleEnergyCost,
      allDbItems,
      locBuildingTypes
    );

    if (maxByTools === 0) {
      return res.status(400).json({ success: false, message: '缺少合成所需工具！' });
    }

    const reqItems = recipe.requiredItems || [];
    let maxByMaterials = Infinity;

    for (let reqIdx = 0; reqIdx < reqItems.length; reqIdx++) {
      const req = reqItems[reqIdx];
      const selectedId = selectedMaterials[reqIdx];
      if (!selectedId) {
        return res.status(400).json({ success: false, message: '未選擇所需材料！' });
      }

      const matchingIndices = [];
      cleanInventory.forEach((inv, idx) => {
        if (inv.itemId === selectedId) {
          matchingIndices.push(idx);
        }
      });
      const totalAvailable = matchingIndices.reduce((sum, idx) => sum + (cleanInventory[idx].count || 1), 0);
      const reqQty = req.quantity || 1;
      const canDo = Math.floor(totalAvailable / reqQty);
      if (canDo < 1) {
        return res.status(400).json({ success: false, message: '材料不足或未持有指定材料！' });
      }
      if (canDo < maxByMaterials) {
        maxByMaterials = canDo;
      }

      if (matchingIndices.length > 0) {
        const firstMatchingItem = cleanInventory[matchingIndices[0]];
        const types = getItemTypes(firstMatchingItem.itemId);
        const matchesItem = req.itemId ? firstMatchingItem.itemId === req.itemId : false;
        const matchesType = req.type ? types.includes(req.type) : false;
        if (!matchesItem && !matchesType) {
          return res.status(400).json({ success: false, message: '所選材料不符合配方需求！' });
        }
      }
    }

    const maxByEnergy = singleEnergyCost > 0 ? Math.floor(currentEnergy / singleEnergyCost) : Infinity;

    // 計算實際執行次數（受限於精力、材料與工具耐久度）
    const actualCraftQty = Math.max(1, Math.min(numCraftQty, maxByMaterials, maxByEnergy, maxByTools));
    const isLimitedByTools = maxByTools < numCraftQty && actualCraftQty === maxByTools;

    const baseEnergyCost = baseSingleEnergyCost * actualCraftQty;
    const totalEnergyCost = calculateEffectiveEnergyCost(player, baseEnergyCost, 'CRAFT');

    let updatedInv = sanitizeInventoryItems(player.inventory);
    let primaryConsumedMaterial = null;

    for (let reqIdx = 0; reqIdx < reqItems.length; reqIdx++) {
      const req = reqItems[reqIdx];
      const requiredTotalCount = req.quantity * actualCraftQty;
      const selectedId = selectedMaterials[reqIdx];

      const matchingIndices = [];
      updatedInv.forEach((inv, idx) => {
        if (inv.itemId === selectedId) {
          matchingIndices.push(idx);
        }
      });
      matchingIndices.sort((a, b) => compareItemDurability(updatedInv[a], updatedInv[b]));

      if (reqIdx === 0 && matchingIndices.length > 0 && !primaryConsumedMaterial) {
        primaryConsumedMaterial = { ...updatedInv[matchingIndices[0]] };
      }

      let remainingDeduct = requiredTotalCount;
      for (const idx of matchingIndices) {
        if (remainingDeduct <= 0) break;
        const curCount = updatedInv[idx].count || 1;
        if (curCount <= remainingDeduct) {
          updatedInv[idx] = { ...updatedInv[idx], count: 0 };
          remainingDeduct -= curCount;
        } else {
          updatedInv[idx] = { ...updatedInv[idx], count: curCount - remainingDeduct };
          remainingDeduct = 0;
        }
      }
    }
    updatedInv = updatedInv.filter((i) => (i.count || 0) > 0);

    // 扣除背包工具耐久度，若耐久 <= 0 則自背包刪除
    const { updatedInventory: invAfterTools, brokenTools } = applyToolsDurabilityDeduction(
      updatedInv,
      selectedTools,
      totalEnergyCost
    );
    updatedInv = invAfterTools;

    let calculatedDurability = -1;
    const firstSelId = selectedMaterials[0];
    if (recipe.durabilityFormula) {
      let matDurability = -1;
      const targetMat = primaryConsumedMaterial || (firstSelId ? updatedInv.find((i) => i.itemId === firstSelId) || player.inventory.find((i) => i.itemId === firstSelId) : null);
      if (targetMat) {
        const matDbItem = (allDbItems || initialItems).find((i) => i.itemId === targetMat.itemId);
        matDurability = (targetMat.durability !== undefined && targetMat.durability > 0)
          ? targetMat.durability
          : (matDbItem && matDbItem.durability !== undefined && matDbItem.durability > 0 ? matDbItem.durability : -1);
      }
      try {
        const computeFn = new Function('material', `return ${recipe.durabilityFormula};`);
        calculatedDurability = computeFn({ durability: matDurability > 0 ? matDurability : 0 });
      } catch (err) {
        console.error('[Durability Formula Error]', err);
      }
    }

    if (!allDbItems || allDbItems.length === 0) {
      allDbItems = await Item.find();
      if (!allDbItems || allDbItems.length === 0) {
        allDbItems = initialItems;
      }
    }

    // 通用資料結構方式三：解析 base 材料與 modifier 材料
    let baseMaterialId = '';
    const modifierMaterialIds = [];

    reqItems.forEach((req, idx) => {
      const selId = selectedMaterials[idx];
      if (!selId) return;
      if (req.role === 'base') {
        if (!baseMaterialId) baseMaterialId = selId;
      } else if (req.role === 'modifier') {
        modifierMaterialIds.push(selId);
      }
    });

    if (!baseMaterialId) {
      baseMaterialId = selectedMaterials[0] || (Array.isArray(selectedMaterials) ? selectedMaterials[0] : '');
    }
    if (modifierMaterialIds.length === 0) {
      Object.entries(selectedMaterials).forEach(([k, v]) => {
        if (Number(k) > 0 && v) {
          modifierMaterialIds.push(v);
        }
      });
    }

    // 計算修飾詞與修飾營養 (Modifiers)
    let customPrefix = '';
    let customPrefixEn = '';
    const bonusNutrition = {
      hp: 0, strength: 0, speed: 0, dexterity: 0, defense: 0, maxHp: 0, water: 0, food: 0,
    };
    let hasBonusNutrition = false;

    if (recipe.modifiers && typeof recipe.modifiers === 'object') {
      modifierMaterialIds.forEach((modId) => {
        const mod = recipe.modifiers[modId];
        if (mod) {
          if (mod.prefix) {
            customPrefix = customPrefix ? `${customPrefix}・${mod.prefix}` : mod.prefix;
          }
          if (mod.prefixEn) {
            customPrefixEn = customPrefixEn ? `${mod.prefixEn} ${customPrefixEn}` : mod.prefixEn;
          }
          if (mod.bonusNutrition) {
            for (const [statKey, statVal] of Object.entries(mod.bonusNutrition)) {
              if (typeof statVal === 'number' && statVal !== 0 && bonusNutrition[statKey] !== undefined) {
                bonusNutrition[statKey] += statVal;
                hasBonusNutrition = true;
              }
            }
          }
        }
      });
    }

    // 方案 A：解析 effectiveOutputs（支援字串主要產物映射與完整產物陣列映射）
    const mappedOutput = recipe.outputs && typeof recipe.outputs === 'object'
      ? (recipe.outputs[baseMaterialId] || recipe.outputs['default'])
      : null;

    const effectiveOutputs = (Array.isArray(mappedOutput) && mappedOutput.length > 0)
      ? mappedOutput.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity || 1,
        type: item.type,
      }))
      : (recipe.outputItems || []).map((out, idx) => {
        let finalItemId = '';
        if (idx === 0 && typeof mappedOutput === 'string' && mappedOutput.trim()) {
          finalItemId = mappedOutput.trim();
        } else if (out.itemId) {
          finalItemId = out.itemId;
        }

        if (!finalItemId) {
          const outItemId = out.itemId || recipe.recipeId;
          const dbOut = allDbItems.find(
            (i) => i.itemId === outItemId || (out.type && i.type === out.type) || (out.type && Array.isArray(i.type) && i.type.includes(out.type)) || i.name === recipe.name
          );
          finalItemId = out.itemId || (dbOut ? dbOut.itemId : recipe.recipeId);
        }

        return {
          itemId: finalItemId,
          quantity: out.quantity || 1,
          type: out.type,
        };
      });

    // 依據生活技能等級計算最終成功率（每級+5%），並隨機抽籤判定成功與失敗次數
    const craftSkill = recipe.skillType || 'COOKING';
    const currentCraftSkillObj = player.lifeSkills?.[craftSkill] || { level: 0, exp: 0 };
    const currentCraftSkillLevel = currentCraftSkillObj.level ?? 0;
    const baseSuccessRate = recipe.baseSuccessRate !== undefined ? Number(recipe.baseSuccessRate) : 75;
    const finalSuccessRate = calculateSuccessRate(baseSuccessRate, currentCraftSkillLevel);

    let successCraftQty = 0;
    let failCraftQty = 0;
    for (let i = 0; i < actualCraftQty; i++) {
      if (Math.random() * 100 < finalSuccessRate) {
        successCraftQty += 1;
      } else {
        failCraftQty += 1;
      }
    }

    if (successCraftQty > 0) {
      for (let outIdx = 0; outIdx < effectiveOutputs.length; outIdx++) {
        const out = effectiveOutputs[outIdx];
        const finalItemId = out.itemId;
        const addQty = (out.quantity || 1) * successCraftQty;
        const isPrimary = (outIdx === 0);

        const baseDbItem = allDbItems.find((i) => i.itemId === finalItemId) || initialItems.find((i) => i.itemId === finalItemId);
        const customName = isPrimary && customPrefix && baseDbItem ? `${customPrefix}・${baseDbItem.name}` : '';
        const customNameEn = isPrimary && customPrefixEn && baseDbItem ? `${customPrefixEn} ${baseDbItem.nameEn || baseDbItem.name}` : '';
        const finalBonusNutrition = isPrimary && hasBonusNutrition ? bonusNutrition : undefined;

        const baseDur = baseDbItem && baseDbItem.durability !== undefined && baseDbItem.durability > 0 ? baseDbItem.durability : -1;
        const finalDurability = calculatedDurability > 0 ? calculatedDurability : baseDur;
        const finalMaxDurability = finalDurability > 0 ? finalDurability : -1;

        if (finalDurability > 0) {
          // 耐久度道具一律獨立計算，不進行堆疊，每次批量製作各自生成獨立實體
          for (let k = 0; k < addQty; k++) {
            updatedInv.push({
              instanceId: generateInstanceId(),
              itemId: finalItemId,
              count: 1,
              durability: finalDurability,
              maxDurability: finalMaxDurability,
              quality: '普通',
              lastDecayedAt: new Date(),
              ...(customName ? { customName, customNameEn } : {}),
              ...(finalBonusNutrition ? { bonusNutrition: finalBonusNutrition } : {}),
            });
          }
        } else {
          // 無耐久度道具維持一般堆疊邏輯
          updatedInv = addItemsToInventory(updatedInv, finalItemId, addQty, {
            customName,
            customNameEn,
            bonusNutrition: finalBonusNutrition,
            quality: '普通',
          });
        }
      }
    }

    let hasQuestUpdate = false;
    let updatedQuests = [];
    if (player.quests && player.quests.length > 0 && successCraftQty > 0) {
      let dbQuests = await Quest.find();
      if (!dbQuests || dbQuests.length === 0) {
        dbQuests = initialQuests;
      }
      updatedQuests = player.quests.map((q) => {
        const qObj = q.toObject ? q.toObject() : { ...q };
        return {
          ...qObj,
          progress: qObj.progress ? qObj.progress.map((p) => ({ ...p })) : [],
        };
      });

      for (const out of effectiveOutputs) {
        const finalItemId = out.itemId;
        const addQty = (out.quantity || 1) * successCraftQty;

        for (const q of updatedQuests) {
          if (q.status !== 'IN_PROGRESS') continue;
          const qDef = (dbQuests || []).find((def) => def.questId === q.questId);
          if (!qDef) continue;
          (qDef.objectives || []).forEach((obj, objIdx) => {
            if (obj.type === 'CRAFT' && obj.targetId === finalItemId) {
              let prog = (q.progress || []).find((p) => p.objectiveIndex === objIdx);
              if (!prog) {
                prog = { objectiveIndex: objIdx, currentCount: 0, isCompleted: false };
                q.progress = q.progress || [];
                q.progress.push(prog);
              }
              prog.currentCount = (prog.currentCount || 0) + addQty;
              if (prog.currentCount >= (obj.requiredCount || 1)) {
                prog.isCompleted = true;
              }
              hasQuestUpdate = true;
            }
          });
        }
      }
    }

    const maxEnergy = player.maxEnergy ?? 4320;
    const wasFull = player.energy >= maxEnergy;
    player.energy = Math.round(Math.max(0, player.energy - totalEnergyCost) * 10) / 10;
    if (wasFull && player.energy < maxEnergy) {
      player.lastEnergyRecoveredAt = new Date();
    }
    applyEnergyConsumption(player, totalEnergyCost);
    player.markModified('stats');
    player.inventory = sanitizeInventoryItems(updatedInv);
    player.markModified('inventory');
    if (hasQuestUpdate) {
      player.quests = updatedQuests;
      player.markModified('quests');
    }

    // 結算生活技能經驗（料理）
    if (craftSkill) {
      if (!player.lifeSkills) {
        player.lifeSkills = {
          GATHERING: { level: 0, exp: 0 },
          FISHING: { level: 0, exp: 0 },
          MINING: { level: 0, exp: 0 },
          COOKING: { level: 0, exp: 0 },
        };
      }
      const currentSkill = player.lifeSkills[craftSkill] || { level: 0, exp: 0 };
      const baseExp = Number(recipe.baseExp) || 0;
      let materialBonusExp = 0;
      if (recipe.ingredientExp && typeof recipe.ingredientExp === 'object') {
        Object.values(selectedMaterials).forEach((matId) => {
          if (matId && recipe.ingredientExp[matId]) {
            materialBonusExp += Number(recipe.ingredientExp[matId]) || 0;
          }
        });
      }
      const totalExpToAdd = (baseExp + materialBonusExp) * successCraftQty;
      if (totalExpToAdd > 0) {
        const updatedSkill = addLifeSkillExp(currentSkill, totalExpToAdd);
        player.lifeSkills[craftSkill] = {
          level: updatedSkill.level,
          exp: updatedSkill.exp,
        };
        player.markModified('lifeSkills');
      }
    }

    // 日誌處理：工具耐久度不足以執行選擇次數時與工具損壞時輸出系統日誌
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const targetPlayerId = player._id ? player._id.toString() : (player.googleId || player.name || '');

    const recipeName = recipe.name || '道具';
    const recipeNameEn = recipe.nameEn || recipeName;

    await GameLog.create({
      time: timeStr,
      sender: '系統',
      senderEn: 'System',
      text: `製作${recipeName}${actualCraftQty}次，失敗${failCraftQty}次。`,
      textEn: `Crafted ${recipeNameEn} ${actualCraftQty} times, failed ${failCraftQty} times.`,
      type: 'system',
      locationId: '',
      targetPlayerId,
    });

    if (isLimitedByTools) {
      await GameLog.create({
        time: timeStr,
        sender: '系統',
        senderEn: 'System',
        text: `只執行了${actualCraftQty}次，工具就壞了。`,
        textEn: `Only executed ${actualCraftQty} times before the tool broke.`,
        type: 'system',
        locationId: '',
        targetPlayerId,
      });
    }

    for (const bTool of brokenTools) {
      const dbI = allDbItems.find((d) => d.itemId === bTool.itemId);
      const toolName = bTool.customName || dbI?.name || bTool.itemId;
      const toolNameEn = bTool.customNameEn || dbI?.nameEn || dbI?.name || bTool.itemId;
      await GameLog.create({
        time: timeStr,
        sender: '系統',
        senderEn: 'System',
        text: `${toolName}已損壞。`,
        textEn: `${toolNameEn} has broken.`,
        type: 'system',
        locationId: '',
        targetPlayerId,
      });
    }

    await player.save();
    return res.json({
      success: true,
      source: 'mongodb',
      data: formatPlayerResponse(player),
      result: { craftQty: actualCraftQty, successQty: successCraftQty, failQty: failCraftQty, requestedQty: numCraftQty },
    });
  } catch (err) {
    console.error('[API Error] POST /api/player/craft:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs
router.get('/logs', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { locationId, playerId } = req.query;

    let query = {};
    if (locationId || playerId) {
      const orConditions = [];
      if (locationId) {
        orConditions.push({
          type: { $in: ['dialogue', 'event'] },
          locationId: String(locationId),
        });
      }
      if (playerId) {
        orConditions.push({
          type: 'system',
          targetPlayerId: String(playerId),
        });
      }
      query = orConditions.length > 0 ? { $or: orConditions } : {};
    }

    const logs = await GameLog.find(query).sort({ createdAt: -1 }).limit(50);
    return res.json({ success: true, source: 'mongodb', data: logs });
  } catch (err) {
    console.error('[API Error] GET /api/logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/logs
router.post('/logs', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { sender, senderEn, text, textEn, type, locationId, targetPlayerId } = req.body;
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const logDoc = await GameLog.create({
      time: timeStr,
      sender: sender || '系統',
      senderEn: senderEn || 'System',
      text: text || '',
      textEn: textEn || '',
      type: type || 'dialogue',
      locationId: type === 'system' ? '' : (locationId || ''),
      targetPlayerId: type === 'system' ? (targetPlayerId || '') : '',
    });
    return res.json({ success: true, data: logDoc });
  } catch (err) {
    console.error('[API Error] POST /api/logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/location/pickup-item
router.post('/location/pickup-item', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { locationId, instanceId, count } = req.body;
    if (!locationId || !instanceId) {
      return res.status(400).json({ success: false, message: '缺少必要參數！' });
    }

    let player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    const requestedCount = Math.max(1, Number(count) || 1);

    const location = await Location.findOne({ locationId });
    if (!location) {
      return res.status(404).json({ success: false, message: '找不到該地點！' });
    }

    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
    await settleLocationPlacedItemsDecay(location, allDbItems);
    await settlePlayerInventoryDecay(player, allDbItems);

    // 尋找符合 instanceId 或 itemId 的所有地面物品
    const matchingIndices = [];
    (location.placedItems || []).forEach((item, idx) => {
      if (item.instanceId === instanceId || item.itemId === instanceId) {
        matchingIndices.push(idx);
      }
    });

    if (matchingIndices.length === 0) {
      return res.status(404).json({ success: false, message: '該物品已被其他人撿起或已不存在！' });
    }

    // 預設選擇耐久度最高的，若耐久度相同則以資料庫順序為主
    matchingIndices.sort((idxA, idxB) => {
      const cmp = compareItemDurability(location.placedItems[idxA], location.placedItems[idxB], 'desc');
      if (cmp !== 0) return cmp;
      return idxA - idxB;
    });

    const totalAvailable = matchingIndices.reduce(
      (sum, idx) => sum + (location.placedItems[idx].count || 1),
      0
    );
    const pickQty = Math.max(1, Math.min(requestedCount, totalAvailable));

    let remainingToPick = pickQty;
    const indicesToRemove = new Set();
    const pickedItems = [];

    for (const idx of matchingIndices) {
      if (remainingToPick <= 0) break;
      const pItem = location.placedItems[idx];
      const curCount = pItem.count || 1;
      const deductCount = Math.min(curCount, remainingToPick);

      pickedItems.push({
        instanceId: pItem.instanceId,
        itemId: pItem.itemId,
        count: deductCount,
        durability: pItem.durability !== undefined ? pItem.durability : -1,
        maxDurability: pItem.maxDurability !== undefined ? pItem.maxDurability : -1,
        quality: pItem.quality || '普通',
        customName: pItem.customName || '',
        customNameEn: pItem.customNameEn || '',
        bonusNutrition: pItem.bonusNutrition ? { ...pItem.bonusNutrition } : undefined,
        contents: pItem.contents ? { ...pItem.contents } : undefined,
        triggerQuestId: pItem.triggerQuestId || '',
        lastDecayedAt: pItem.lastDecayedAt || new Date(),
      });

      remainingToPick -= deductCount;
      if (curCount <= deductCount) {
        indicesToRemove.add(idx);
      } else {
        pItem.count = curCount - deductCount;
      }
    }

    location.placedItems = location.placedItems.filter((_, idx) => !indicesToRemove.has(idx));
    location.markModified('placedItems');
    await location.save();

    player.inventory = sanitizeInventoryItems(player.inventory);
    for (const pItem of pickedItems) {
      player.inventory = addItemsToInventory(
        player.inventory,
        pItem.itemId,
        pItem.count || 1,
        {
          instanceId: pItem.instanceId,
          durability: pItem.durability,
          maxDurability: pItem.maxDurability,
          quality: pItem.quality || '普通',
          customName: pItem.customName || '',
          customNameEn: pItem.customNameEn || '',
          bonusNutrition: pItem.bonusNutrition,
          contents: pItem.contents,
          lastDecayedAt: pItem.lastDecayedAt,
        }
      );
    }
    player.markModified('inventory');
    await player.save();

    const allLocations = await Location.find({});
    return res.json({ success: true, data: formatPlayerResponse(player), locations: allLocations });
  } catch (err) {
    console.error('[API Error] POST /api/location/pickup-item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/drop-item
router.post('/player/drop-item', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { locationId, itemKey, count } = req.body;
    if (!locationId || !itemKey) {
      return res.status(400).json({ success: false, message: '缺少必要參數！' });
    }

    let player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    if (player.location !== locationId) {
      return res.status(400).json({ success: false, message: '玩家不在該地點！' });
    }

    const location = await Location.findOne({ locationId });
    if (!location) {
      return res.status(404).json({ success: false, message: '找不到該地點！' });
    }

    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) allDbItems = initialItems;
    await settlePlayerInventoryDecay(player, allDbItems);
    await settleLocationPlacedItemsDecay(location, allDbItems);

    player.inventory = sanitizeInventoryItems(player.inventory);

    // 尋找符合 instanceId 或 itemId 的所有背包物品
    const matchingIndices = [];
    player.inventory.forEach((item, idx) => {
      if ((item.instanceId && item.instanceId === itemKey) || item.itemId === itemKey) {
        matchingIndices.push(idx);
      }
    });

    if (matchingIndices.length === 0) {
      return res.status(400).json({ success: false, message: '背包中沒有該道具！' });
    }

    // 預設選擇耐久度最低的，若耐久度相同則以資料庫順序為主
    matchingIndices.sort((idxA, idxB) => {
      const cmp = compareItemDurability(player.inventory[idxA], player.inventory[idxB]);
      if (cmp !== 0) return cmp;
      return idxA - idxB;
    });

    const totalAvailable = matchingIndices.reduce(
      (sum, idx) => sum + (player.inventory[idx].count || 1),
      0
    );
    const dropQty = Math.max(1, Math.min(Number(count) || 1, totalAvailable));

    let remainingToDrop = dropQty;
    const indicesToRemove = new Set();
    const droppedItems = [];

    for (const idx of matchingIndices) {
      if (remainingToDrop <= 0) break;
      const invItem = player.inventory[idx];
      const curCount = invItem.count || 1;
      const deductCount = Math.min(curCount, remainingToDrop);

      droppedItems.push({
        instanceId: generateInstanceId(),
        itemId: invItem.itemId,
        count: deductCount,
        durability: invItem.durability !== undefined ? invItem.durability : -1,
        maxDurability: invItem.maxDurability !== undefined ? invItem.maxDurability : -1,
        quality: invItem.quality || '普通',
        customName: invItem.customName || '',
        customNameEn: invItem.customNameEn || '',
        bonusNutrition: invItem.bonusNutrition ? { ...invItem.bonusNutrition } : undefined,
        contents: invItem.contents ? { ...invItem.contents } : undefined,
        lastDecayedAt: invItem.lastDecayedAt || new Date(),
      });

      remainingToDrop -= deductCount;
      if (curCount <= deductCount) {
        indicesToRemove.add(idx);
      } else {
        invItem.count = curCount - deductCount;
      }
    }

    player.inventory = player.inventory.filter((_, idx) => !indicesToRemove.has(idx));
    player.markModified('inventory');

    // 依堆疊規則將物品加入現場物品（耐久度道具各自為獨立實體）
    for (const dItem of droppedItems) {
      location.placedItems = addItemToPlacedItems(location.placedItems || [], dItem);
    }
    location.markModified('placedItems');

    await location.save();
    await player.save();

    const allLocations = await Location.find({});
    return res.json({
      success: true,
      data: formatPlayerResponse(player),
      locations: allLocations,
    });
  } catch (err) {
    console.error('[API Error] POST /api/player/drop-item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quest/accept
router.post('/quest/accept', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { questId, instanceId, locationId } = req.body;
    const quest = await Quest.findOne({ questId });
    if (!quest) {
      return res.status(404).json({ success: false, message: '找不到該任務！' });
    }

    let player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    const existingQuest = player.quests.find((q) => q.questId === questId);
    if (!existingQuest) {
      const initialProgress = quest.objectives.map((obj, idx) => ({
        objectiveIndex: idx,
        currentCount: 0,
        isCompleted: false,
      }));

      player.quests.push({
        questId,
        status: 'IN_PROGRESS',
        progress: initialProgress,
        acceptedAt: new Date(),
      });

      applyPlayerGrants(player, quest.grantsOnAccept);
    }

    if (instanceId && locationId) {
      const location = await Location.findOne({ locationId });
      if (location) {
        const itemToPick = transferPlacedItemToPlayer(location, instanceId, player);
        if (itemToPick) {
          await location.save();
        }
      }
    }

    player.markModified('quests');
    player.markModified('inventory');
    player.markModified('knownLocations');
    player.markModified('unlockedRecipes');
    await player.save();
    const allLocations = await Location.find({});
    return res.json({
      success: true,
      data: formatPlayerResponse(player),
      locations: allLocations,
      quest: {
        questId: quest.questId,
        title: quest.title,
        description: quest.description,
        triggerNpcId: quest.triggerNpcId,
        submitNpcId: quest.submitNpcId,
      },
    });
  } catch (err) {
    console.error('[API Error] POST /api/quest/accept:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quest/submit
router.post('/quest/submit', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { questId } = req.body;
    const quest = await Quest.findOne({ questId });
    if (!quest) {
      return res.status(404).json({ success: false, message: '找不到該任務！' });
    }

    let player = await getPlayerFromReq(req);
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    const pQuest = player.quests.find((q) => q.questId === questId);
    if (!pQuest || pQuest.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: '任務無法進行發放或已完成！' });
    }

    pQuest.status = 'COMPLETED';
    pQuest.completedAt = new Date();

    const rewards = quest.rewards || {};
    if (rewards.money) player.money += rewards.money;
    applyPlayerGrants(player, rewards);

    if (quest.autoRemoveTriggerItemOnComplete && quest.triggerItemId) {
      player.inventory = sanitizeInventoryItems(player.inventory);
      const invIndex = player.inventory.findIndex((i) => i.itemId === quest.triggerItemId);
      if (invIndex >= 0) {
        if (player.inventory[invIndex].count > 1) {
          player.inventory[invIndex].count -= 1;
        } else {
          player.inventory.splice(invIndex, 1);
        }
      }
    }

    let autoTriggeredQuest = null;
    const nextQuestId = quest.autoTriggerQuestId || quest.autoTrigger;
    if (nextQuestId) {
      const nextQuest = await Quest.findOne({ questId: nextQuestId });
      if (nextQuest) {
        const existingNext = player.quests.find((q) => q.questId === nextQuestId);
        if (!existingNext) {
          const initialProgress = nextQuest.objectives.map((obj, idx) => ({
            objectiveIndex: idx,
            currentCount: 0,
            isCompleted: false,
          }));

          player.quests.push({
            questId: nextQuestId,
            status: 'IN_PROGRESS',
            progress: initialProgress,
            acceptedAt: new Date(),
          });

          applyPlayerGrants(player, nextQuest.grantsOnAccept);
        }
        autoTriggeredQuest = nextQuest;
      }
    }

    player.markModified('quests');
    player.markModified('inventory');
    player.markModified('knownLocations');
    player.markModified('unlockedRecipes');
    await player.save();

    const allLocations = await Location.find({});

    let completeText = quest.completeText || '';
    if (completeText) {
      completeText = completeText.replace(/玩家名稱/g, player.name).replace(/\{playerName\}/g, player.name);
    }

    return res.json({
      success: true,
      data: formatPlayerResponse(player),
      locations: allLocations,
      completeText,
      submitNpcId: quest.submitNpcId,
      quest: {
        questId: quest.questId,
        title: quest.title,
        description: quest.description,
        submitNpcId: quest.submitNpcId,
      },
      autoTriggeredQuest: autoTriggeredQuest ? {
        questId: autoTriggeredQuest.questId,
        title: autoTriggeredQuest.title,
        description: autoTriggeredQuest.description,
        triggerNpcId: autoTriggeredQuest.triggerNpcId,
        submitNpcId: autoTriggeredQuest.submitNpcId,
      } : null,
    });
  } catch (err) {
    console.error('[API Error] POST /api/quest/submit:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
