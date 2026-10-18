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
  DEFAULT_INITIAL_STATS,
} from '../../src/constants/gameConstants.js';
import {
  addLifeSkillExp,
  addItemToPlacedItems,
  addItemsToInventory,
} from '../../src/utils/gameHelpers.js';

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
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(`[API Error] GET ${path}:`, err);
      res.status(503).json({ success: false, error: err.message });
    }
  });
});

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
      quality: raw.quality || '普通',
      customName: raw.customName || '',
      customNameEn: raw.customNameEn || '',
      bonusNutrition: raw.bonusNutrition ? { ...raw.bonusNutrition } : undefined,
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
      player.inventory.push({
        instanceId: generateInstanceId(),
        itemId: gItem.itemId,
        count: gItem.count || 1,
        quality: gItem.quality || '普通',
      });
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
      durability: itemToPick.durability,
      quality: itemToPick.quality || '普通',
      customName: itemToPick.customName || '',
      customNameEn: itemToPick.customNameEn || '',
      bonusNutrition: itemToPick.bonusNutrition,
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
    : [{ skillId: 'NORMAL_ATTACK', level: 1 }];
  p.lifeSkills = {
    GATHERING: {
      level: p.lifeSkills?.GATHERING?.level || 1,
      exp: p.lifeSkills?.GATHERING?.exp || 0,
    },
    FISHING: {
      level: p.lifeSkills?.FISHING?.level || 1,
      exp: p.lifeSkills?.FISHING?.exp || 0,
    },
    MINING: {
      level: p.lifeSkills?.MINING?.level || 1,
      exp: p.lifeSkills?.MINING?.exp || 0,
    },
    COOKING: {
      level: p.lifeSkills?.COOKING?.level || 1,
      exp: p.lifeSkills?.COOKING?.exp || 0,
    },
  };
  p.money = p.money ?? 0;
  p.mentor = p.mentor || 'Martha';
  p.unlockedRecipes = sanitizeUnlockedRecipes(p.unlockedRecipes);
  p.lastEnergyRecoveredAt = p.lastEnergyRecoveredAt
    ? new Date(p.lastEnergyRecoveredAt).toISOString()
    : new Date().toISOString();
  p.energySpentAccumulator = Number(p.energySpentAccumulator) || 0;
  p.hpRegenAccumulator = Number(p.hpRegenAccumulator) || 0;
  p.statusEffects = getStatusEffects(p);
  return p;
};

const MENTOR_SHOP_MAP = {
  Martha: {
    shopLocationId: 'AZURE_BAY_VARIETY_SHOP',
    shopName: '雜貨店',
    shopNameEn: 'Variety Shop',
  },
  Garrick: {
    shopLocationId: 'AZURE_BAY_DINER',
    shopName: '小吃店',
    shopNameEn: 'Diner',
  },
  Vance: {
    shopLocationId: 'AZURE_BAY_SEAFOOD_SHOP',
    shopName: '海產店',
    shopNameEn: 'Seafood Shop',
  },
  Corinne: {
    shopLocationId: 'AZURE_BAY_TACK_SHOP',
    shopName: '馬具店',
    shopNameEn: 'Tack Shop',
  },
  Brock: {
    shopLocationId: 'AZURE_BAY_BROCK_HOME',
    shopName: '布洛克家',
    shopNameEn: "Brock's Home",
  },
};

/**
 * 確保玩家個人的導師自訂房間已建立，若不存在則動態生成並與導師商店建立雙向路徑連接。
 * @param {string} playerName - 玩家角色名稱。
 * @param {string} mentorName - 選擇的導師名稱（'Martha' | 'Garrick' | 'Vance' | 'Corinne' | 'Brock'）。
 * @returns {Promise<{ newRoomId: string, shopLocationId: string }>} 包含新房間 ID 與關聯商店地點 ID 的物件。
 */
const ensureCustomRoom = async (playerName, mentorName) => {
  const shopInfo = MENTOR_SHOP_MAP[mentorName] || MENTOR_SHOP_MAP.Martha;
  const newRoomId = `${shopInfo.shopLocationId}_${playerName}_ROOM`;
  const newRoomName = `${shopInfo.shopName}：${playerName}的房間`;
  const newRoomNameEn = `${shopInfo.shopNameEn}: ${playerName}'s Room`;

  const roomData = {
    locationId: newRoomId,
    name: newRoomName,
    nameEn: newRoomNameEn,
    description: '小巧精簡的個人房間。',
    descriptionEn: 'A compact and minimalist personal room.',
    image: 'https://res.cloudinary.com/duqyw1uhq/image/upload/v1791367142/Room_ffeeyh.png',
    gatherables: [],
    connections: [
      {
        targetLocationId: shopInfo.shopLocationId,
        energyCost: 1,
      },
    ],
    npcs: [],
    hasEvent: false,
    buildings: [],
  };

  await Location.findOneAndUpdate(
    { locationId: newRoomId },
    roomData,
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const shopLoc = await Location.findOne({ locationId: shopInfo.shopLocationId });
  if (shopLoc) {
    if (!shopLoc.connections.some((c) => c.targetLocationId === newRoomId)) {
      shopLoc.connections.push({ targetLocationId: newRoomId, energyCost: 1 });
      await shopLoc.save();
    }
  }

  return { newRoomId, shopLocationId: shopInfo.shopLocationId };
};

// GET /api/player
router.get('/player', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法載入玩家資料！' });
    }

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
    if (!player) {
      const defaultName = '冒險者';
      const defaultMentor = 'Martha';

      player = await Player.create({
        name: defaultName,
        mentor: defaultMentor,
        isCharacterCreated: false,
        stats: { ...DEFAULT_INITIAL_STATS },
        skills: [{ skillId: 'NORMAL_ATTACK', level: 1 }],
        level: 1,
        hp: MAX_HP,
        money: 0,
        energy: MAX_ENERGY,
        maxEnergy: MAX_ENERGY,
        lastEnergyRecoveredAt: new Date(),
        location: 'AZURE_BAY_PORT',
        knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
      });
      console.log('[MongoDB] Created initial player record in MongoDB.');
    } else {
      const energyUpdated = settleEnergyRecovery(player);
      let updated = energyUpdated;

      if (player.isCharacterCreated) {
        const currentMentor = player.mentor || 'Martha';
        const { newRoomId, shopLocationId } = await ensureCustomRoom(player.name, currentMentor);

        const filtered = player.knownLocations.filter((l) => l !== 'AZURE_BAY_ROOM' && !l.includes('冒險者_ROOM'));
        if (filtered.length !== player.knownLocations.length) {
          player.knownLocations = filtered;
          updated = true;
        }
        if (!player.knownLocations.includes(shopLocationId)) {
          player.knownLocations.push(shopLocationId);
          updated = true;
        }
        if (!player.knownLocations.includes(newRoomId)) {
          player.knownLocations.push(newRoomId);
          updated = true;
        }
        if (!player.mentor) {
          player.mentor = currentMentor;
          updated = true;
        }
      }

      if (!player.lifeSkills || !player.lifeSkills.GATHERING) {
        player.lifeSkills = {
          GATHERING: { level: 1, exp: 0 },
          FISHING: { level: 1, exp: 0 },
          MINING: { level: 1, exp: 0 },
          COOKING: { level: 1, exp: 0 },
        };
        player.markModified('lifeSkills');
        updated = true;
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

    const { name, mentor, strength, speed, dexterity, str, spd, dex, stats } = req.body;
    const validMentors = ['Martha', 'Garrick', 'Vance', 'Corinne', 'Brock'];
    const selectedMentor = validMentors.includes(mentor) ? mentor : 'Martha';
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

    if (nStr + nSpd + nDex !== 30) {
      return res.status(400).json({ success: false, message: '三項能力值總和必須精確等於 30！' });
    }

    try {
      await Location.deleteMany({ locationId: { $regex: /.*冒險者.*ROOM$/ } });
      await Location.deleteMany({ locationId: 'AZURE_BAY_ROOM' });
    } catch (cleanErr) {
      console.error('[Clean Room Error]', cleanErr);
    }

    const { newRoomId, shopLocationId } = await ensureCustomRoom(trimmedName, selectedMentor);

    const maxHp = MAX_HP;
    const maxEnergy = MAX_ENERGY;

    const characterData = {
      name: trimmedName,
      mentor: selectedMentor,
      stats: {
        strength: nStr,
        speed: nSpd,
        dexterity: nDex,
        maxHp,
        defense: 0,
        water: MAX_WATER,
        food: MAX_FOOD,
      },
      skills: [{ skillId: 'NORMAL_ATTACK', level: 1 }],
      level: 1,
      isCharacterCreated: true,
      hp: maxHp,
      money: 0,
      energy: maxEnergy,
      maxEnergy,
      lastEnergyRecoveredAt: new Date(),
      energySpentAccumulator: 0,
      location: newRoomId,
      knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET', shopLocationId, newRoomId],
    };

    let player = await Player.findOne();
    if (player) {
      player.name = characterData.name;
      player.mentor = characterData.mentor;
      player.stats = characterData.stats;
      player.skills = characterData.skills;
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
      player.markModified('knownLocations');
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
    let player = await Player.findOne();
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
        player.lifeSkills = {
          ...player.lifeSkills?.toObject(),
          ...updateData.lifeSkills,
        };
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

// POST /api/player/gather
router.post('/player/gather', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法進行採集！' });
    }

    const { itemId, qty = 1 } = req.body;
    const addQty = Math.max(1, Number(qty) || 1);

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
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

    const unitCost = spot.cost ?? 1;
    const baseTotalCost = unitCost * addQty;
    const totalCost = calculateEffectiveEnergyCost(player, baseTotalCost);
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (currentEnergy < totalCost) {
      return res.status(400).json({ success: false, message: '精力不足！' });
    }

    player.inventory = sanitizeInventoryItems(player.inventory);
    const requiredToolTypes = spot.requiredToolTypes || [];

    if (requiredToolTypes.length > 0) {
      const invItemIds = player.inventory.map((i) => i.itemId);
      let dbItems = await Item.find({ itemId: { $in: invItemIds } });
      if (!dbItems || dbItems.length === 0) {
        dbItems = initialItems.filter((i) => invItemIds.includes(i.itemId));
      }

      const getItemTypes = (targetItemId) => {
        const found = dbItems.find((d) => d.itemId === targetItemId) || initialItems.find((d) => d.itemId === targetItemId);
        if (!found || !found.type) return [];
        return Array.isArray(found.type) ? found.type : [found.type];
      };

      const locBuildingList = locationDoc?.buildings || [];
      const locBuildingIds = locBuildingList.map((b) => b.buildingId);
      let dbBuildings = await Building.find({ buildingId: { $in: locBuildingIds } });
      const locBuildingTypes = locBuildingList.map((b) => {
        const found = dbBuildings.find((db) => db.buildingId === b.buildingId) || initialBuildings.find((db) => db.buildingId === b.buildingId);
        return found?.type || b.buildingId;
      });

      const nonConsumableReqs = requiredToolTypes.filter((t) => t !== 'BAIT');
      for (const reqTool of nonConsumableReqs) {
        const hasInBuildings = locBuildingTypes.includes(reqTool);
        const hasInInventory = player.inventory.some((inv) => {
          const types = getItemTypes(inv.itemId);
          return types.includes(reqTool) && (inv.count || 1) > 0;
        });
        if (!hasInBuildings && !hasInInventory) {
          return res.status(400).json({ success: false, message: '缺少採集所需工具！' });
        }
      }

      if (requiredToolTypes.includes('BAIT')) {
        const requiredBaitQty = 1 * addQty;
        const baitEntries = player.inventory.filter((inv) => getItemTypes(inv.itemId).includes('BAIT'));
        const totalBaitCount = baitEntries.reduce((sum, inv) => sum + (inv.count || 1), 0);

        if (totalBaitCount < requiredBaitQty) {
          return res.status(400).json({ success: false, message: '肉餌數量不足！' });
        }

        let remainingToDeduct = requiredBaitQty;
        for (const inv of player.inventory) {
          if (remainingToDeduct <= 0) break;
          if (getItemTypes(inv.itemId).includes('BAIT')) {
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
    }

    const maxEnergy = player.maxEnergy ?? 4320;
    const wasFull = player.energy >= maxEnergy;
    player.energy = Math.round(Math.max(0, player.energy - totalCost) * 10) / 10;
    if (wasFull && player.energy < maxEnergy) {
      player.lastEnergyRecoveredAt = new Date();
    }
    applyEnergyConsumption(player, totalCost);
    player.markModified('stats');

    // 結算生活技能經驗（採集、釣魚、挖礦）
    const spotSkill = spot.skillType || (
      requiredToolTypes.includes('MINING_TOOL')
        ? 'MINING'
        : (requiredToolTypes.includes('FISHING_NET') || requiredToolTypes.includes('LANDING_NET')
          ? 'FISHING'
          : 'GATHERING')
    );

    if (spotSkill) {
      if (!player.lifeSkills) {
        player.lifeSkills = {
          GATHERING: { level: 1, exp: 0 },
          FISHING: { level: 1, exp: 0 },
          MINING: { level: 1, exp: 0 },
          COOKING: { level: 1, exp: 0 },
        };
      }
      const currentSkill = player.lifeSkills[spotSkill] || { level: 1, exp: 0 };
      const expPerUnit = Number(spot.expPerUnit) || 0;
      const expToAdd = expPerUnit > 0 ? (expPerUnit * addQty) : (spot.cost || 1) * addQty;
      const updatedSkill = addLifeSkillExp(currentSkill, expToAdd);
      player.lifeSkills[spotSkill] = {
        level: updatedSkill.level,
        exp: updatedSkill.exp,
      };
      player.markModified('lifeSkills');
    }

    const existingItem = player.inventory.find((i) => i.itemId === itemId);
    if (existingItem) {
      existingItem.count += addQty;
    } else {
      player.inventory.push({
        itemId,
        count: addQty,
        quality: '普通',
      });
    }

    await player.save();
    return res.json({ success: true, source: 'mongodb', data: formatPlayerResponse(player) });
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

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
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

    const connection = (locationDoc?.connections || []).find((c) => c.targetLocationId === targetLocationId);
    if (!connection) {
      return res.status(400).json({ success: false, message: '當前地點無法直接前往該目標地點！' });
    }

    const baseEnergyCost = connection.energyCost ?? 1;
    const energyCost = calculateEffectiveEnergyCost(player, baseEnergyCost);
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

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
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

    const cleanInventory = sanitizeInventoryItems(player.inventory);
    const invItemIds = cleanInventory.map((i) => i.itemId);
    let dbItems = await Item.find({ itemId: { $in: invItemIds } });
    if (!dbItems || dbItems.length === 0) {
      dbItems = initialItems.filter((i) => invItemIds.includes(i.itemId));
    }
    const getItemTypes = (targetItemId) => {
      const found = dbItems.find((d) => d.itemId === targetItemId) || initialItems.find((d) => d.itemId === targetItemId);
      if (!found || !found.type) return [];
      return Array.isArray(found.type) ? found.type : [found.type];
    };

    const invToolTypes = cleanInventory.flatMap((inv) => getItemTypes(inv.itemId));
    const reqTools = recipe.requiredToolTypes || [];
    const hasTools = reqTools.every((t) => locBuildingTypes.includes(t) || invToolTypes.includes(t));
    if (!hasTools) {
      return res.status(400).json({ success: false, message: '缺少合成所需工具！' });
    }

    const baseEnergyCost = (recipe.energyCost || 0) * numCraftQty;
    const totalEnergyCost = calculateEffectiveEnergyCost(player, baseEnergyCost);
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (currentEnergy < totalEnergyCost) {
      return res.status(400).json({ success: false, message: '精力不足！' });
    }

    const reqItems = recipe.requiredItems || [];
    let updatedInv = sanitizeInventoryItems(player.inventory);

    for (let reqIdx = 0; reqIdx < reqItems.length; reqIdx++) {
      const req = reqItems[reqIdx];
      const requiredTotalCount = req.quantity * numCraftQty;
      const selectedId = selectedMaterials[reqIdx];
      if (!selectedId) {
        return res.status(400).json({ success: false, message: '未選擇所需材料！' });
      }

      const invIndex = updatedInv.findIndex((i) => i.itemId === selectedId && (i.count || 1) >= requiredTotalCount);
      if (invIndex < 0) {
        return res.status(400).json({ success: false, message: '材料不足或未持有指定材料！' });
      }

      const invItem = updatedInv[invIndex];
      const types = getItemTypes(invItem.itemId);
      const matchesItem = req.itemId ? invItem.itemId === req.itemId : false;
      const matchesType = req.type ? types.includes(req.type) : false;
      if (!matchesItem && !matchesType) {
        return res.status(400).json({ success: false, message: '所選材料不符合配方需求！' });
      }

      const curCount = invItem.count || 1;
      if (curCount === requiredTotalCount) {
        updatedInv[invIndex] = { ...invItem, count: 0 };
      } else {
        updatedInv[invIndex] = { ...invItem, count: curCount - requiredTotalCount };
      }
    }
    updatedInv = updatedInv.filter((i) => (i.count || 0) > 0);

    let calculatedDurability = -1;
    const firstSelId = selectedMaterials[0];
    if (recipe.durabilityFormula) {
      let matDurability = -1;
      if (firstSelId) {
        const selectedMatInv = updatedInv.find((i) => i.itemId === firstSelId) || player.inventory.find((i) => i.itemId === firstSelId);
        if (selectedMatInv) {
          const matDbItem = dbItems.find((i) => i.itemId === selectedMatInv.itemId) || initialItems.find((i) => i.itemId === selectedMatInv.itemId);
          matDurability = (selectedMatInv.durability !== undefined && selectedMatInv.durability > 0)
            ? selectedMatInv.durability
            : (matDbItem && matDbItem.durability !== undefined && matDbItem.durability > 0 ? matDbItem.durability : -1);
        }
      }
      try {
        const computeFn = new Function('material', `return ${recipe.durabilityFormula};`);
        calculatedDurability = computeFn({ durability: matDurability > 0 ? matDurability : 0 });
      } catch (err) {
        console.error('[Durability Formula Error]', err);
      }
    }

    let allDbItems = await Item.find();
    if (!allDbItems || allDbItems.length === 0) {
      allDbItems = initialItems;
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

    for (let outIdx = 0; outIdx < effectiveOutputs.length; outIdx++) {
      const out = effectiveOutputs[outIdx];
      const finalItemId = out.itemId;
      const addQty = (out.quantity || 1) * numCraftQty;
      const isPrimary = (outIdx === 0);

      const baseDbItem = allDbItems.find((i) => i.itemId === finalItemId) || initialItems.find((i) => i.itemId === finalItemId);
      const customName = isPrimary && customPrefix && baseDbItem ? `${customPrefix}・${baseDbItem.name}` : '';
      const customNameEn = isPrimary && customPrefixEn && baseDbItem ? `${customPrefixEn} ${baseDbItem.nameEn || baseDbItem.name}` : '';
      const finalBonusNutrition = isPrimary && hasBonusNutrition ? bonusNutrition : undefined;

      const existingMatchIndex = updatedInv.findIndex((inv) => {
        if (inv.itemId !== finalItemId) return false;
        if ((inv.customName || '') !== customName) return false;
        const oldDurability = inv.durability !== undefined && inv.durability > 0 ? inv.durability : -1;
        const newDurability = calculatedDurability > 0 ? calculatedDurability : -1;
        if (oldDurability <= 0 && newDurability <= 0) return true;
        if (oldDurability > 0 && newDurability > 0) {
          const minAllowed = oldDurability * 0.9;
          const maxAllowed = oldDurability * 1.1;
          return newDurability >= minAllowed && newDurability <= maxAllowed;
        }
        return false;
      });

      if (existingMatchIndex >= 0) {
        const existingItem = updatedInv[existingMatchIndex];
        const oldCount = existingItem.count || 1;
        const newTotalCount = oldCount + addQty;
        const oldDurability = existingItem.durability !== undefined && existingItem.durability > 0 ? existingItem.durability : -1;

        const updatedItem = {
          ...existingItem,
          count: newTotalCount,
          ...(customName ? { customName, customNameEn } : {}),
          ...(finalBonusNutrition ? { bonusNutrition: finalBonusNutrition } : {}),
        };

        if (oldDurability > 0 && calculatedDurability > 0) {
          const weightedDurability = Math.round(
            (oldDurability * oldCount + calculatedDurability * addQty) / newTotalCount
          );
          updatedItem.durability = weightedDurability;
        } else if (calculatedDurability > 0) {
          updatedItem.durability = calculatedDurability;
        }

        updatedInv[existingMatchIndex] = updatedItem;
      } else {
        const newItem = {
          instanceId: generateInstanceId(),
          itemId: finalItemId,
          count: addQty,
          quality: '普通',
          ...(customName ? { customName, customNameEn } : {}),
          ...(finalBonusNutrition ? { bonusNutrition: finalBonusNutrition } : {}),
        };
        if (calculatedDurability > 0) {
          newItem.durability = calculatedDurability;
        }
        updatedInv.push(newItem);
      }
    }

    let dbQuests = await Quest.find();
    if (!dbQuests || dbQuests.length === 0) {
      dbQuests = initialQuests;
    }
    let updatedQuests = player.quests ? player.quests.map((q) => {
      const qObj = q.toObject ? q.toObject() : { ...q };
      return {
        ...qObj,
        progress: qObj.progress ? qObj.progress.map((p) => ({ ...p })) : [],
      };
    }) : [];

    let hasQuestUpdate = false;
    for (const out of effectiveOutputs) {
      const finalItemId = out.itemId;
      const addQty = (out.quantity || 1) * numCraftQty;

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
    const craftSkill = recipe.skillType || 'COOKING';
    if (craftSkill) {
      if (!player.lifeSkills) {
        player.lifeSkills = {
          GATHERING: { level: 1, exp: 0 },
          FISHING: { level: 1, exp: 0 },
          MINING: { level: 1, exp: 0 },
          COOKING: { level: 1, exp: 0 },
        };
      }
      const currentSkill = player.lifeSkills[craftSkill] || { level: 1, exp: 0 };
      const baseExp = Number(recipe.baseExp) || 0;
      let materialBonusExp = 0;
      if (recipe.ingredientExp && typeof recipe.ingredientExp === 'object') {
        Object.values(selectedMaterials).forEach((matId) => {
          if (matId && recipe.ingredientExp[matId]) {
            materialBonusExp += Number(recipe.ingredientExp[matId]) || 0;
          }
        });
      }
      const totalExpToAdd = (baseExp + materialBonusExp) * numCraftQty;
      if (totalExpToAdd > 0) {
        const updatedSkill = addLifeSkillExp(currentSkill, totalExpToAdd);
        player.lifeSkills[craftSkill] = {
          level: updatedSkill.level,
          exp: updatedSkill.exp,
        };
        player.markModified('lifeSkills');
      }
    }

    await player.save();
    return res.json({ success: true, source: 'mongodb', data: formatPlayerResponse(player) });
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
    const logs = await GameLog.find().sort({ createdAt: -1 }).limit(20);
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
    const { sender, senderEn, text, textEn, type } = req.body;
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const logDoc = await GameLog.create({
      time: timeStr,
      sender: sender || '系統',
      senderEn: senderEn || 'System',
      text: text || '',
      textEn: textEn || '',
      type: type || 'dialogue',
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
    const { locationId, instanceId } = req.body;
    if (!locationId || !instanceId) {
      return res.status(400).json({ success: false, message: '缺少必要參數！' });
    }

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家資料！' });
    }

    // 原子鎖操作：利用 findOneAndUpdate 與 $pull 原子抽取物品
    // 若已被其他玩家先一步撿走，此查詢匹配 0 筆並回傳 null，完全杜絕併發搶奪複製
    const oldLocation = await Location.findOneAndUpdate(
      {
        locationId,
        'placedItems.instanceId': instanceId,
      },
      {
        $pull: { placedItems: { instanceId } },
      },
      {
        returnDocument: 'before',
      }
    );

    if (!oldLocation) {
      return res.status(404).json({ success: false, message: '該物品已被其他人撿起或已不存在！' });
    }

    const itemToPick = (oldLocation.placedItems || []).find((p) => p.instanceId === instanceId);
    if (!itemToPick) {
      return res.status(404).json({ success: false, message: '找不到此道具資料！' });
    }

    player.inventory = sanitizeInventoryItems(player.inventory);
    player.inventory = addItemsToInventory(
      player.inventory,
      itemToPick.itemId,
      itemToPick.count || 1,
      {
        durability: itemToPick.durability,
        quality: itemToPick.quality || '普通',
        customName: itemToPick.customName || '',
        customNameEn: itemToPick.customNameEn || '',
        bonusNutrition: itemToPick.bonusNutrition,
      }
    );
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

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
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

    player.inventory = sanitizeInventoryItems(player.inventory);
    const invIdx = player.inventory.findIndex(
      (i) => (i.instanceId && i.instanceId === itemKey) || i.itemId === itemKey
    );
    if (invIdx < 0) {
      return res.status(400).json({ success: false, message: '背包中沒有該道具！' });
    }

    const invItem = player.inventory[invIdx];
    const availableCount = invItem.count || 1;
    const dropQty = Math.max(1, Math.min(Number(count) || 1, availableCount));

    const droppedItemData = {
      instanceId: generateInstanceId(),
      itemId: invItem.itemId,
      count: dropQty,
      durability: invItem.durability,
      quality: invItem.quality || '普通',
      customName: invItem.customName || '',
      customNameEn: invItem.customNameEn || '',
      bonusNutrition: invItem.bonusNutrition ? { ...invItem.bonusNutrition } : undefined,
    };

    if (availableCount <= dropQty) {
      player.inventory.splice(invIdx, 1);
    } else {
      invItem.count = availableCount - dropQty;
    }
    player.markModified('inventory');

    // 依背包相同堆疊規則將物品加入現場物品
    location.placedItems = addItemToPlacedItems(location.placedItems || [], droppedItemData);
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

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
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

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
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
