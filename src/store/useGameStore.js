import { create } from 'zustand';
import { translations } from '../constants/translations';
import {
  normalizePlayerStats,
  addItemsToInventory,
  calculateCombatTurn,
  isPlayerComatose,
  getStatusEffects,
  calculateEffectiveEnergyCost,
  isPlayerOverburdened,
  compareItemDurability,
  settleItemDecay,
  checkRecipeUnlocks,
} from '../utils/gameHelpers';
import {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  MAX_ENERGY,
  DEFAULT_INITIAL_STATS,
  ENERGY_RECOVERY_INTERVAL_MS,
  ENERGY_RECOVERY_AMOUNT,
  ENERGY_DRAIN_CYCLE,
  ENERGY_HP_REGEN_CYCLE,
} from '../constants/gameConstants';

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

/**
 * 計算精力消耗對水分、飽食度與累計池之影響，並於充沛飽足狀態下計算生命值回復。
 * 規則：
 * 1. 水分與飽食度：每消耗 15 點精力，扣除 1 點水分與 1 點飽食度。未滿 15 的消耗累計至下次。
 * 2. 飽足回血：處於充沛飽足 (WELL_FED) 時，每消耗 10 點精力恢復 1 點 HP。未滿 10 的消耗累計至下次。
 * 支援小數精度（保留三位小數避免浮點數誤差）。
 * 水分、飽食度或生命值只要有一項 <= 0，即處於昏迷狀態。
 * @param {Object} player - 玩家物件。
 * @param {number} energyCost - 實際消耗的精力點數。
 * @returns {{ newStats: Object, newAccumulator: number, newHpAccumulator: number, newHp: number, drainCount: number, hpGain: number, isComatose: boolean }}
 */
export const calculateEnergyConsumption = (player, energyCost) => {
  if (!player || typeof energyCost !== 'number' || energyCost <= 0) {
    const isComatose = isPlayerComatose(player);
    return {
      newStats: player?.stats || {},
      newAccumulator: player?.energySpentAccumulator || 0,
      newHpAccumulator: player?.hpRegenAccumulator || 0,
      newHp: player?.hp ?? 100,
      drainCount: 0,
      hpGain: 0,
      isComatose,
    };
  }

  const effects = getStatusEffects(player);
  const canRegenHp = effects.some((e) => e.canRegenHp);

  // 1. 生命值回復結算 (每消耗 ENERGY_HP_REGEN_CYCLE 點精力恢復 1 點 HP)
  let hpGain = 0;
  let newHpAccumulator = Number(player.hpRegenAccumulator) || 0;
  const maxHp = player.stats?.maxHp ?? player.maxHp ?? MAX_HP;
  let newHp = player.hp ?? maxHp;

  if (canRegenHp) {
    const totalHpSpent = Math.round((newHpAccumulator + energyCost) * 1000) / 1000;
    hpGain = Math.floor(totalHpSpent / ENERGY_HP_REGEN_CYCLE);
    newHpAccumulator = Math.round((totalHpSpent - hpGain * ENERGY_HP_REGEN_CYCLE) * 1000) / 1000;

    if (hpGain > 0) {
      newHp = Math.min(maxHp, newHp + hpGain);
    }
  }

  // 2. 水分與飽食度扣除結算 (每消耗 ENERGY_DRAIN_CYCLE 點精力扣 1 水分與 1 飽食度)
  const currentAccumulator = Number(player.energySpentAccumulator) || 0;
  const totalSpent = Math.round((currentAccumulator + energyCost) * 1000) / 1000;
  const drainCount = Math.floor(totalSpent / ENERGY_DRAIN_CYCLE);
  const newAccumulator = Math.round((totalSpent - drainCount * ENERGY_DRAIN_CYCLE) * 1000) / 1000;

  const currentStats = player.stats || { ...DEFAULT_INITIAL_STATS };

  const newWater = drainCount > 0
    ? Math.max(0, Math.min(MAX_WATER, Math.round(((currentStats.water ?? MAX_WATER) - drainCount) * 100) / 100))
    : Math.min(MAX_WATER, currentStats.water ?? MAX_WATER);

  const newFood = drainCount > 0
    ? Math.max(0, Math.min(MAX_FOOD, Math.round(((currentStats.food ?? MAX_FOOD) - drainCount) * 100) / 100))
    : Math.min(MAX_FOOD, currentStats.food ?? MAX_FOOD);

  const newStats = {
    ...currentStats,
    water: newWater,
    food: newFood,
  };

  const isComatose = newWater <= 0 || newFood <= 0 || newHp <= 0;

  return {
    newStats,
    newAccumulator,
    newHpAccumulator,
    newHp,
    drainCount,
    hpGain,
    isComatose,
  };
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
   * 統一將後端回傳的玩家資料同步寫入 Zustand Store。
   * 作為單一真實資料來源 (SSOT)，避免不同端點同步時產生欄位遺漏或漂移。
   * @param {Object} dbP - 後端回傳之玩家資料物件 (formatPlayerResponse)。
   * @param {Object} [extraState={}] - 額外需一併更新的 Store 狀態屬性 (例如 screenMode, user, locations 等)。
   */
  applyPlayerData: (dbP, extraState = {}) => {
    if (!dbP) {
      if (Object.keys(extraState).length > 0) {
        set(extraState);
      }
      return;
    }

    const stats = normalizePlayerStats(dbP.stats, dbP);
    const isCreated = Boolean(dbP.isCharacterCreated);

    set((state) => {
      const inventory = extraState.inventory !== undefined
        ? extraState.inventory
        : (Array.isArray(dbP.inventory) ? dbP.inventory : (state.inventory || []));

      return {
        ...extraState,
        isDisconnected: false,
        inventory,
        player: {
          ...state.player,
          ...dbP,
          ...(extraState.player || {}),
          name: dbP.name || state.player?.name || '冒險者',
          isCharacterCreated: isCreated,
          stats,
          skills: Array.isArray(dbP.skills) && dbP.skills.length > 0
            ? dbP.skills
            : [{ skillId: 'NORMAL_ATTACK', level: 1 }],
          str: stats.strength,
          spd: stats.speed,
          dex: stats.dexterity,
          maxHp: stats.maxHp,
          hp: dbP.hp ?? stats.maxHp ?? 100,
          money: dbP.money ?? 0,
          energy: dbP.energy ?? 4320,
          maxEnergy: dbP.maxEnergy ?? 4320,
          lastEnergyRecoveredAt: dbP.lastEnergyRecoveredAt || new Date().toISOString(),
          energySpentAccumulator: Number(dbP.energySpentAccumulator) || 0,
          hpRegenAccumulator: Number(dbP.hpRegenAccumulator) || 0,
          statusEffects: Array.isArray(dbP.statusEffects) ? dbP.statusEffects : getStatusEffects(dbP),
          level: dbP.level ?? 1,
          location: dbP.location || state.player?.location || 'AZURE_BAY_PORT',
          mentor: dbP.mentor || state.player?.mentor || 'Martha',
          knownLocations: Array.isArray(dbP.knownLocations) ? dbP.knownLocations : (state.player?.knownLocations || []),
          quests: Array.isArray(dbP.quests) ? dbP.quests : (state.player?.quests || []),
          unlockedRecipes: Array.isArray(dbP.unlockedRecipes) ? dbP.unlockedRecipes : (state.player?.unlockedRecipes || []),
          lifeSkills: dbP.lifeSkills || state.player?.lifeSkills || {
            GATHERING: { level: 1, exp: 0 },
            FISHING: { level: 1, exp: 0 },
            MINING: { level: 1, exp: 0 },
            COOKING: { level: 1, exp: 0 },
          },
        },
      };
    });
  },

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
            water: MAX_WATER,
            food: MAX_FOOD,
          },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          await get().fetchLocations();
          get().applyPlayerData(result.data, { screenMode: 'game' });
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
          const user = {
            isLoggedIn: true,
            name: gUser.name,
            email: gUser.email,
            pictureUrl: gUser.picture,
          };
          const nextScreen = dbP && dbP.isCharacterCreated ? 'game' : 'character_creation';
          get().applyPlayerData(dbP, { user, screenMode: nextScreen });
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
        const isCreated = Boolean(dbP.isCharacterCreated);
        const nextScreen = !dbP.isLoggedIn ? 'login' : !isCreated ? 'character_creation' : 'game';

        get().applyPlayerData(dbP, {
          user: dbP.isLoggedIn
            ? { isLoggedIn: true, name: dbP.name, email: dbP.email, pictureUrl: dbP.pictureUrl }
            : get().user,
          screenMode: dbP.isLoggedIn ? nextScreen : get().screenMode,
        });
      }

      await get().fetchLogs();
    } catch (err) {
      console.error('[MongoDB Sync Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  /**
   * 向後端獲取當前地點之對話紀錄、事件紀錄與玩家私人系統訊息。
   * @returns {Promise<void>}
   */
  fetchLogs: async () => {
    const { player } = get();
    const locId = player?.location || 'AZURE_BAY_PORT';
    const pId = player?._id || player?.googleId || player?.name || '';
    try {
      const res = await fetch(
        `${API_BASE}/logs?locationId=${encodeURIComponent(locId)}&playerId=${encodeURIComponent(pId)}`
      );
      if (res.ok) {
        const logData = await res.json();
        if (logData.success && Array.isArray(logData.data)) {
          set({ logs: logData.data });
        }
      }
    } catch (err) {
      console.error('[Fetch Logs Error]', err);
    }
  },

  /**
   * 新增一筆對話或系統訊息紀錄，並寫入後端 MongoDB。
   * @param {string} sender - 發送者中文名稱。
   * @param {string} [senderEn] - 發送者英文名稱。
   * @param {string} text - 中文訊息內容。
   * @param {string} [textEn] - 英文訊息內容。
   * @param {'dialogue' | 'system' | 'event'} [type='dialogue'] - 紀錄類型。
   * @param {string} [locationId=null] - 所屬地點（對話與事件專用）。
   * @param {string} [targetPlayerId=null] - 專屬目標玩家（系統訊息專用）。
   * @returns {Promise<void>}
   */
  addLog: async (sender, senderEn, text, textEn, type = 'dialogue', locationId = null, targetPlayerId = null) => {
    const { player } = get();
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const locId = locationId || player?.location || 'AZURE_BAY_PORT';
    const pId = targetPlayerId || player?._id || player?.googleId || player?.name || '';

    // 若為對話且未指定發話者名稱，預設使用玩家名稱
    const isPlayerDialogue = type === 'dialogue' && (!sender || sender === '玩家對話');
    const actualSender = isPlayerDialogue
      ? (player?.name || '冒險者')
      : (sender || '系統');
    const actualSenderEn = isPlayerDialogue
      ? (player?.name || 'Adventurer')
      : (senderEn || 'System');

    const logLocationId = type === 'system' ? '' : locId;
    const logTargetPlayerId = type === 'system' ? pId : (targetPlayerId || '');

    const newEntry = {
      id: `${Date.now()}-${Math.random()}`,
      time: timeStr,
      sender: actualSender,
      senderEn: actualSenderEn,
      text,
      textEn,
      type,
      locationId: logLocationId,
      targetPlayerId: logTargetPlayerId,
    };

    set((state) => ({
      logs: [newEntry, ...state.logs],
    }));

    try {
      const res = await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: actualSender,
          senderEn: actualSenderEn,
          text,
          textEn,
          type,
          locationId: logLocationId,
          targetPlayerId: logTargetPlayerId,
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
   * 切換玩家目前所在場景地點，並扣除相應的精力消耗。
   * @param {string} targetLocId - 目標地點識別碼。
   * @returns {Promise<void>}
   */
  changeLocation: async (targetLocId) => {
    const { locations, player, inventory, items } = get();
    if (!player) return;

    if (isPlayerComatose(player)) {
      get().addLog(
        '系統',
        'System',
        `【${player.name}】處於昏迷中，無法移動！`,
        `[${player.name}] is comatose and cannot move!`,
        'system'
      );
      return;
    }

    if (isPlayerOverburdened(player, inventory, items)) {
      return;
    }

    const currentLoc = locations.find((l) => l.locationId === player.location);
    const connection = currentLoc?.connections?.find((c) => c.targetLocationId === targetLocId);
    const baseCost = connection?.energyCost ?? 1;
    const cost = calculateEffectiveEnergyCost(player, baseCost);
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;

    if (currentEnergy < cost) {
      return;
    }

    const maxEnergy = player.maxEnergy ?? 4320;
    const wasFull = (player.energy ?? 0) >= maxEnergy;
    const newEnergy = Math.round(Math.max(0, player.energy - cost) * 10) / 10;
    const newLastRecoveredAt = (wasFull && newEnergy < maxEnergy)
      ? new Date().toISOString()
      : player.lastEnergyRecoveredAt;

    const { newStats, newAccumulator, newHpAccumulator, newHp } = calculateEnergyConsumption(player, cost);

    set((state) => ({
      player: {
        ...state.player,
        location: targetLocId,
        energy: newEnergy,
        hp: newHp,
        lastEnergyRecoveredAt: newLastRecoveredAt,
        stats: newStats,
        energySpentAccumulator: newAccumulator,
        hpRegenAccumulator: newHpAccumulator,
      },
    }));

    get().fetchLogs();

    try {
      const res = await fetch(`${API_BASE}/player/travel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLocationId: targetLocId }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
          get().fetchLogs();
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.message) {
          get().addLog('系統', 'System', errData.message, errData.message, 'system');
        }
        if (res.status >= 500) {
          set({ mongoStatus: 'offline', isDisconnected: true });
        }
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
    const { player, inventory, items, locations, buildings } = get();
    if (!player) return false;

    if (isPlayerComatose(player)) {
      get().addLog(
        '系統',
        'System',
        `【${player.name}】處於昏迷中，無法採集！`,
        `[${player.name}] is comatose and cannot gather!`,
        'system'
      );
      return false;
    }

    const addQty = Math.max(1, Number(qty) || 1);
    const baseTotalCost = cost * addQty;
    const totalCost = calculateEffectiveEnergyCost(player, baseTotalCost);

    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (currentEnergy < totalCost) {
      return false;
    }

    const currentLocation = locations.find((l) => l.locationId === player.location);
    const spot = (currentLocation?.gatherables || []).find((g) => g.itemId === itemId);
    const reqTools = spot?.requiredToolTypes || [];

    const getItemTypes = (targetItemId) => {
      const dbI = items.find((i) => i.itemId === targetItemId);
      if (!dbI || !dbI.type) return [];
      return Array.isArray(dbI.type) ? dbI.type : [dbI.type];
    };

    let updatedInventory = inventory.map((item) => ({ ...item }));

    if (reqTools.length > 0) {
      const locBuildingList = currentLocation?.buildings || [];
      const locBuildingTypes = locBuildingList.map((b) => {
        const dbB = buildings.find((item) => item.buildingId === b.buildingId);
        return dbB ? dbB.type : b.buildingId;
      });

      const nonConsumableReqs = reqTools.filter((t) => t !== 'BAIT');
      const hasTools = nonConsumableReqs.every((t) =>
        locBuildingTypes.includes(t) ||
        updatedInventory.some((inv) => getItemTypes(inv.itemId).includes(t) && (inv.count || 1) > 0)
      );

      if (!hasTools) {
        return false;
      }

      if (reqTools.includes('BAIT')) {
        const requiredBaitQty = 1 * addQty;
        const totalBait = updatedInventory
          .filter((inv) => getItemTypes(inv.itemId).includes('BAIT'))
          .reduce((sum, inv) => sum + (inv.count || 1), 0);

        if (totalBait < requiredBaitQty) {
          return false;
        }

        let remainingToDeduct = requiredBaitQty;
        for (let i = 0; i < updatedInventory.length; i++) {
          if (remainingToDeduct <= 0) break;
          const invItem = updatedInventory[i];
          if (getItemTypes(invItem.itemId).includes('BAIT')) {
            const curCount = invItem.count || 1;
            if (curCount <= remainingToDeduct) {
              updatedInventory[i] = { ...invItem, count: 0 };
              remainingToDeduct -= curCount;
            } else {
              updatedInventory[i] = { ...invItem, count: curCount - remainingToDeduct };
              remainingToDeduct = 0;
            }
          }
        }
        updatedInventory = updatedInventory.filter((i) => (i.count || 0) > 0);
      }
    }

    const maxEnergy = player.maxEnergy ?? 4320;
    const wasFull = currentEnergy >= maxEnergy;
    const newEnergy = Math.round(Math.max(0, currentEnergy - totalCost) * 10) / 10;
    const newLastRecoveredAt = (wasFull && newEnergy < maxEnergy)
      ? new Date().toISOString()
      : player.lastEnergyRecoveredAt;

    const { newStats, newAccumulator, newHpAccumulator, newHp } = calculateEnergyConsumption(player, totalCost);

    set((state) => ({
      player: {
        ...state.player,
        energy: newEnergy,
        hp: newHp,
        lastEnergyRecoveredAt: newLastRecoveredAt,
        stats: newStats,
        energySpentAccumulator: newAccumulator,
        hpRegenAccumulator: newHpAccumulator,
      },
      inventory: updatedInventory,
    }));

    try {
      const res = await fetch(`${API_BASE}/player/gather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: totalCost, itemId, qty: addQty }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
          await get().fetchLogs();
          const gainedQty = result.result?.gainedQty ?? 0;
          const targetItem = items.find((i) => i.itemId === itemId);
          const itemNameZh = targetItem?.name || itemId;
          const itemNameEn = targetItem?.nameEn || itemNameZh;
          if (gainedQty > 0) {
            get().addLog(
              '系統',
              'System',
              `採集到${itemNameZh}x${gainedQty}`,
              `Gathered ${itemNameEn} x${gainedQty}`,
              'system'
            );

            // 檢查採集獲得資源是否觸發新配方解鎖
            const newlyUnlocked = result.result?.newlyUnlockedRecipes || [];
            newlyUnlocked.forEach((recipe) => {
              const recipeNameZh = recipe.name;
              const recipeNameEn = recipe.nameEn || recipe.name;
              get().addLog(
                '配方系統',
                'Recipe System',
                `這好像可以做成${recipeNameZh}。`,
                `It seems this can be made into ${recipeNameEn}.`,
                'event'
              );
            });
          } else {
            get().addLog(
              '系統',
              'System',
              `未採集到任何${itemNameZh}`,
              `Failed to gather any ${itemNameEn}`,
              'system'
            );
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.message || '採集失敗！';
        get().addLog('系統', 'System', msg, msg, 'system');
        if (res.status >= 500) {
          set({ mongoStatus: 'offline', isDisconnected: true });
        }
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }

    return true;
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

    if (isPlayerComatose(player)) {
      get().addLog(
        '系統',
        'System',
        `【${player.name}】處於昏迷中，無法製作！`,
        `[${player.name}] is comatose and cannot craft!`,
        'system'
      );
      return false;
    }

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

    const baseEnergyCost = (recipe.energyCost || 0) * numCraftQty;
    const energyCost = calculateEffectiveEnergyCost(player, baseEnergyCost);
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (currentEnergy < energyCost) {
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/player/craft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: recipe.recipeId || recipe.id,
          selectedMaterials,
          craftQty: numCraftQty,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
          await get().fetchLogs();
          return true;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.message || '製作失敗！';
        get().addLog('系統', 'System', msg, msg, 'system');
        if (res.status >= 500) {
          set({ mongoStatus: 'offline', isDisconnected: true });
        }
        return false;
      }
    } catch (err) {
      console.error('[Craft Sync Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
      return false;
    }

    return true;
  },

  /**
   * 使用/消耗背包中的道具：累加道具營養值 (包含基礎營養與自訂附加營養) 至玩家各項能力值（包含 water 與 food），並扣除道具數量。
   * @param {string} inventoryItemId - 背包中欲使用的道具實體或識別碼。
   * @param {number} [qty=1] - 使用數量。
   * @returns {Promise<boolean>} 使用成功回傳 true，未找到道具或失敗回傳 false。
   */
  consumeItem: async (inventoryItemId, qty = 1) => {
    get().settleInventoryDecay();
    const { player, inventory, items } = get();
    if (!player || !inventoryItemId) return false;

    const matchingIndices = [];
    inventory.forEach((item, idx) => {
      if (item.instanceId === inventoryItemId || item.itemId === inventoryItemId) {
        matchingIndices.push(idx);
      }
    });
    if (matchingIndices.length === 0) return false;

    // 依最低耐久度優先排序，相同耐久度維持原順序
    matchingIndices.sort((idxA, idxB) => {
      const cmp = compareItemDurability(inventory[idxA], inventory[idxB]);
      if (cmp !== 0) return cmp;
      return idxA - idxB;
    });

    const invIndex = matchingIndices[0];

    const invItem = inventory[invIndex];
    const dbItem = items.find(
      (i) => i.itemId === invItem.itemId
    );

    const dbItemTypes = Array.isArray(dbItem?.type) ? dbItem.type : (dbItem?.type ? [dbItem.type] : []);
    const isContainer = dbItemTypes.includes('CONTAINER');

        let useCount;
    let hpGain;
    let strGain;
    let spdGain;
    let dexGain;
    let defGain;
    let maxHpGain;
    let waterGain;
    let foodGain;
    let updatedInv = [...inventory];
    let logActionText;
    let logActionTextEn;

    if (isContainer) {
      // 容器飲用邏輯：先檢查容器內裝的液體是什麼，再查找該液體效果增減數值
      const storedLiquidId = invItem.contents?.itemId;
      const storedAmount = invItem.contents?.amount || 0;

      if (storedAmount <= 0 || !storedLiquidId) {
        get().addLog(
          '道具系統',
          'Item System',
          `[${invItem.customName || dbItem?.name || invItem.itemId}] 裡沒有任何液體，無法飲用。`,
          `[${invItem.customNameEn || dbItem?.nameEn || dbItem?.name || invItem.itemId}] is empty, cannot drink.`,
          'system'
        );
        return false;
      }

      useCount = Math.min(storedAmount, Math.max(1, Number(qty) || 1));
      const dbLiquidItem = items.find((i) => i.itemId === storedLiquidId);
      const nutrition = dbLiquidItem?.nutrition || {};
      const bonus = invItem.bonusNutrition || {};

      hpGain = ((nutrition.hp || 0) + (bonus.hp || 0)) * useCount;
      strGain = ((nutrition.strength || 0) + (bonus.strength || 0)) * useCount;
      spdGain = ((nutrition.speed || 0) + (bonus.speed || 0)) * useCount;
      dexGain = ((nutrition.dexterity || 0) + (bonus.dexterity || 0)) * useCount;
      defGain = ((nutrition.defense || 0) + (bonus.defense || 0)) * useCount;
      maxHpGain = ((nutrition.maxHp || 0) + (bonus.maxHp || 0)) * useCount;
      waterGain = ((nutrition.water || 0) + (bonus.water || 0)) * useCount;
      foodGain = ((nutrition.food || 0) + (bonus.food || 0)) * useCount;

      // 扣除容器內存水量，容器本身保留不刪除
      const newStoredAmount = storedAmount - useCount;
      updatedInv[invIndex] = {
        ...invItem,
        contents: {
          ...(invItem.contents || {}),
          amount: newStoredAmount,
          itemId: newStoredAmount > 0 ? storedLiquidId : '',
        },
      };

      const liquidName = dbLiquidItem?.name || storedLiquidId;
      const liquidNameEn = dbLiquidItem?.nameEn || dbLiquidItem?.name || storedLiquidId;
      const containerName = invItem.customName || (dbItem ? dbItem.name : invItem.itemId);
      const containerNameEn = invItem.customNameEn || (dbItem ? (dbItem.nameEn || dbItem.name) : invItem.itemId);

      logActionText = `飲用了 [${containerName}] 中的 [${liquidName}] x${useCount}`;
      logActionTextEn = `Drank [${liquidNameEn}] x${useCount} from [${containerNameEn}]`;
    } else {
      // 一般消耗性物品邏輯
      const availableCount = invItem.count || 1;
      useCount = Math.min(availableCount, Math.max(1, Number(qty) || 1));

      const nutrition = dbItem?.nutrition || {};
      const bonus = invItem.bonusNutrition || {};
      hpGain = ((nutrition.hp || 0) + (bonus.hp || 0)) * useCount;
      strGain = ((nutrition.strength || 0) + (bonus.strength || 0)) * useCount;
      spdGain = ((nutrition.speed || 0) + (bonus.speed || 0)) * useCount;
      dexGain = ((nutrition.dexterity || 0) + (bonus.dexterity || 0)) * useCount;
      defGain = ((nutrition.defense || 0) + (bonus.defense || 0)) * useCount;
      maxHpGain = ((nutrition.maxHp || 0) + (bonus.maxHp || 0)) * useCount;
      waterGain = ((nutrition.water || 0) + (bonus.water || 0)) * useCount;
      foodGain = ((nutrition.food || 0) + (bonus.food || 0)) * useCount;

      if (availableCount <= useCount) {
        updatedInv.splice(invIndex, 1);
      } else {
        updatedInv[invIndex] = {
          ...invItem,
          count: availableCount - useCount,
        };
      }

      const itemName = invItem.customName || (dbItem ? dbItem.name : invItem.itemId);
      const itemNameEn = invItem.customNameEn || (dbItem ? (dbItem.nameEn || dbItem.name) : invItem.itemId);
      logActionText = `使用了 [${itemName}] x${useCount}`;
      logActionTextEn = `Used [${itemNameEn}] x${useCount}`;
    }

    // Retrieve baseline current stats from player (stats are baseline, never overwritten by item nutrition)
    const currentStats = player.stats || {};
    const currentStr = currentStats.strength ?? player.str ?? 1;
    const currentSpd = currentStats.speed ?? player.spd ?? 1;
    const currentDex = currentStats.dexterity ?? player.dex ?? 1;
    const currentDef = currentStats.defense ?? 0;
    const currentMaxHp = currentStats.maxHp ?? player.maxHp ?? MAX_HP;
    const currentWater = currentStats.water ?? MAX_WATER;
    const currentFood = currentStats.food ?? MAX_FOOD;
    const currentHp = player.hp ?? MAX_HP;

    // Add nutrition values onto player stats (accumulating rather than replacing)
    const newStr = Math.round((currentStr + strGain) * 100) / 100;
    const newSpd = Math.round((currentSpd + spdGain) * 100) / 100;
    const newDex = Math.round((currentDex + dexGain) * 100) / 100;
    const newDef = Math.round((currentDef + defGain) * 100) / 100;
    const newMaxHp = Math.round((currentMaxHp + maxHpGain) * 100) / 100;
    const newWater = Math.max(0, Math.min(MAX_WATER, Math.round((currentWater + waterGain) * 100) / 100));
    const newFood = Math.max(0, Math.min(MAX_FOOD, Math.round((currentFood + foodGain) * 100) / 100));

    const newHp = hpGain !== 0
      ? Math.max(0, Math.min(newMaxHp, currentHp + hpGain))
      : Math.min(newMaxHp, currentHp);

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
      `${logActionText}${effectStr}。`,
      `${logActionTextEn}${effectStrEn}.`,
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
          get().applyPlayerData(result.data);
        }
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }

    return true;
  },

  /**
   * 向指定 NPC 購買商品：扣除金錢並新增道具至背包，若購買的是工具則自動解鎖對應可製作配方。
   * @param {Object} npc - 交易 NPC 物件。
   * @param {string} itemId - 購買道具識別碼。
   * @param {number} price - 單價。
   * @param {number} [qty=1] - 購買數量。
   * @returns {Promise<boolean>} 購買成功回傳 true，金錢不足或無效參數回傳 false。
   */
  performBuy: async (npc, itemId, price, qty = 1) => {
    const { player, inventory, items, recipes } = get();
    if (!player || !npc || !itemId) return false;

    const buyQty = Math.max(1, Number(qty) || 1);
    const unitPrice = Math.max(0, Number(price) || 0);
    const totalCost = unitPrice * buyQty;

    const currentMoney = player.money ?? 0;
    if (currentMoney < totalCost) {
      return false;
    }

    const boughtDbItem = items.find((i) => i.itemId === itemId);
    const boughtItemTypes = boughtDbItem && boughtDbItem.type
      ? (Array.isArray(boughtDbItem.type) ? boughtDbItem.type : [boughtDbItem.type])
      : [];

    const newMoney = currentMoney - totalCost;
    const itemDur = (boughtDbItem?.durability !== undefined && boughtDbItem.durability > 0)
      ? boughtDbItem.durability
      : -1;
    const isContainer = boughtItemTypes.includes('CONTAINER') || (boughtDbItem?.capacity > 0);
    const updatedInv = addItemsToInventory(inventory, itemId, buyQty, {
      durability: itemDur,
      maxDurability: itemDur,
      ...(isContainer ? { isContainer: true, contents: { itemId: '', amount: 0 } } : {}),
    }, items);

    // 檢查購買道具是否可解鎖對應製作配方（依 recipe.triggerItem 指定道具為準）
    const currentUnlocked = Array.isArray(player.unlockedRecipes) ? [...player.unlockedRecipes] : [];
    const { newlyUnlockedRecipes, updatedUnlocked } = checkRecipeUnlocks(
      currentUnlocked,
      recipes,
      itemId
    );

    if (newlyUnlockedRecipes.length > 0) {
      newlyUnlockedRecipes.forEach((recipe) => {
        const recipeNameZh = recipe.name;
        const recipeNameEn = recipe.nameEn || recipe.name;
        get().addLog(
          '配方系統',
          'Recipe System',
          `這好像可以做成${recipeNameZh}。`,
          `It seems this can be made into ${recipeNameEn}.`,
          'event'
        );
      });
    }

    set((state) => ({
      player: {
        ...state.player,
        money: newMoney,
        unlockedRecipes: updatedUnlocked,
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
          unlockedRecipes: updatedUnlocked,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
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
          get().applyPlayerData(result.data);
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
   * @param {number} [count=1] - 拾取數量。
   * @returns {Promise<boolean>}
   */
  pickUpPlacedItem: async (locationId, instanceId, count = 1) => {
    try {
      const res = await fetch(`${API_BASE}/location/pickup-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, instanceId, count }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data, {
            locations: result.locations || get().locations,
          });
          return true;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.message || '拾取失敗！';
        get().addLog('系統', 'System', errMsg, errMsg, 'system');
        await get().fetchLocations();
      }
    } catch (err) {
      console.error('[Pickup Item Error]', err);
    }
    return false;
  },

  /**
   * 將背包內的道具丟棄至當前地點成為現場物品。
   * @param {string} locationId - 當前地點識別碼。
   * @param {string} itemKey - 道具 instanceId 或 itemId。
   * @param {number} count - 丟棄數量。
   * @returns {Promise<boolean>} 是否成功丟棄。
   */
  dropItem: async (locationId, itemKey, count = 1) => {
    try {
      const res = await fetch(`${API_BASE}/player/drop-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, itemKey, count }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data, {
            locations: result.locations || get().locations,
          });
          return true;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.message || '丟棄失敗！';
        get().addLog('系統', 'System', errMsg, errMsg, 'system');
      }
    } catch (err) {
      console.error('[Drop Item Error]', err);
    }
    return false;
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
          get().applyPlayerData(result.data, {
            locations: result.locations || get().locations,
          });

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
          get().applyPlayerData(result.data, {
            locations: result.locations || get().locations,
          });

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

              const dropDur = (dbItem?.durability !== undefined && dbItem.durability > 0)
                ? dbItem.durability
                : -1;
              updatedInv = addItemsToInventory(updatedInv, drop.itemId, dropQty, {
                durability: dropDur,
                maxDurability: dropDur,
              });

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
            const res = await fetch(`${API_BASE}/player`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hp: pCurrentHp, inventory: updatedInv }),
            });
            if (res.ok) {
              const result = await res.json();
              if (result.success && result.data) {
                get().applyPlayerData(result.data);
              }
            }
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
            const res = await fetch(`${API_BASE}/player`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hp: pCurrentHp }),
            });
            if (res.ok) {
              const result = await res.json();
              if (result.success && result.data) {
                get().applyPlayerData(result.data);
              }
            }
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

  /**
   * 結算並恢復精力（每 15 分鐘恢復 15 點精力，上限為 maxEnergy）。
   * 同步更新 Zustand state 與後端資料庫。
   */
  settleEnergyRecovery: () => {
    const { player } = get();
    if (!player) return;
    const maxEnergy = player.maxEnergy ?? MAX_ENERGY;
    const currentEnergy = Math.round((player.energy ?? maxEnergy) * 10) / 10;
    const now = Date.now();
    const lastRecoveredTime = player.lastEnergyRecoveredAt
      ? new Date(player.lastEnergyRecoveredAt).getTime()
      : now;

    const INTERVAL_MS = ENERGY_RECOVERY_INTERVAL_MS;
    const RECOVERY_AMOUNT = ENERGY_RECOVERY_AMOUNT;
    const elapsed = now - lastRecoveredTime;

    if (elapsed < INTERVAL_MS) return;

    const intervals = Math.floor(elapsed / INTERVAL_MS);
    if (intervals <= 0) return;

    if (currentEnergy >= maxEnergy) {
      set((state) => ({
        player: {
          ...state.player,
          lastEnergyRecoveredAt: new Date(now).toISOString(),
        },
      }));
      return;
    }

    const addedEnergy = intervals * RECOVERY_AMOUNT;
    const newEnergy = Math.min(maxEnergy, Math.round((currentEnergy + addedEnergy) * 10) / 10);
    const newLastRecoveredAt = newEnergy >= maxEnergy
      ? new Date(now).toISOString()
      : new Date(lastRecoveredTime + intervals * INTERVAL_MS).toISOString();

    set((state) => ({
      player: {
        ...state.player,
        energy: newEnergy,
        lastEnergyRecoveredAt: newLastRecoveredAt,
      },
    }));

    fetch(`${API_BASE}/player`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        energy: newEnergy,
        lastEnergyRecoveredAt: newLastRecoveredAt,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.success && result.data) {
          get().applyPlayerData(result.data);
        }
      })
      .catch((err) => {
        console.error('[Energy Recovery Sync Error]', err);
      });
  },

  /**
   * 結算背包道具腐敗狀態。
   * 每 1 分鐘 -1 耐久度，扣至 <= 0 自動刪除，並輸出提示文字「道具名稱已腐敗。」。
   */
  settleInventoryDecay: () => {
    const { inventory, items } = get();
    if (!inventory || inventory.length === 0) return;
    const { updatedItems, rottedItems, isChanged } = settleItemDecay(inventory, items, { isPlayer: true });
    if (!isChanged) return;

    set({ inventory: updatedItems });

    for (const rotted of rottedItems) {
      get().addLog('系統', 'System', `${rotted.name}已腐敗。`, `${rotted.nameEn} has rotted.`, 'system');
    }

    fetch(`${API_BASE}/player`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory: updatedItems,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.success && result.data) {
          get().applyPlayerData(result.data);
        }
      })
      .catch((err) => {
        console.error('[Decay Sync Error]', err);
      });
  },

  /**
   * 結算當前地點地面物品腐敗狀態。
   * 扣至 <= 0 自動刪除，地面物品不顯示提示文字。
   */
  settleGroundItemsDecay: () => {
    const { locations, player, items } = get();
    const locId = player?.location || 'AZURE_BAY_PORT';
    const currentLoc = locations.find((l) => l.locationId === locId);
    if (!currentLoc || !currentLoc.placedItems || currentLoc.placedItems.length === 0) return;

    const { updatedItems, isChanged } = settleItemDecay(currentLoc.placedItems, items, { isPlayer: false });
    if (!isChanged) return;

    const updatedLocations = locations.map((loc) =>
      loc.locationId === locId ? { ...loc, placedItems: updatedItems } : loc
    );
    set({ locations: updatedLocations });
  },
}));
