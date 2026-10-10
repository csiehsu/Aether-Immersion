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
import { Clue } from '../models/Clue.js';
import { initialItems } from '../seeds/seedItems.js';
import { initialLocations } from '../seeds/seedLocations.js';
import { initialRecipes } from '../seeds/seedRecipes.js';
import { initialNpcs } from '../seeds/seedNpcs.js';
import { initialBuildings } from '../seeds/seedBuildings.js';
import { initialBattleSkills } from '../seeds/seedBattleSkills.js';
import { initialQuests } from '../seeds/seedQuests.js';
import { initialClues } from '../seeds/seedClues.js';
import { isDbConnected, fetchCollectionData } from '../utils/dbHelper.js';

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

// GET /api/items
router.get('/items', async (req, res) => {
  try {
    const result = await fetchCollectionData(Item, initialItems);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/items:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

// GET /api/locations
router.get('/locations', async (req, res) => {
  try {
    const result = await fetchCollectionData(Location, initialLocations);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/locations:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

// GET /api/recipes
router.get('/recipes', async (req, res) => {
  try {
    const result = await fetchCollectionData(Recipe, initialRecipes);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/recipes:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

// GET /api/npcs
router.get('/npcs', async (req, res) => {
  try {
    const result = await fetchCollectionData(Npc, initialNpcs);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/npcs:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

// GET /api/buildings
router.get('/buildings', async (req, res) => {
  try {
    const result = await fetchCollectionData(Building, initialBuildings);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/buildings:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

// GET /api/battle-skills
router.get('/battle-skills', async (req, res) => {
  try {
    const result = await fetchCollectionData(BattleSkill, initialBattleSkills);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/battle-skills:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

const sanitizeInventoryItems = (inventory) => {
  if (!Array.isArray(inventory)) return [];
  const clean = [];
  for (const item of inventory) {
    const raw = item && item.toObject ? item.toObject() : item;
    if (!raw) continue;
    const itemId = raw.itemId || raw.id || '';
    if (!itemId) continue;
    const instanceId = raw.instanceId || `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    clean.push({
      instanceId,
      itemId,
      count: raw.count || 1,
      durability: raw.durability !== undefined ? raw.durability : -1,
      quality: raw.quality || '普通',
    });
  }
  return clean;
};

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

const formatPlayerResponse = (playerDoc) => {
  const p = playerDoc.toObject ? playerDoc.toObject() : { ...playerDoc };
  const rawStats = p.stats || {};
  p.stats = {
    strength: rawStats.strength ?? p.str ?? 1,
    speed: rawStats.speed ?? p.spd ?? 1,
    dexerity: rawStats.dexerity ?? p.dex ?? 1,
    maxHp: rawStats.maxHp ?? p.maxHp ?? 100,
    defense: rawStats.defense ?? 0,
  };
  p.skills = Array.isArray(p.skills) && p.skills.length > 0
    ? p.skills
    : [{ skillId: 'NORMAL_ATTACK', level: 1 }];
  p.money = p.money ?? 0;
  p.mentor = p.mentor || 'Martha';
  p.unlockedRecipes = sanitizeUnlockedRecipes(p.unlockedRecipes);
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
        stats: { strength: 1, speed: 1, dexerity: 1, maxHp: 100, defense: 0 },
        skills: [{ skillId: 'NORMAL_ATTACK', level: 1 }],
        level: 1,
        hp: 100,
        money: 0,
        energy: 4320,
        maxEnergy: 4320,
        location: 'AZURE_BAY_PORT',
        knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
      });
      console.log('[MongoDB] Created initial player record in MongoDB.');
    } else if (player.isCharacterCreated) {
      const currentMentor = player.mentor || 'Martha';
      const { newRoomId, shopLocationId } = await ensureCustomRoom(player.name, currentMentor);
      let updated = false;

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

    const { name, mentor, strength, speed, dexerity, str, spd, dex, stats } = req.body;
    const validMentors = ['Martha', 'Garrick', 'Vance', 'Corinne', 'Brock'];
    const selectedMentor = validMentors.includes(mentor) ? mentor : 'Martha';
    const trimmedName = (name || '').trim();

    const nStr = Number(stats?.strength ?? strength ?? str);
    const nSpd = Number(stats?.speed ?? speed ?? spd);
    const nDex = Number(stats?.dexerity ?? dexerity ?? dex);

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

    const maxHp = 100;
    const maxEnergy = 4320;

    const characterData = {
      name: trimmedName,
      mentor: selectedMentor,
      stats: {
        strength: nStr,
        speed: nSpd,
        dexerity: nDex,
        maxHp,
        defense: 0,
      },
      skills: [{ skillId: 'NORMAL_ATTACK', level: 1 }],
      level: 1,
      isCharacterCreated: true,
      hp: maxHp,
      money: 0,
      energy: maxEnergy,
      maxEnergy,
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
      if (updateData.stats) {
        player.stats = {
          ...player.stats?.toObject(),
          ...updateData.stats,
        };
        delete updateData.stats;
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

    const { cost = 5, itemId, qty = 1 } = req.body;
    const addQty = Math.max(1, Number(qty) || 1);

    let player = await Player.findOne();
    if (!player) {
      return res.status(404).json({ success: false, message: '找不到玩家角色！' });
    }

    if (player.energy < cost) {
      return res.status(400).json({ success: false, message: '精力不足！' });
    }

    player.energy = Math.max(0, player.energy - cost);
    player.inventory = sanitizeInventoryItems(player.inventory);

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
    return res.json({ success: true, source: 'mongodb', data: player });
  } catch (err) {
    console.error('[API Error] POST /api/player/gather:', err);
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

// GET /api/quests
router.get('/quests', async (req, res) => {
  try {
    const result = await fetchCollectionData(Quest, initialQuests);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/quests:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

// GET /api/clues
router.get('/clues', async (req, res) => {
  try {
    const result = await fetchCollectionData(Clue, initialClues);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/clues:', err);
    res.status(503).json({ success: false, error: err.message });
  }
});

// POST /api/location/pickup-item
router.post('/location/pickup-item', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線！' });
    }
    const { locationId, instanceId } = req.body;
    const location = await Location.findOne({ locationId });
    if (!location) {
      return res.status(404).json({ success: false, message: '找不到該地點！' });
    }

    const placedIndex = location.placedItems.findIndex((p) => p.instanceId === instanceId);
    if (placedIndex < 0) {
      return res.status(404).json({ success: false, message: '該地點找不到此道具！' });
    }

    const itemToPick = location.placedItems[placedIndex];
    location.placedItems.splice(placedIndex, 1);
    await location.save();

    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
    if (player) {
      player.inventory = sanitizeInventoryItems(player.inventory);
      const newInstId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      player.inventory.push({
        instanceId: newInstId,
        itemId: itemToPick.itemId,
        count: 1,
        quality: '普通',
      });
      await player.save();
    }

    const allLocations = await Location.find({});
    return res.json({ success: true, data: formatPlayerResponse(player), locations: allLocations });
  } catch (err) {
    console.error('[API Error] POST /api/location/pickup-item:', err);
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

      const grants = quest.grantsOnAccept || {};
      if (grants.items && grants.items.length > 0) {
        player.inventory = sanitizeInventoryItems(player.inventory);
        for (const gItem of grants.items) {
          player.inventory.push({
            instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
    }

    if (instanceId && locationId) {
      const location = await Location.findOne({ locationId });
      if (location) {
        const placedIndex = location.placedItems.findIndex((p) => p.instanceId === instanceId);
        if (placedIndex >= 0) {
          const itemToPick = location.placedItems[placedIndex];
          location.placedItems.splice(placedIndex, 1);
          await location.save();

          player.inventory = sanitizeInventoryItems(player.inventory);
          const newInstId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          player.inventory.push({
            instanceId: newInstId,
            itemId: itemToPick.itemId,
            count: 1,
            quality: '普通',
          });
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
    if (rewards.items && rewards.items.length > 0) {
      player.inventory = sanitizeInventoryItems(player.inventory);
      for (const rItem of rewards.items) {
        player.inventory.push({
          instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          itemId: rItem.itemId,
          count: rItem.count || 1,
          quality: rItem.quality || '普通',
        });
      }
    }
    if (rewards.unlockedLocations && rewards.unlockedLocations.length > 0) {
      for (const locId of rewards.unlockedLocations) {
        if (!player.knownLocations.includes(locId)) {
          player.knownLocations.push(locId);
        }
      }
    }
    if (rewards.unlockedRecipes && rewards.unlockedRecipes.length > 0) {
      const toAdd = sanitizeUnlockedRecipes(rewards.unlockedRecipes);
      player.unlockedRecipes = sanitizeUnlockedRecipes(player.unlockedRecipes);
      for (const item of toAdd) {
        if (!player.unlockedRecipes.some((r) => r.recipeId === item.recipeId)) {
          player.unlockedRecipes.push(item);
        }
      }
    }

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

          const grants = nextQuest.grantsOnAccept || {};
          if (grants.items && grants.items.length > 0) {
            player.inventory = sanitizeInventoryItems(player.inventory);
            for (const gItem of grants.items) {
              player.inventory.push({
                instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
