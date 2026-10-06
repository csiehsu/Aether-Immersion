import express from 'express';
import mongoose from 'mongoose';
import { Player } from '../models/Player.js';
import { GameLog } from '../models/GameLog.js';
import { Item } from '../models/Item.js';
import { Location } from '../models/Location.js';
import { Recipe } from '../models/Recipe.js';
import { Npc } from '../models/Npc.js';
import { Building } from '../models/Building.js';
import { initialItems } from '../seeds/seedItems.js';
import { initialLocations } from '../seeds/seedLocations.js';
import { initialRecipes } from '../seeds/seedRecipes.js';
import { initialNpcs } from '../seeds/seedNpcs.js';
import { initialBuildings } from '../seeds/seedBuildings.js';
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

const sanitizeInventoryItems = (inventory) => {
  if (!Array.isArray(inventory)) return [];
  const clean = [];
  for (const item of inventory) {
    const raw = item && item.toObject ? item.toObject() : item;
    if (!raw) continue;
    const itemId = raw.itemId || raw.id || '';
    if (!itemId) continue;
    clean.push({
      itemId,
      count: raw.count || 1,
      durability: raw.durability !== undefined ? raw.durability : -1,
      quality: raw.quality || '普通',
    });
  }
  return clean;
};

// GET /api/player
router.get('/player', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法載入玩家資料！' });
    }
    let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
    if (!player) {
      player = await Player.create({
        name: '冒險者',
        isCharacterCreated: false,
        str: 1,
        spd: 1,
        dex: 1,
        level: 1,
        hp: 100,
        maxHp: 100,
        energy: 4320,
        maxEnergy: 4320,
        location: 'AZURE_BAY_PORT',
        knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
      });
      console.log('[MongoDB] Created initial player record in MongoDB.');
    }
    return res.json({ success: true, source: 'mongodb', data: player });
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

    const { name, str, spd, dex } = req.body;

    const nStr = Number(str);
    const nSpd = Number(spd);
    const nDex = Number(dex);

    if (!name || !name.trim()) {
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

    const maxHp = 100 + (nStr - 1) * 10;
    const maxEnergy = 4320;

    const characterData = {
      name: name.trim(),
      str: nStr,
      spd: nSpd,
      dex: nDex,
      level: 1,
      isCharacterCreated: true,
      hp: maxHp,
      maxHp,
      energy: maxEnergy,
      maxEnergy,
      location: 'AZURE_BAY_PORT',
      knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
    };

    let player = await Player.findOne();
    if (player) {
      Object.assign(player, characterData);
      await player.save();
    } else {
      player = await Player.create(characterData);
    }
    return res.json({ success: true, source: 'mongodb', data: player });
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
    let player = await Player.findOne();
    if (player) {
      Object.assign(player, updateData);
      await player.save();
    }
    return res.json({ success: true, source: 'mongodb', data: player });
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
    const { sender, senderEn, text, textEn, type = 'dialogue' } = req.body;
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });

    const newLog = await GameLog.create({
      time: timeStr,
      sender,
      senderEn: senderEn || sender,
      text,
      textEn: textEn || text,
      type,
    });
    return res.json({ success: true, source: 'mongodb', data: newLog });
  } catch (err) {
    console.error('[API Error] POST /api/logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
