import { create } from 'zustand';
import { translations } from '../constants/translations';
import {
  normalizePlayerStats,
  addItemsToInventory,
  calculateCombatTurn,
} from '../utils/gameHelpers';

export { translations };

const API_BASE = 'http://localhost:5000/api';

/**
 * 從後端 API 載入特定集合資料並寫入 Zustand Store。
 * @param {string} endpoint - API 端點路徑（例如 '/items'）。
 * @param {string} stateKey - Store 中對應的 state 屬性名稱。
 * @param {Function} set - Zustand set 狀態更新函式。
 * @returns {Promise<Array<Object>|null>} 成功回傳資料陣列，失敗或離線回傳 null。
 */
const fetchCollection = async (endpoint, stateKey, set) => {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        set({ [stateKey]: result.data });
        return result.data;
      }
    } else {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  } catch (err) {
    console.error(`[Fetch ${stateKey} Error]`, err);
    set({ mongoStatus: 'offline', isDisconnected: true });
  }
  return null;
};

export const useGameStore = create((set, get) => ({
  // Screen Mode ('login' | 'character_creation' | 'game')
  screenMode: 'login',

  // View Mode ('auto' | 'desktop' | 'mobile')
  viewMode: 'auto',
  /**
   * 設定版面顯示模式。
   * @param {'auto' | 'desktop' | 'mobile'} mode - 顯示模式。
   */
  setViewMode: (mode) => set({ viewMode: mode }),

  // MongoDB Connection Status ('connecting' | 'connected' | 'offline')
  mongoStatus: 'connecting',
  isDisconnected: false,

  // Google User Auth State
  user: {
    isLoggedIn: false,
    name: '',
    email: '',
    pictureUrl: null,
  },

  // Language setting ('zh-TW' | 'en')
  language: 'zh-TW',
  /**
   * 設定介面語言語系。
   * @param {'zh-TW' | 'en'} lang - 語系代碼。
   */
  setLanguage: (lang) => set({ language: lang }),

  // Player Stats (Loaded live from MongoDB Atlas)
  player: null,

  // Active Tab for Mobile/Portrait view
  activeTab: 'move',
  /**
   * 設定行動版/直式螢幕下的當前分頁標籤。
   * @param {string} tab - 分頁識別名稱。
   */
  setActiveTab: (tab) => set({ activeTab: tab }),

  // MongoDB Items Data (Strictly empty, loaded live from MongoDB Atlas)
  items: [],

  // MongoDB Locations Data (Strictly empty, loaded live from MongoDB Atlas)
  locations: [],

  // Crafting Recipes Data (Strictly empty, loaded live from MongoDB Atlas)
  recipes: [],

  // Inventory Items (Strictly empty, loaded live from MongoDB Atlas)
  inventory: [],

  // Creatures / Monsters Data (Strictly empty, loaded live from MongoDB Atlas)
  creatures: [],

  buildings: [],

  battleSkills: [],

  questsList: [],

  logs: [],

  isBattling: false,

  /**
   * 建立玩家角色並初始化三維能力值與導師房間。
   * @param {string} name - 角色名稱。
   * @param {number|Object} str - 力量數值或包含三維能力的物件。
   * @param {number} [spd] - 速度數值。
   * @param {number} [dex] - 靈巧數值。
   * @param {string} [mentor='Martha'] - 選擇的引路導師名稱。
   * @returns {Promise<boolean>} 建立成功回傳 true，失敗回傳 false。
   */
  createCharacter: async (name, str, spd, dex, mentor = 'Martha') => {
    const strength = typeof str === 'object' ? str.strength : str;
    const speed = typeof str === 'object' ? str.speed : spd;
    const dexVal = typeof str === 'object' ? str.dexterity : (dex ?? 1);

    try {
      const res = await fetch(`${API_BASE}/player/create-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          mentor,
          stats: {
            strength,
            speed,
            dexterity: dexVal,
            water: 100,
            food: 100,
          },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const dbP = result.data;
          const stats = normalizePlayerStats(dbP.stats, {
            strength,
            speed,
            dexterity: dexVal,
            maxHp: dbP.maxHp ?? 100,
            water: 100,
            food: 100,
          });

          await get().fetchLocations();

          set((state) => ({
            player: {
              ...state.player,
              name: dbP.name,
              mentor: dbP.mentor || mentor,
              stats,
              skills: dbP.skills || [{ skillId: 'NORMAL_ATTACK', level: 1 }],
              str: stats.strength,
              spd: stats.speed,
              dex: stats.dexterity,
              maxHp: stats.maxHp,
              level: 1,
              isCharacterCreated: true,
              hp: dbP.hp,
              money: dbP.money ?? 0,
              energy: dbP.energy,
              maxEnergy: dbP.maxEnergy,
              location: dbP.location,
              knownLocations: dbP.knownLocations || [],
            },
            screenMode: 'game',
          }));

          return true;
        }
      }
    } catch (err) {
      console.error('[Create Character Error]:', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
    return false;
  },

  /**
   * 使用 Google OAuth Credential Token 進行登入驗證並同步玩家資料。
   * @param {string} credential - Google OAuth Credential JWT 字串。
   * @returns {Promise<boolean>} 登入成功回傳 true，失敗回傳 false。
   */
  loginWithGoogle: async (credential) => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.user) {
          const gUser = result.user;
          const dbP = result.player;
          const stats = normalizePlayerStats(dbP?.stats, {
            strength: dbP?.str,
            speed: dbP?.spd,
            dexterity: dbP?.dex,
            maxHp: dbP?.maxHp,
            water: 100,
            food: 100,
          });

          set((state) => ({
            user: {
              isLoggedIn: true,
              name: gUser.name,
              email: gUser.email,
              pictureUrl: gUser.picture,
            },
            player: {
              ...state.player,
              name: dbP?.name || gUser.name,
              isCharacterCreated: dbP ? dbP.isCharacterCreated : false,
              stats,
              skills: dbP?.skills || [{ skillId: 'NORMAL_ATTACK', level: 1 }],
              str: stats.strength,
              spd: stats.speed,
              dex: stats.dexterity,
              maxHp: stats.maxHp,
              level: dbP?.level ?? 1,
              hp: dbP?.hp ?? 100,
              money: dbP?.money ?? 0,
              energy: dbP?.energy ?? 4320,
              maxEnergy: dbP?.maxEnergy ?? 4320,
              location: dbP?.location || 'AZURE_BAY_PORT',
            },
            screenMode: dbP && dbP.isCharacterCreated ? 'game' : 'character_creation',
          }));
          return true;
        }
      }
    } catch (err) {
      console.error('[Google Auth Error]:', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
    return false;
  },

  /**
   * 登出當前帳號並重設登入狀態至登入畫面。
   * @returns {Promise<void>}
   */
  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // Ignore network errors when logging out offline
    }

    set({
      user: { isLoggedIn: false, name: '', email: '', pictureUrl: null },
      screenMode: 'login',
    });
  },

  /**
   * 檢查後端與 MongoDB 資料庫的健康狀態。
   * @returns {Promise<'connected' | 'offline'>} 資料庫連線狀態。
   */
  checkMongoStatus: async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        const status = data.mongodb === 'connected' ? 'connected' : 'offline';
        set({ mongoStatus: status, isDisconnected: status === 'offline' });
        return status;
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
    set({ mongoStatus: 'offline', isDisconnected: true });
    return 'offline';
  },

  /** 載入全域道具集合清單 */
  fetchItems: () => fetchCollection('/items', 'items', set),
  /** 載入全域地點集合清單 */
  fetchLocations: () => fetchCollection('/locations', 'locations', set),
  /** 載入全域合成配方集合清單 */
  fetchRecipes: () => fetchCollection('/recipes', 'recipes', set),
  /** 載入全域 NPC/生物集合清單 */
  fetchNpcs: () => fetchCollection('/npcs', 'creatures', set),
  /** 載入全域建築設施集合清單 */
  fetchBuildings: () => fetchCollection('/buildings', 'buildings', set),
  /** 載入全域戰鬥技能集合清單 */
  fetchBattleSkills: () => fetchCollection('/battle-skills', 'battleSkills', set),
  /** 載入全域任務集合清單 */
  fetchQuests: () => fetchCollection('/quests', 'questsList', set),

  /**
   * 與後端 MongoDB 同步所有遊戲資料（道具、地點、配方、NPC、技能、任務、玩家資料與日誌）。
   * @returns {Promise<void>}
   */
  syncFromMongo: async () => {
    try {
      const status = await get().checkMongoStatus();
      if (status === 'offline') {
        set({ isDisconnected: true });
        return;
      }

      await Promise.all([
        get().fetchItems(),
        get().fetchLocations(),
        get().fetchRecipes(),
        get().fetchNpcs(),
        get().fetchBuildings(),
        get().fetchBattleSkills(),
        get().fetchQuests(),
      ]);

      const res = await fetch(`${API_BASE}/player`);
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
        return;
      }
      const result = await res.json();
      if (result.success && result.data) {
        const dbP = result.data;
        const stats = normalizePlayerStats(dbP.stats, dbP);

        set((state) => {
          const isCreated = dbP.isCharacterCreated || false;
          const nextScreen = !dbP.isLoggedIn ? 'login' : !isCreated ? 'character_creation' : 'game';

          return {
            isDisconnected: false,
            player: {
              ...state.player,
              name: dbP.name || state.player?.name || '冒險者',
              isCharacterCreated: isCreated,
              stats,
              skills: dbP.skills || [{ skillId: 'NORMAL_ATTACK', level: 1 }],
              str: stats.strength,
              spd: stats.speed,
              dex: stats.dexterity,
              maxHp: stats.maxHp,
              hp: dbP.hp ?? state.player?.hp ?? stats.maxHp ?? 100,
              money: dbP.money ?? state.player?.money ?? 0,
              energy: dbP.energy ?? state.player?.energy ?? 4320,
              maxEnergy: dbP.maxEnergy ?? state.player?.maxEnergy ?? 4320,
              level: dbP.level ?? 1,
              location: dbP.location || state.player?.location || 'AZURE_BAY_PORT',
              mentor: dbP.mentor || state.player?.mentor || 'Martha',
              knownLocations: dbP.knownLocations || state.player?.knownLocations || [],
              quests: dbP.quests || [],
            },
            user: dbP.isLoggedIn
              ? { isLoggedIn: true, name: dbP.name, email: dbP.email, pictureUrl: dbP.pictureUrl }
              : state.user,
            screenMode: dbP.isLoggedIn ? nextScreen : state.screenMode,
            inventory: dbP.inventory || [],
          };
        });
      }

      const logRes = await fetch(`${API_BASE}/logs`);
      if (logRes.ok) {
        const logData = await logRes.json();
        if (logData.success && logData.data) {
          set({ logs: logData.data });
        }
      }
    } catch (err) {
      console.error('[MongoDB Sync Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  /**
   * 新增一筆對話或系統訊息紀錄，並寫入後端 MongoDB。
   * @param {string} sender - 發送者中文名稱。
   * @param {string} [senderEn] - 發送者英文名稱。
   * @param {string} text - 中文訊息內容。
   * @param {string} [textEn] - 英文訊息內容。
   * @param {'dialogue' | 'system' | 'combat'} [type='dialogue'] - 紀錄類型。
   * @returns {Promise<void>}
   */
  addLog: async (sender, senderEn, text, textEn, type = 'dialogue') => {
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const newEntry = { id: `${Date.now()}-${Math.random()}`, time: timeStr, sender, senderEn, text, textEn, type };

    set((state) => ({
      logs: [newEntry, ...state.logs],
    }));

    try {
      const res = await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, senderEn, text, textEn, type }),
      });
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  /**
   * 切換玩家目前所在場景地點，並扣除相應的精力消耗。
   * @param {string} targetLocId - 目標地點識別碼。
   * @returns {Promise<void>}
   */
  changeLocation: async (targetLocId) => {
    const { locations, player } = get();
    if (!player) return;

    const currentLoc = locations.find((l) => l.locationId === player.location);
    const connection = currentLoc?.connections?.find((c) => c.targetLocationId === targetLocId);
    const cost = connection?.energyCost ?? 1;

    if (player.energy < cost) {
      return;
    }

    const newEnergy = player.energy - cost;

    set((state) => ({
      player: {
        ...state.player,
        location: targetLocId,
        energy: newEnergy,
      },
    }));

    try {
      const res = await fetch(`${API_BASE}/player`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: targetLocId,
          energy: newEnergy,
        }),
      });
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  /**
   * 執行場景資源採集，扣除總精力消耗並將採集道具加入背包。
   * @param {string} itemId - 採集獲得之道具識別碼。
   * @param {number} cost - 單次採集精力消耗。
   * @param {number} [qty=1] - 採集次數/數量。
   * @returns {Promise<void>}
   */
  performGather: async (itemId, cost, qty = 1) => {
    const { player } = get();
    const addQty = Math.max(1, Number(qty) || 1);
    const totalCost = cost * addQty;

    if (player.energy < totalCost) {
      return;
    }

    set((state) => ({
      player: { ...state.player, energy: state.player.energy - totalCost },
      inventory: addItemsToInventory(state.inventory, itemId, addQty),
    }));

    try {
      const res = await fetch(`${API_BASE}/player/gather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: totalCost, itemId, qty: addQty }),
      });
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  /**
   * 執行物品合成/製作：檢查設施需求、扣除材料與精力、產生產物並推進 CRAFT 類型任務進度。
   * @param {Object} recipe - 合成配方定義物件。
   * @param {Object} [selectedMaterials={}] - 玩家選擇投入的材料字典。
   * @param {number} [craftQty=1] - 批量製作數量。
   * @returns {Promise<boolean>} 合成成功回傳 true，材料不足或條件不符回傳 false。
   */
  performCraft: async (recipe, selectedMaterials = {}, craftQty = 1) => {
    const { player, inventory, items, locations, buildings } = get();
    if (!player || !recipe) return false;

    const numCraftQty = Math.max(1, Number(craftQty) || 1);

    const currentLocation = locations.find((l) => l.locationId === player.location);
    const locBuildingList = currentLocation?.buildings || [];
    const locBuildingTypes = locBuildingList.map((b) => {
      const dbB = buildings.find((item) => item.buildingId === b.buildingId);
      return dbB ? dbB.type : b.buildingId;
    });

    const invToolTypes = inventory.flatMap((inv) => {
      const dbI = items.find((i) => i.itemId === inv.itemId);
      if (!dbI || !dbI.type) return [];
      return Array.isArray(dbI.type) ? dbI.type : [dbI.type];
    });

    const reqTools = recipe.requiredToolTypes || [];
    const hasTools = reqTools.every(
      (t) => locBuildingTypes.includes(t) || invToolTypes.includes(t)
    );

    if (!hasTools) {
      return false;
    }

    const energyCost = (recipe.energyCost || 0) * numCraftQty;
    const currentEnergy = player.energy ?? 0;
    if (currentEnergy < energyCost) {
      return false;
    }
    const newEnergy = Math.max(0, currentEnergy - energyCost);

    const reqItems = recipe.requiredItems || [];
    let updatedInv = inventory.map((item) => ({ ...item }));

    for (let reqIdx = 0; reqIdx < reqItems.length; reqIdx++) {
      const req = reqItems[reqIdx];
      const requiredTotalCount = req.quantity * numCraftQty;
      const selectedId = selectedMaterials[reqIdx];

      if (!selectedId) {
        return false;
      }

      const invIndex = updatedInv.findIndex(
        (i) => i.itemId === selectedId
      );

      if (invIndex < 0) {
        return false;
      }

      const invItem = updatedInv[invIndex];
      const dbI = items.find((i) => i.itemId === invItem.itemId);
      const types = dbI && dbI.type ? (Array.isArray(dbI.type) ? dbI.type : [dbI.type]) : [];

      const matchesItem = req.itemId ? invItem.itemId === req.itemId : false;
      const matchesType = req.type ? types.includes(req.type) : false;

      if (!matchesItem && !matchesType) {
        return false;
      }

      const curCount = invItem.count || 1;
      if (curCount < requiredTotalCount) {
        return false;
      }

      if (curCount === requiredTotalCount) {
        updatedInv[invIndex] = { ...invItem, count: 0 };
      } else {
        updatedInv[invIndex] = { ...invItem, count: curCount - requiredTotalCount };
      }
    }

    updatedInv = updatedInv.filter((i) => i.count > 0);

    let calculatedDurability = -1;
    const firstSelId = selectedMaterials[0];
    if (recipe.durabilityFormula) {
      let matDurability = -1;
      if (firstSelId) {
        const selectedMatInv = inventory.find((i) => i.itemId === firstSelId);
        if (selectedMatInv) {
          const matDbItem = items.find((i) => i.itemId === selectedMatInv.itemId);
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

    const outputItems = recipe.outputItems || [];
    for (const out of outputItems) {
      const outItemId = out.itemId || recipe.recipeId;
      const dbOut = items.find(
        (i) => i.itemId === outItemId || (out.type && i.type === out.type) || (out.type && Array.isArray(i.type) && i.type.includes(out.type)) || i.name === recipe.name
      );
      const finalItemId = out.itemId || (dbOut ? dbOut.itemId : recipe.recipeId);
      const addQty = (out.quantity || 1) * numCraftQty;

      const existingMatchIndex = updatedInv.findIndex((inv) => {
        if (inv.itemId !== finalItemId) {
          return false;
        }

        const oldDurability = inv.durability !== undefined && inv.durability > 0 ? inv.durability : -1;
        const newDurability = calculatedDurability > 0 ? calculatedDurability : -1;

        if (oldDurability <= 0 && newDurability <= 0) {
          return true;
        }

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
          instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          itemId: finalItemId,
          count: addQty,
          quality: '普通',
        };

        if (calculatedDurability > 0) {
          newItem.durability = calculatedDurability;
        }

        updatedInv.push(newItem);
      }
    }

    const questsList = get().questsList || [];
    let updatedQuests = player.quests ? player.quests.map((q) => ({
      ...q,
      progress: q.progress ? q.progress.map((p) => ({ ...p })) : [],
    })) : [];

    let hasQuestUpdate = false;
    for (const out of outputItems) {
      const outItemId = out.itemId || recipe.recipeId;
      const dbOut = items.find(
        (i) => i.itemId === outItemId || (out.type && i.type === out.type) || (out.type && Array.isArray(i.type) && i.type.includes(out.type)) || i.name === recipe.name
      );
      const finalItemId = out.itemId || (dbOut ? dbOut.itemId : recipe.recipeId);
      const addQty = (out.quantity || 1) * numCraftQty;

      for (const q of updatedQuests) {
        if (q.status !== 'IN_PROGRESS') continue;
        const qDef = (questsList || []).find((def) => def.questId === q.questId);
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

    set((state) => ({
      inventory: updatedInv,
      player: {
        ...state.player,
        energy: newEnergy,
        ...(hasQuestUpdate ? { quests: updatedQuests } : {}),
      },
    }));

    try {
      await fetch(`${API_BASE}/player`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory: updatedInv,
          energy: newEnergy,
          ...(hasQuestUpdate ? { quests: updatedQuests } : {}),
        }),
      });
    } catch (err) {
      console.error('[Craft Sync Error]', err);
    }

    return true;
  },

  /**
   * 使用/消耗背包中的道具：累加道具營養值 (nutrition) 至玩家各項能力值（包含 water 與 food），並扣除道具數量。
   * @param {string} inventoryItemId - 背包中欲使用的道具識別碼。
   * @param {number} [qty=1] - 使用數量。
   * @returns {Promise<boolean>} 使用成功回傳 true，未找到道具或失敗回傳 false。
   */
  consumeItem: async (inventoryItemId, qty = 1) => {
    const { player, inventory, items } = get();
    if (!player || !inventoryItemId) return false;

    const invIndex = inventory.findIndex(
      (i) => i.itemId === inventoryItemId
    );
    if (invIndex < 0) return false;

    const invItem = inventory[invIndex];
    const dbItem = items.find(
      (i) => i.itemId === invItem.itemId
    );

    const availableCount = invItem.count || 1;
    const useCount = Math.min(availableCount, Math.max(1, Number(qty) || 1));

    const nutrition = dbItem?.nutrition || {};
    const hpGain = (nutrition.hp || 0) * useCount;
    const strGain = (nutrition.strength || 0) * useCount;
    const spdGain = (nutrition.speed || 0) * useCount;
    const dexGain = (nutrition.dexterity || 0) * useCount;
    const defGain = (nutrition.defense || 0) * useCount;
    const maxHpGain = (nutrition.maxHp || 0) * useCount;
    const waterGain = (nutrition.water || 0) * useCount;
    const foodGain = (nutrition.food || 0) * useCount;

    // Retrieve baseline current stats from player (stats are baseline, never overwritten by item nutrition)
    const currentStats = player.stats || {};
    const currentStr = currentStats.strength ?? player.str ?? 1;
    const currentSpd = currentStats.speed ?? player.spd ?? 1;
    const currentDex = currentStats.dexterity ?? player.dex ?? 1;
    const currentDef = currentStats.defense ?? 0;
    const currentMaxHp = currentStats.maxHp ?? player.maxHp ?? 100;
    const currentWater = currentStats.water ?? 100;
    const currentFood = currentStats.food ?? 100;
    const currentHp = player.hp ?? 100;

    // Add nutrition values onto player stats (accumulating rather than replacing)
    const newStr = Math.round((currentStr + strGain) * 100) / 100;
    const newSpd = Math.round((currentSpd + spdGain) * 100) / 100;
    const newDex = Math.round((currentDex + dexGain) * 100) / 100;
    const newDef = Math.round((currentDef + defGain) * 100) / 100;
    const newMaxHp = Math.round((currentMaxHp + maxHpGain) * 100) / 100;
    const newWater = Math.round((currentWater + waterGain) * 100) / 100;
    const newFood = Math.round((currentFood + foodGain) * 100) / 100;

    const newHp = hpGain !== 0
      ? Math.max(0, Math.min(newMaxHp, currentHp + hpGain))
      : Math.min(newMaxHp, currentHp);

    let updatedInv = [...inventory];
    if (availableCount <= useCount) {
      updatedInv.splice(invIndex, 1);
    } else {
      updatedInv[invIndex] = {
        ...invItem,
        count: availableCount - useCount,
      };
    }

    const newStats = {
      ...currentStats,
      strength: newStr,
      speed: newSpd,
      dexterity: newDex,
      defense: newDef,
      maxHp: newMaxHp,
      water: newWater,
      food: newFood,
    };

    set((state) => ({
      player: {
        ...state.player,
        hp: newHp,
        str: newStr,
        spd: newSpd,
        dex: newDex,
        stats: newStats,
      },
      inventory: updatedInv,
    }));

    const itemName = dbItem ? dbItem.name : invItem.itemId;
    const itemNameEn = dbItem ? (dbItem.nameEn || dbItem.name) : invItem.itemId;

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

    const effectStr = effects.length > 0 ? ` (${effects.join(', ')})` : '';
    const effectStrEn = effectsEn.length > 0 ? ` (${effectsEn.join(', ')})` : '';

    get().addLog(
      '道具系統',
      'Item System',
      `使用了 [${itemName}] x${useCount}${effectStr}。`,
      `Used [${itemNameEn}] x${useCount}${effectStrEn}.`,
      'event'
    );

    try {
      const res = await fetch(`${API_BASE}/player`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hp: newHp,
          str: newStr,
          spd: newSpd,
          dex: newDex,
          stats: newStats,
          inventory: updatedInv,
        }),
      });
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
      } else {
        const result = await res.json();
        if (result.success && result.data) {
          const dbP = result.data;
          const syncedStats = normalizePlayerStats(dbP.stats, dbP);
          set((state) => ({
            player: {
              ...state.player,
              stats: syncedStats,
              str: syncedStats.strength,
              spd: syncedStats.speed,
              dex: syncedStats.dexterity,
              maxHp: syncedStats.maxHp,
              hp: dbP.hp ?? state.player.hp,
              energy: dbP.energy ?? state.player.energy,
            },
          }));
        }
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }

    return true;
  },

  /**
   * 向指定 NPC 購買商品：扣除金錢並新增道具至背包。
   * @param {Object} npc - 交易 NPC 物件。
   * @param {string} itemId - 購買道具識別碼。
   * @param {number} price - 單價。
   * @param {number} [qty=1] - 購買數量。
   * @returns {Promise<boolean>} 購買成功回傳 true，金錢不足或無效參數回傳 false。
   */
  performBuy: async (npc, itemId, price, qty = 1) => {
    const { player, inventory } = get();
    if (!player || !npc || !itemId) return false;

    const buyQty = Math.max(1, Number(qty) || 1);
    const unitPrice = Math.max(0, Number(price) || 0);
    const totalCost = unitPrice * buyQty;

    const currentMoney = player.money ?? 0;
    if (currentMoney < totalCost) {
      return false;
    }

    const newMoney = currentMoney - totalCost;
    const updatedInv = addItemsToInventory(inventory, itemId, buyQty);

    set((state) => ({
      player: {
        ...state.player,
        money: newMoney,
      },
      inventory: updatedInv,
    }));

    try {
      const res = await fetch(`${API_BASE}/player`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          money: newMoney,
          inventory: updatedInv,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set((state) => ({
            player: {
              ...state.player,
              money: result.data.money ?? newMoney,
            },
          }));
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Buy Sync Error]', err);
    }

    return true;
  },

  /**
   * 向指定 NPC 出售背包中的道具：扣除背包道具並增加金錢。
   * @param {Object} npc - 交易 NPC 物件。
   * @param {string} itemId - 出售道具識別碼。
   * @param {number} price - 收購單價。
   * @param {number} [qty=1] - 出售數量。
   * @returns {Promise<boolean>} 出售成功回傳 true，持有數量不足回傳 false。
   */
  performSell: async (npc, itemId, price, qty = 1) => {
    const { player, inventory } = get();
    if (!player || !npc || !itemId) return false;

    const sellQty = Math.max(1, Number(qty) || 1);
    const unitPrice = Math.max(0, Number(price) || 0);
    const totalGain = unitPrice * sellQty;

    const existingIdx = inventory.findIndex((i) => i.itemId === itemId);
    if (existingIdx < 0) {
      return false;
    }

    const currentOwned = inventory[existingIdx].count || 1;
    if (currentOwned < sellQty) {
      return false;
    }

    const currentMoney = player.money ?? 0;
    const newMoney = currentMoney + totalGain;

    let updatedInv = [...inventory];
    if (currentOwned <= sellQty) {
      updatedInv.splice(existingIdx, 1);
    } else {
      updatedInv[existingIdx] = {
        ...updatedInv[existingIdx],
        count: currentOwned - sellQty,
      };
    }

    set((state) => ({
      player: {
        ...state.player,
        money: newMoney,
      },
      inventory: updatedInv,
    }));

    try {
      const res = await fetch(`${API_BASE}/player`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          money: newMoney,
          inventory: updatedInv,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set((state) => ({
            player: {
              ...state.player,
              money: result.data.money ?? newMoney,
            },
          }));
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Sell Sync Error]', err);
    }

    return true;
  },

  /**
   * 拾取場景中的地面放置道具 (Placed Item) 並同步更新背包與地點狀態。
   * @param {string} locationId - 地點識別碼。
   * @param {string} instanceId - 放置道具實體識別碼。
   * @returns {Promise<void>}
   */
  pickUpPlacedItem: async (locationId, instanceId) => {
    try {
      const res = await fetch(`${API_BASE}/location/pickup-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, instanceId }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set((state) => ({
            player: {
              ...state.player,
              ...result.data,
            },
            inventory: result.data.inventory || state.inventory,
            locations: result.locations || state.locations,
          }));
        }
      }
    } catch (err) {
      console.error('[Pickup Item Error]', err);
    }
  },

  /**
   * 取得 NPC 的在地化顯示名稱。
   * @param {string} npcId - NPC 識別碼。
   * @returns {string} 在地化 NPC 名稱。
   */
  getNpcDisplayName: (npcId) => {
    const { creatures, language } = get();
    if (!npcId) return language === 'en' ? 'NPC' : 'NPC';
    const npc = (creatures || []).find((c) => (c.npcId || c.id) === npcId);
    if (npc) {
      return language === 'en' ? (npc.nameEn || npc.name || npcId) : (npc.name || npcId);
    }
    if (npcId === 'Brock') return language === 'en' ? 'Brock' : '布洛克';
    if (npcId === 'Garrick') return language === 'en' ? 'Garrick' : '加利克';
    return npcId;
  },

  /**
   * 接取任務：建立任務進度、發放接取獎勵（如道具、解鎖地點/配方）並記錄對話日誌。
   * @param {string} questId - 任務識別碼。
   * @param {string} [locationId=''] - 觸發任務的地點識別碼（若由放置道具觸發）。
   * @param {string} [instanceId=''] - 觸發任務的放置道具實體識別碼。
   * @returns {Promise<void>}
   */
  acceptQuest: async (questId, locationId = '', instanceId = '') => {
    try {
      const res = await fetch(`${API_BASE}/quest/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId, locationId, instanceId }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set((state) => ({
            player: {
              ...state.player,
              ...result.data,
            },
            inventory: result.data.inventory || state.inventory,
            locations: result.locations || state.locations,
          }));

          if (result.quest && result.quest.description) {
            const npcId = result.quest.triggerNpcId || result.quest.submitNpcId || 'Brock';
            const senderName = get().getNpcDisplayName(npcId);
            get().addLog(senderName, senderName, result.quest.description, result.quest.description, 'dialogue');
          }
        }
      }
    } catch (err) {
      console.error('[Accept Quest Error]', err);
    }
  },

  /**
   * 透過撿起場景中的放置道具接取關聯任務。
   * @param {string} questId - 任務識別碼。
   * @param {string} locationId - 地點識別碼。
   * @param {string} instanceId - 放置道具實體識別碼。
   * @returns {Promise<void>}
   */
  acceptQuestFromPlacedItem: async (questId, locationId, instanceId) => {
    return get().acceptQuest(questId, locationId, instanceId);
  },

  /**
   * 提交並完成任務：發放金錢與道具獎勵、解鎖後續地點與配方，並處理連鎖自動接取任務。
   * @param {string} questId - 任務識別碼。
   * @returns {Promise<void>}
   */
  submitQuest: async (questId) => {
    try {
      const res = await fetch(`${API_BASE}/quest/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set((state) => ({
            player: {
              ...state.player,
              ...result.data,
            },
            inventory: result.data.inventory || state.inventory,
            locations: result.locations || state.locations,
          }));

          if (result.completeText) {
            const senderName = get().getNpcDisplayName(result.submitNpcId);
            get().addLog(senderName, senderName, result.completeText, result.completeText, 'dialogue');
          }

          if (result.autoTriggeredQuest && result.autoTriggeredQuest.description) {
            const nextNpcId = result.autoTriggeredQuest.triggerNpcId || result.autoTriggeredQuest.submitNpcId;
            const nextSenderName = get().getNpcDisplayName(nextNpcId);
            get().addLog(nextSenderName, nextSenderName, result.autoTriggeredQuest.description, result.autoTriggeredQuest.description, 'dialogue');
          }
        }
      }
    } catch (err) {
      console.error('[Submit Quest Error]', err);
    }
  },

  /**
   * 與野外生物發起即時回合制戰鬥，依照敏捷速度決定先手順序並結算戰利品。
   * @param {Object} creature - 敵方生物/NPC 資料物件。
   * @returns {boolean} 成功進入戰鬥回傳 true，無法發起戰鬥（如體力耗盡或戰鬥中）回傳 false。
   */
  startBattle: (creature) => {
    const { player, isBattling } = get();
    if (!player || isBattling) return false;

    if ((player.hp ?? 0) <= 0) {
      get().addLog('戰鬥系統', 'Combat System', '體力耗盡，無法進行戰鬥！', 'HP depleted, cannot enter combat!', 'system');
      return false;
    }

    const enemyName = creature.name || creature.npcId || '生物';
    const enemyNameEn = creature.nameEn || creature.name || 'Creature';

    const pSpeed = player.stats?.speed ?? player.spd ?? 1;

    const eSpeed = creature.stats?.speed ?? 1;
    const eMaxHp = creature.stats?.maxHP ?? creature.hp ?? 50;

    let pCurrentHp = player.hp;
    let eCurrentHp = eMaxHp;

    const playerGoesFirst = pSpeed >= eSpeed;
    let currentTurn = playerGoesFirst ? 'player' : 'enemy';

    set({ isBattling: true });

    const firstAttackerStr = playerGoesFirst
      ? `我方先手 (我方 SPD: ${pSpeed}, 敵方 SPD: ${eSpeed})`
      : `敵方先手 (敵方 SPD: ${eSpeed}, 我方 SPD: ${pSpeed})`;
    const firstAttackerStrEn = playerGoesFirst
      ? `Player goes first (Player SPD: ${pSpeed}, Enemy SPD: ${eSpeed})`
      : `Enemy goes first (Enemy SPD: ${eSpeed}, Player SPD: ${pSpeed})`;

    get().addLog(
      '戰鬥系統',
      'Combat System',
      `對【${enemyName}】發起戰鬥！${firstAttackerStr}`,
      `Initiated combat against [${enemyNameEn}]! ${firstAttackerStrEn}`,
      'event'
    );

    const intervalId = setInterval(async () => {
      const state = get();
      if (!state.isBattling) {
        clearInterval(intervalId);
        return;
      }

      if (currentTurn === 'player') {
        const { isHit, damage } = calculateCombatTurn(player, creature);

        if (isHit) {
          eCurrentHp = Math.max(0, eCurrentHp - damage);
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${player.name}】使用【普通攻擊】命中【${enemyName}】，造成 ${damage} 點傷害！(敵方剩餘 HP: ${eCurrentHp}/${eMaxHp})`,
            `[${player.name}] used [Normal Attack] on [${enemyNameEn}] for ${damage} damage! (Enemy HP: ${eCurrentHp}/${eMaxHp})`,
            'event'
          );
        } else {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${player.name}】使用【普通攻擊】攻擊【${enemyName}】，未命中！`,
            `[${player.name}] used [Normal Attack] on [${enemyNameEn}], missed!`,
            'event'
          );
        }

        if (eCurrentHp <= 0) {
          clearInterval(intervalId);
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `戰鬥結束！【${player.name}】擊敗了【${enemyName}】，獲得勝利！(剩餘 HP: ${pCurrentHp})`,
            `Combat ended! [${player.name}] defeated [${enemyNameEn}]! (Remaining HP: ${pCurrentHp})`,
            'event'
          );

          let updatedInv = [...(get().inventory || [])];
          const drops = creature.drops || [];
          for (const drop of drops) {
            const min = Math.max(0, Number(drop.min) || 0);
            const max = Math.max(min, Number(drop.max) || 0);
            if (max <= 0 && min <= 0) continue;
            const dropQty = Math.floor(Math.random() * (max - min + 1)) + min;
            if (dropQty > 0) {
              const dbItem = get().items.find((i) => i.itemId === drop.itemId);
              const itemName = dbItem ? dbItem.name : drop.itemId;
              const itemNameEn = dbItem ? (dbItem.nameEn || dbItem.name) : drop.itemId;

              updatedInv = addItemsToInventory(updatedInv, drop.itemId, dropQty);

              get().addLog(
                '戰鬥系統',
                'Combat System',
                `獲得戰利品：[${itemName}] x${dropQty}！`,
                `Obtained loot: [${itemNameEn}] x${dropQty}!`,
                'event'
              );
            }
          }

          set({ inventory: updatedInv, isBattling: false });

          try {
            await fetch(`${API_BASE}/player`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hp: pCurrentHp, inventory: updatedInv }),
            });
          } catch (err) {
            console.error('[Battle Victory Sync Error]', err);
          }
          return;
        }

        currentTurn = 'enemy';
      } else {
        const { isHit, damage } = calculateCombatTurn(creature, player);

        if (isHit) {
          pCurrentHp = Math.max(0, pCurrentHp - damage);
          set((s) => ({ player: { ...s.player, hp: pCurrentHp } }));
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${enemyName}】使用【普通攻擊】命中【${player.name}】，造成 ${damage} 點傷害！(玩家剩餘 HP: ${pCurrentHp})`,
            `[${enemyNameEn}] used [Normal Attack] on [${player.name}] for ${damage} damage! (Player HP: ${pCurrentHp})`,
            'event'
          );
        } else {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${enemyName}】使用【普通攻擊】攻擊【${player.name}】，未命中！`,
            `[${enemyNameEn}] used [Normal Attack] on [${player.name}], missed!`,
            'event'
          );
        }

        if (pCurrentHp <= 0) {
          clearInterval(intervalId);
          set({ isBattling: false });
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `戰鬥結束！【${player.name}】不敵【${enemyName}】，戰敗了...`,
            `Combat ended! [${player.name}] was defeated by [${enemyNameEn}]...`,
            'event'
          );
          try {
            await fetch(`${API_BASE}/player`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hp: pCurrentHp }),
            });
          } catch (err) {
            console.error('[Battle HP Sync Error]', err);
          }
          return;
        }

        currentTurn = 'player';
      }
    }, 1000);

    return true;
  },
}));
