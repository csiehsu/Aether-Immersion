import express from 'express';
import mongoose from 'mongoose';
import { Player } from '../models/Player.js';
import { GameLog } from '../models/GameLog.js';
import { Item } from '../models/Item.js';
import { Location } from '../models/Location.js';
import { Recipe } from '../models/Recipe.js';
import { Npc } from '../models/Npc.js';
import { initialItems } from '../seedItems.js';
import { initialLocations } from '../seedLocations.js';
import { initialRecipes } from '../seedRecipes.js';
import { initialNpcs } from '../seedNpcs.js';
import { isDbConnected, fetchCollectionData } from '../utils/dbHelper.js';

const router = express.Router();

// Memory Fallback Store if MongoDB is disconnected
let memoryPlayer = {
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
  locationEn: 'Azure Bay Port',
  knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
  inventory: [
    { id: 'item_001', itemId: 'item001', name: '小魚', nameEn: 'Small Fish', icon: '🐟', count: 1, quality: '普通' },
  ],
};

let memoryLogs = [
  { id: 1, time: '12:00:15', sender: '碼頭老水手', senderEn: 'Old Sailor', text: '「喂！新人，歡迎來到阿埃泰爾港口。」', textEn: '"Ahoy, newcomer! Welcome to Aether Port."', type: 'dialogue' },
  { id: 2, time: '12:01:02', sender: '系統通知', senderEn: 'System', text: '您已進入【阿埃泰爾港口】安全區域。', textEn: 'Entered safe area [Aether Port].', type: 'system' },
];

// GET /api/health
router.get('/health', (req, res) => {
  const connected = isDbConnected();
  res.json({
    status: 'ok',
    mongodb: connected ? 'connected' : 'offline',
    dbName: connected ? mongoose.connection.name : null,
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
    res.status(500).json({ success: false, error: err.message, data: initialItems });
  }
});

// GET /api/locations
router.get('/locations', async (req, res) => {
  try {
    const result = await fetchCollectionData(Location, initialLocations);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/locations:', err);
    res.status(500).json({ success: false, error: err.message, data: initialLocations });
  }
});

// GET /api/recipes
router.get('/recipes', async (req, res) => {
  try {
    const result = await fetchCollectionData(Recipe, initialRecipes);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/recipes:', err);
    res.status(500).json({ success: false, error: err.message, data: initialRecipes });
  }
});

// GET /api/npcs
router.get('/npcs', async (req, res) => {
  try {
    const result = await fetchCollectionData(Npc, initialNpcs);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API Error] GET /api/npcs:', err);
    res.status(500).json({ success: false, error: err.message, data: initialNpcs });
  }
});

// GET /api/player
router.get('/player', async (req, res) => {
  try {
    if (isDbConnected()) {
      let player = await Player.findOne({ isLoggedIn: true }) || await Player.findOne();
      if (!player) {
        player = await Player.create(memoryPlayer);
        console.log('[MongoDB] Initialized new player profile in MongoDB (AetherImmersion)');
      }
      return res.json({ success: true, source: 'mongodb', data: player });
    }
    res.json({ success: true, source: 'memory', data: memoryPlayer });
  } catch (err) {
    console.error('[API Error] GET /api/player:', err);
    res.status(500).json({ success: false, error: err.message, data: memoryPlayer });
  }
});

// POST /api/player/create-character
router.post('/player/create-character', async (req, res) => {
  try {
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
      locationEn: 'Azure Bay Port',
      knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
    };

    if (isDbConnected()) {
      let player = await Player.findOne();
      if (player) {
        Object.assign(player, characterData);
        await player.save();
      } else {
        player = await Player.create(characterData);
      }
      return res.json({ success: true, source: 'mongodb', data: player });
    }

    memoryPlayer = { ...memoryPlayer, ...characterData };
    res.json({ success: true, source: 'memory', data: memoryPlayer });
  } catch (err) {
    console.error('[API Error] POST /api/player/create-character:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/player
router.put('/player', async (req, res) => {
  try {
    const updateData = req.body;
    if (isDbConnected()) {
      let player = await Player.findOne();
      if (player) {
        Object.assign(player, updateData);
        await player.save();
      } else {
        player = await Player.create({ ...memoryPlayer, ...updateData });
      }
      return res.json({ success: true, source: 'mongodb', data: player });
    }
    memoryPlayer = { ...memoryPlayer, ...updateData };
    res.json({ success: true, source: 'memory', data: memoryPlayer });
  } catch (err) {
    console.error('[API Error] PUT /api/player:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/player/gather
router.post('/player/gather', async (req, res) => {
  try {
    const { cost = 5, yieldItem = '堅硬木材', yieldItemEn = 'Hard Timber', icon = '🪵' } = req.body;

    if (isDbConnected()) {
      let player = await Player.findOne();
      if (!player) player = await Player.create(memoryPlayer);

      if (player.energy < cost) {
        return res.status(400).json({ success: false, message: '精力不足！' });
      }

      player.energy = Math.max(0, player.energy - cost);

      const existingItem = player.inventory.find((i) => i.name === yieldItem);
      if (existingItem) {
        existingItem.count += 1;
      } else {
        player.inventory.push({
          id: `item_${Date.now()}`,
          name: yieldItem,
          nameEn: yieldItemEn,
          icon,
          count: 1,
          quality: '普通',
        });
      }

      await player.save();
      return res.json({ success: true, source: 'mongodb', data: player });
    }

    // Memory Fallback
    if (memoryPlayer.energy < cost) {
      return res.status(400).json({ success: false, message: '精力不足！' });
    }
    memoryPlayer.energy = Math.max(0, memoryPlayer.energy - cost);
    const existing = memoryPlayer.inventory.find((i) => i.name === yieldItem);
    if (existing) {
      existing.count += 1;
    } else {
      memoryPlayer.inventory.push({ id: `item_${Date.now()}`, name: yieldItem, nameEn: yieldItemEn, icon, count: 1, quality: '普通' });
    }
    res.json({ success: true, source: 'memory', data: memoryPlayer });
  } catch (err) {
    console.error('[API Error] POST /api/player/gather:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs
router.get('/logs', async (req, res) => {
  try {
    if (isDbConnected()) {
      const logs = await GameLog.find().sort({ createdAt: -1 }).limit(20);
      return res.json({ success: true, source: 'mongodb', data: logs });
    }
    res.json({ success: true, source: 'memory', data: memoryLogs });
  } catch (err) {
    console.error('[API Error] GET /api/logs:', err);
    res.json({ success: false, source: 'memory', data: memoryLogs });
  }
});

// POST /api/logs
router.post('/logs', async (req, res) => {
  try {
    const { sender, senderEn, text, textEn, type = 'dialogue' } = req.body;
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });

    if (isDbConnected()) {
      const newLog = await GameLog.create({
        time: timeStr,
        sender,
        senderEn: senderEn || sender,
        text,
        textEn: textEn || text,
        type,
      });
      return res.json({ success: true, source: 'mongodb', data: newLog });
    }

    const newMemoryLog = { id: Date.now(), time: timeStr, sender, senderEn, text, textEn, type };
    memoryLogs.unshift(newMemoryLog);
    res.json({ success: true, source: 'memory', data: newMemoryLog });
  } catch (err) {
    console.error('[API Error] POST /api/logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
