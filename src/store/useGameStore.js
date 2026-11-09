import { create } from 'zustand';
import { translations } from '../constants/translations';
import {
  normalizePlayerStats,
  addItemsToInventory,
  calculateCombatTurn,
  calculateFleeSuccess,
  calculateCombatDefeatPenalty,
  isPlayerComatose,
  getStatusEffects,
  calculateEffectiveEnergyCost,
  canPlaceItemAtLocation,
  isPlayerOverburdened,
  settleItemDecay,
  isDecayItem,
  checkTravelRequirements,
  selectSkillByTactics,
  getAvailableBattleSkills,
  calculateSkillLevel,
  roundExp,
} from '../utils/gameHelpers';
import {
  MAX_WATER,
  MAX_FOOD,
  MAX_HP,
  DEFAULT_INITIAL_STATS,
  ENERGY_DRAIN_CYCLE,
  ENERGY_HP_REGEN_CYCLE,
  COMBAT_TURN_TIMEOUT,
  DEFAULT_ATTACK_SKILL_ID,
} from '../constants/gameConstants';

export { translations };

// 全域戰鬥時鐘計時器引用
let combatIntervalTimer = null;

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const STORAGE_PLAYER_ID_KEY = 'aether_player_id';
const STORAGE_VIEW_MODE_KEY = 'aether_view_mode';

/**
 * 從 LocalStorage 讀取已儲存的介面版面偏好。
 * @returns {'auto' | 'desktop' | 'mobile'} 介面顯示模式。
 */
const getInitialViewMode = () => {
  try {
    const saved = localStorage.getItem(STORAGE_VIEW_MODE_KEY);
    if (saved === 'auto' || saved === 'desktop' || saved === 'mobile') {
      return saved;
    }
  } catch (e) {
    console.warn('[LocalStorage] Unable to read view mode:', e);
  }
  return 'auto';
};

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
  viewMode: getInitialViewMode(),
  /**
   * 設定版面顯示模式並記憶於客戶端 LocalStorage。
   * @param {'auto' | 'desktop' | 'mobile'} mode - 顯示模式。
   */
  setViewMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_VIEW_MODE_KEY, mode);
    } catch (e) {
      console.warn('[LocalStorage] Unable to save view mode:', e);
    }
    set({ viewMode: mode });
  },

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

  statusEffects: [],

  logs: [],

  isBattling: false,

  // 戰鬥狀態機狀態（支援手動決策、30秒倒數、自動戰術與多人擴充）
  combatState: {
    isBattling: false,
    isAutoBattle: false,
    turnTimeRemaining: COMBAT_TURN_TIMEOUT,
    currentTurn: 'player',
    turnCount: 1,
    participants: {
      player: null,
      enemy: null,
    },
    enemyCreature: null,
  },

  // 玩家自訂戰鬥設定（自動戰鬥開關、戰術優先條件清單）
  battleSettings: {
    isAutoBattle: false,
    tactics: [
      { priority: 1, skillId: 'SKILL_MINDS_EYE', condition: 'SELF_NOT_HAS_STATUS', targetStatusId: 'STATUS_FOCUSED' },
      { priority: 2, skillId: 'SKILL_FLAT_STRIKE', condition: 'TARGET_NOT_HAS_STATUS', targetStatusId: 'STATUS_STUN' },
      { priority: 3, skillId: 'SKILL_VOID_SLASH', condition: 'ALWAYS', targetStatusId: '' },
      { priority: 4, skillId: 'SKILL_SPINNING_SLASH', condition: 'ALWAYS', targetStatusId: '' },
    ],
  },

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
            : [{ skillId: DEFAULT_ATTACK_SKILL_ID, level: 0 }],
          combatSkills: dbP.combatSkills || state.player?.combatSkills || {
            SWORD: { level: 0, exp: 0 },
            UNARMED: { level: 0, exp: 0 },
          },
          equipment: dbP.equipment || state.player?.equipment || {
            weaponInstanceId: null,
            chestInstanceId: null,
            legInstanceId: null,
          },
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
          location: dbP.location || state.player?.location || 'AZURE_BAY_MARKET',
          mentor: dbP.mentor || state.player?.mentor || '',
          knownLocations: Array.isArray(dbP.knownLocations) ? dbP.knownLocations : (state.player?.knownLocations || []),
          quests: Array.isArray(dbP.quests) ? dbP.quests : (state.player?.quests || []),
          unlockedRecipes: Array.isArray(dbP.unlockedRecipes) ? dbP.unlockedRecipes : (state.player?.unlockedRecipes || []),
          lifeSkills: dbP.lifeSkills || state.player?.lifeSkills || {
            GATHERING: { level: 0, exp: 0 },
            FISHING: { level: 0, exp: 0 },
            MINING: { level: 0, exp: 0 },
            COOKING: { level: 0, exp: 0 },
          },
          battleSettings: dbP.battleSettings || state.player?.battleSettings || state.battleSettings,
        },
        battleSettings: dbP.battleSettings || state.battleSettings,
      };
    });
  },

  /**
   * 建立玩家角色並初始化三維能力值。
   * @param {string} name - 角色名稱。
   * @param {number|Object} str - 力量數值或包含三維能力的物件。
   * @param {number} [spd] - 速度數值。
   * @param {number} [dex] - 靈巧數值。
   * @returns {Promise<boolean>} 建立成功回傳 true，失敗回傳 false。
   */
  createCharacter: async (name, str, spd, dex) => {
    const strength = typeof str === 'object' ? str.strength : str;
    const speed = typeof str === 'object' ? str.speed : spd;
    const dexVal = typeof str === 'object' ? str.dexterity : (dex ?? 1);
    let existingPlayerId = get().player?._id || '';
    if (!existingPlayerId) {
      try {
        existingPlayerId = localStorage.getItem(STORAGE_PLAYER_ID_KEY) || '';
      } catch (e) {
        console.warn('[LocalStorage] Unable to read player ID:', e);
      }
    }

    try {
      const res = await fetch(`${API_BASE}/player/create-character`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': existingPlayerId,
        },
        body: JSON.stringify({
          name,
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
          if (result.data._id) {
            try {
              localStorage.setItem(STORAGE_PLAYER_ID_KEY, result.data._id);
            } catch (e) {
              console.warn('[LocalStorage] Unable to save player ID:', e);
            }
          }
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
          if (dbP?._id) {
            try {
              localStorage.setItem(STORAGE_PLAYER_ID_KEY, dbP._id);
            } catch (e) {
              console.warn('[LocalStorage] Unable to save player ID:', e);
            }
          }
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
      let pId = get().player?._id || '';
      if (!pId) {
        try {
          pId = localStorage.getItem(STORAGE_PLAYER_ID_KEY) || '';
        } catch {
          // ignore
        }
      }
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': pId,
        },
        body: JSON.stringify({ playerId: pId }),
      });
    } catch {
      // Ignore network errors when logging out offline
    }

    try {
      localStorage.removeItem(STORAGE_PLAYER_ID_KEY);
    } catch (e) {
      console.warn('[LocalStorage] Unable to remove player ID:', e);
    }

    set({
      player: null,
      inventory: [],
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
  /** 載入全域戰鬥狀態效果集合清單 */
  fetchStatusEffects: () => fetchCollection('/status-effects', 'statusEffects', set),

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
        get().fetchStatusEffects(),
      ]);

      let storedPlayerId = '';
      try {
        storedPlayerId = localStorage.getItem(STORAGE_PLAYER_ID_KEY) || '';
      } catch (e) {
        console.warn('[LocalStorage] Unable to read player ID:', e);
      }

      const targetPlayerId = storedPlayerId || get().player?._id || '';
      if (!targetPlayerId) {
        set({
          screenMode: 'login',
          player: null,
          user: { isLoggedIn: false, name: '', email: '', pictureUrl: null },
        });
        return;
      }

      const res = await fetch(`${API_BASE}/player`, { headers: { 'x-player-id': targetPlayerId } });
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
            : { isLoggedIn: false, name: '', email: '', pictureUrl: null },
          screenMode: dbP.isLoggedIn ? nextScreen : 'login',
        });
      } else {
        try {
          localStorage.removeItem(STORAGE_PLAYER_ID_KEY);
        } catch {
          // ignore
        }
        set({
          screenMode: 'login',
          player: null,
          user: { isLoggedIn: false, name: '', email: '', pictureUrl: null },
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
      createdAt: new Date().toISOString(),
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
   * 統一發布新解鎖配方的提示日誌。
   * @param {Array} newlyUnlockedRecipes - 新解鎖配方清單。
   */
  logNewlyUnlockedRecipes: (newlyUnlockedRecipes = []) => {
    if (!Array.isArray(newlyUnlockedRecipes) || newlyUnlockedRecipes.length === 0) return;
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
    const travelCheck = checkTravelRequirements(connection, inventory, items);
    if (!travelCheck.canTravel) {
      get().addLog('系統', 'System', travelCheck.messageZh, travelCheck.messageEn, 'system');
      return;
    }
    const baseCost = connection?.energyCost ?? 1;
    const cost = calculateEffectiveEnergyCost(player, baseCost, 'TRAVEL');
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
        headers: { 'Content-Type': 'application/json', 'x-player-id': player._id || '' },
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
    const totalCost = calculateEffectiveEnergyCost(player, baseTotalCost, 'GATHER');

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
        headers: { 'Content-Type': 'application/json', 'x-player-id': player._id || '' },
        body: JSON.stringify({ cost: totalCost, itemId, qty: addQty }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
          await get().fetchLogs();

          // 檢查採集獲得資源是否觸發新配方解鎖
          const newlyUnlocked = result.result?.newlyUnlockedRecipes || result.newlyUnlockedRecipes || [];
          get().logNewlyUnlockedRecipes(newlyUnlocked);
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
    const energyCost = calculateEffectiveEnergyCost(player, baseEnergyCost, 'CRAFT');
    const currentEnergy = Math.round((player.energy ?? 0) * 10) / 10;
    if (currentEnergy < energyCost) {
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/player/craft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-player-id': player._id || '' },
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
          if (result.location) {
            set((state) => ({
              locations: state.locations.map((loc) =>
                loc.locationId === result.location.locationId ? result.location : loc
              ),
              currentLocation:
                state.currentLocation?.locationId === result.location.locationId
                  ? result.location
                  : state.currentLocation,
            }));
          }
          await get().fetchLogs();

          // 檢查製作獲得產物是否觸發新配方解鎖
          const newlyUnlocked = result.result?.newlyUnlockedRecipes || result.newlyUnlockedRecipes || [];
          get().logNewlyUnlockedRecipes(newlyUnlocked);

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
    const { player } = get();
    if (!player || !inventoryItemId) return false;

    try {
      const res = await fetch(`${API_BASE}/player/consume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': player._id || '',
        },
        body: JSON.stringify({
          instanceId: inventoryItemId,
          itemId: inventoryItemId,
          qty: Math.max(1, Number(qty) || 1),
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
          if (result.logActionText) {
            get().addLog(
              '道具系統',
              'Item System',
              `${result.logActionText}${result.effectStr || ''}。`,
              `${result.logActionTextEn || result.logActionText}${result.effectStrEn || ''}.`,
              'event'
            );
          }
          return true;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || '現在還不需要這個。';
        get().addLog('系統', 'System', msg, msg, 'system');
      }
    } catch (err) {
      console.error('[Consume Error]', err);
    }

    return false;
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
    const { player } = get();
    if (!player || !npc || !itemId) return false;

    const buyQty = Math.max(1, Number(qty) || 1);

    try {
      const res = await fetch(`${API_BASE}/player/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': player._id || '',
        },
        body: JSON.stringify({
          npcId: npc.npcId,
          itemId,
          qty: buyQty,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
          const newlyUnlocked = result.newlyUnlockedRecipes || result.result?.newlyUnlockedRecipes || [];
          get().logNewlyUnlockedRecipes(newlyUnlocked);
          return true;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || '購買失敗！';
        get().addLog('系統', 'System', msg, msg, 'system');
      }
    } catch (err) {
      console.error('[Buy Sync Error]', err);
    }

    return false;
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
    const { player } = get();
    if (!player || !npc || !itemId) return false;

    const sellQty = Math.max(1, Number(qty) || 1);

    try {
      const res = await fetch(`${API_BASE}/player/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': player._id || '',
        },
        body: JSON.stringify({
          npcId: npc.npcId,
          itemId,
          price,
          qty: sellQty,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
          return true;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || '出售失敗！';
        get().addLog('系統', 'System', msg, msg, 'system');
      }
    } catch (err) {
      console.error('[Sell Sync Error]', err);
    }

    return false;
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
        headers: { 'Content-Type': 'application/json', 'x-player-id': get().player?._id || '' },
        body: JSON.stringify({ locationId, instanceId, count }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data, {
            locations: result.locations || get().locations,
          });
          const newlyUnlocked = result.newlyUnlockedRecipes || result.result?.newlyUnlockedRecipes || [];
          get().logNewlyUnlockedRecipes(newlyUnlocked);
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
    const eq = get().player?.equipment || {};
    const isEquippedItem = itemKey === eq.weaponInstanceId || itemKey === eq.chestInstanceId || itemKey === eq.legInstanceId;
    if ((get().isBattling || get().combatState?.isBattling) && isEquippedItem) {
      get().addLog(
        '裝備系統',
        'Equipment System',
        '戰鬥中禁止丟棄已裝備之武器或防具！',
        'Cannot drop equipped weapon or armor during combat!',
        'system'
      );
      return false;
    }
    try {
      const res = await fetch(`${API_BASE}/player/drop-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-player-id': get().player?._id || '' },
        body: JSON.stringify({ locationId, itemKey, count }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const targetLoc = (get().locations || []).find((l) => l && l.locationId === locationId);
          if (!canPlaceItemAtLocation(targetLoc || locationId, get().locations)) {
            get().addLog(
              '背包系統',
              'Inventory System',
              '丟棄的物品已沉入海中消失。',
              'The discarded item sank into the sea and disappeared.',
              'system'
            );
          }
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
   * 取得玩家當前裝備之武器道具物件（整合背包實例與物品基礎數值，含 attack 攻擊力）。
   * 若未裝備或背包中找不到該武器實體，回傳 null。
   * @returns {Object|null}
   */
  getEquippedWeaponItem: () => {
    const { player, inventory, items } = get();
    const weaponInstanceId = player?.equipment?.weaponInstanceId;
    if (!weaponInstanceId) return null;
    const invItem = (inventory || []).find((i) => i.instanceId === weaponInstanceId);
    if (!invItem) return null;
    const baseItem = (items || []).find((i) => i.itemId === invItem.itemId);
    if (!baseItem) return null;
    return {
      ...baseItem,
      ...invItem,
      attack: Number(baseItem.attack) || 0,
    };
  },

  /**
   * 裝備背包中的特定武器道具。
   * @param {string} instanceId - 背包物品之唯一 instanceId。
   * @returns {Promise<boolean>}
   */
  equipWeapon: async (instanceId) => {
    if (get().isBattling || get().combatState?.isBattling) {
      get().addLog(
        '裝備系統',
        'Equipment System',
        '戰鬥中禁止更換或裝備武器！',
        'Cannot change or equip weapon during combat!',
        'system'
      );
      return false;
    }
    const { inventory, items, player } = get();
    const invItem = (inventory || []).find((i) => i.instanceId === instanceId);
    if (!invItem) return false;
    const baseItem = (items || []).find((i) => i.itemId === invItem.itemId);
    const types = baseItem?.type || [];
    if (!types.includes('WEAPON')) {
      return false;
    }

    const updatedEquipment = {
      ...(player?.equipment || {}),
      weaponInstanceId: instanceId,
    };

    set((s) => ({
      player: s.player ? { ...s.player, equipment: updatedEquipment } : s.player,
    }));

    try {
      const pId = player?._id || '';
      if (pId) {
        const res = await fetch(`${API_BASE}/player`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': pId,
          },
          body: JSON.stringify({ equipment: updatedEquipment }),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.data) {
            get().applyPlayerData(resData.data);
          }
        }
      }
      get().addLog(
        '裝備系統',
        'Equipment System',
        `已裝備武器【${baseItem?.name || '武器'}】（攻擊力 +${baseItem?.attack || 0}）。`,
        `Equipped weapon [${baseItem?.nameEn || baseItem?.name || 'Weapon'}] (Attack +${baseItem?.attack || 0}).`,
        'system'
      );
      return true;
    } catch (err) {
      console.error('[Equip Weapon Error]', err);
      return false;
    }
  },

  /**
   * 卸下當前已裝備的武器。
   * @returns {Promise<boolean>}
   */
  unequipWeapon: async () => {
    if (get().isBattling || get().combatState?.isBattling) {
      get().addLog(
        '裝備系統',
        'Equipment System',
        '戰鬥中禁止卸下武器！',
        'Cannot unequip weapon during combat!',
        'system'
      );
      return false;
    }
    const { player } = get();
    const updatedEquipment = {
      ...(player?.equipment || {}),
      weaponInstanceId: null,
    };

    set((s) => ({
      player: s.player ? { ...s.player, equipment: updatedEquipment } : s.player,
    }));

    try {
      const pId = player?._id || '';
      if (pId) {
        const res = await fetch(`${API_BASE}/player`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': pId,
          },
          body: JSON.stringify({ equipment: updatedEquipment }),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.data) {
            get().applyPlayerData(resData.data);
          }
        }
      }
      get().addLog(
        '裝備系統',
        'Equipment System',
        '已卸下當前裝備的武器，恢復為徒手狀態。',
        'Unequipped weapon, returned to unarmed state.',
        'system'
      );
      return true;
    } catch (err) {
      console.error('[Unequip Weapon Error]', err);
      return false;
    }
  },

  /**
   * 取得玩家當前裝備之防具道具清單（包含實體屬性與基礎 defense 防禦力）。
   * @returns {Array<Object>} 已裝備防具清單。
   */
  getEquippedArmorItems: () => {
    const { player, inventory, items } = get();
    const eq = player?.equipment || {};
    const equipped = [];
    const slots = [
      { key: 'chestInstanceId', slotName: 'CHEST' },
      { key: 'legInstanceId', slotName: 'LEG' },
    ];

    for (const { key, slotName } of slots) {
      const instId = eq[key];
      if (!instId) continue;
      const invItem = (inventory || []).find((i) => i.instanceId === instId);
      if (!invItem) continue;
      const baseItem = (items || []).find((i) => i.itemId === invItem.itemId);
      if (!baseItem) continue;
      equipped.push({
        ...baseItem,
        ...invItem,
        slot: slotName,
        defense: Number(baseItem.defense) || 0,
      });
    }

    return equipped;
  },

  /**
   * 取得玩家當前裝備防具的總防禦力加成。
   * @returns {number} 總防禦加成點數。
   */
  getTotalArmorDefense: () => {
    const armors = get().getEquippedArmorItems();
    return armors.reduce((sum, item) => sum + (Number(item.defense) || 0), 0);
  },

  /**
   * 裝備背包中的特定防具道具。依道具 type 中的部位 (CHEST / LEG) 自動決定槽位。
   * @param {string} instanceId - 背包道具唯一 instanceId。
   * @returns {Promise<boolean>}
   */
  equipArmor: async (instanceId) => {
    if (get().isBattling || get().combatState?.isBattling) {
      get().addLog(
        '裝備系統',
        'Equipment System',
        '戰鬥中禁止更換或裝備防具！',
        'Cannot change or equip armor during combat!',
        'system'
      );
      return false;
    }
    const { inventory, items, player } = get();
    const invItem = (inventory || []).find((i) => i.instanceId === instanceId);
    if (!invItem) return false;
    const baseItem = (items || []).find((i) => i.itemId === invItem.itemId);
    const types = baseItem?.type || [];
    if (!types.includes('ARMOR')) {
      return false;
    }

    let slotKey = 'chestInstanceId';
    let slotDisplayName = '胸甲';
    if (types.includes('LEG')) {
      slotKey = 'legInstanceId';
      slotDisplayName = '腿甲';
    } else if (types.includes('CHEST')) {
      slotKey = 'chestInstanceId';
      slotDisplayName = '胸甲';
    }

    const updatedEquipment = {
      ...(player?.equipment || {}),
      [slotKey]: instanceId,
    };

    set((s) => ({
      player: s.player ? { ...s.player, equipment: updatedEquipment } : s.player,
    }));

    try {
      const pId = player?._id || '';
      if (pId) {
        const res = await fetch(`${API_BASE}/player`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': pId,
          },
          body: JSON.stringify({ equipment: updatedEquipment }),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.data) {
            get().applyPlayerData(resData.data);
          }
        }
      }
      get().addLog(
        '裝備系統',
        'Equipment System',
        `已裝備${slotDisplayName}【${baseItem?.name || '防具'}】（防禦力 +${baseItem?.defense || 0}）。`,
        `Equipped armor [${baseItem?.nameEn || baseItem?.name || 'Armor'}] (Defense +${baseItem?.defense || 0}).`,
        'system'
      );
      return true;
    } catch (err) {
      console.error('[Equip Armor Error]', err);
      return false;
    }
  },

  /**
   * 卸下特定防具槽位或特定 instanceId 之防具。
   * @param {string} targetKey - 部位代碼 ('CHEST' | 'LEG') 或道具 instanceId。
   * @returns {Promise<boolean>}
   */
  unequipArmor: async (targetKey) => {
    if (get().isBattling || get().combatState?.isBattling) {
      get().addLog(
        '裝備系統',
        'Equipment System',
        '戰鬥中禁止卸下防具！',
        'Cannot unequip armor during combat!',
        'system'
      );
      return false;
    }
    const { player } = get();
    const currentEq = { ...(player?.equipment || {}) };
    let unequippedSlot;

    if (targetKey === 'CHEST' || currentEq.chestInstanceId === targetKey) {
      currentEq.chestInstanceId = null;
      unequippedSlot = '胸甲';
    } else if (targetKey === 'LEG' || currentEq.legInstanceId === targetKey) {
      currentEq.legInstanceId = null;
      unequippedSlot = '腿甲';
    } else {
      currentEq.chestInstanceId = null;
      unequippedSlot = '防具';
    }

    set((s) => ({
      player: s.player ? { ...s.player, equipment: currentEq } : s.player,
    }));

    try {
      const pId = player?._id || '';
      if (pId) {
        const res = await fetch(`${API_BASE}/player`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': pId,
          },
          body: JSON.stringify({ equipment: currentEq }),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.data) {
            get().applyPlayerData(resData.data);
          }
        }
      }
      get().addLog(
        '裝備系統',
        'Equipment System',
        `已卸下${unequippedSlot}。`,
        `Unequipped ${unequippedSlot || 'armor'}.`,
        'system'
      );
      return true;
    } catch (err) {
      console.error('[Unequip Armor Error]', err);
      return false;
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
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': get().player?._id || '',
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': get().player?._id || '',
        },
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
   * 觸發戰鬥每秒時鐘輪詢 (Combat Clock Tick)。
   * 在手動模式下進行 30 秒思考倒數，超時自動普通攻擊；在自動戰鬥模式下以 1 秒週期自動依戰術出招。
   */
  tickCombat: async () => {
    const state = get();
    const combat = state.combatState;
    if (!combat || !combat.isBattling) {
      if (combatIntervalTimer) {
        clearInterval(combatIntervalTimer);
        combatIntervalTimer = null;
      }
      return;
    }

    if (combat.isResolvingAction) return;

    if (combat.currentTurn === 'enemy') {
      await get().executeCombatAction('enemy', 'player', null);
    } else if (combat.currentTurn === 'player') {
      if (combat.isAutoBattle) {
        await get().executeCombatAction('player', 'enemy', null);
      } else {
        const nextTime = (combat.turnTimeRemaining ?? COMBAT_TURN_TIMEOUT) - 1;
        if (nextTime <= 0) {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${state.player?.name || '冒險者'}】思考時間已到，自動使用【普通攻擊】！`,
            `[${state.player?.name || 'Player'}] turn timed out, automatically used [Normal Attack]!`,
            'event'
          );
          await get().executeCombatAction('player', 'enemy', DEFAULT_ATTACK_SKILL_ID);
        } else {
          set((s) => ({
            combatState: {
              ...s.combatState,
              turnTimeRemaining: nextTime,
            },
          }));
        }
      }
    }
  },

  /**
   * 玩家手動選擇並施放戰鬥技能。
   * @param {string} skillId - 欲施放之技能識別碼。
   * @returns {Promise<boolean>} 成功出招回傳 true，否則回傳 false。
   */
  chooseCombatSkill: async (skillId) => {
    const { combatState } = get();
    if (!combatState || !combatState.isBattling || combatState.currentTurn !== 'player' || combatState.isResolvingAction) {
      return false;
    }
    return await get().executeCombatAction('player', 'enemy', skillId);
  },

  /**
   * 切換手動戰鬥與自動戰鬥模式。
   * 自動模式下維持 1 秒 1 回合依戰術策略出招；手動模式下每回合倒數 30 秒。
   */
  toggleAutoBattle: () => {
    const currentAuto = Boolean(get().combatState?.isAutoBattle);
    const nextAuto = !currentAuto;

    set((s) => ({
      combatState: {
        ...s.combatState,
        isAutoBattle: nextAuto,
        turnTimeRemaining: COMBAT_TURN_TIMEOUT,
      },
      battleSettings: {
        ...s.battleSettings,
        isAutoBattle: nextAuto,
      },
    }));

    get().addLog(
      '戰鬥系統',
      'Combat System',
      `戰鬥模式切換：【${nextAuto ? '自動戰鬥' : '手動操作'}】（${nextAuto ? '每秒自動依戰術出招' : '每回合倒數 30 秒'}）。`,
      `Combat mode switched to [${nextAuto ? 'Auto Battle' : 'Manual Control'}].`,
      'system'
    );

    get().updateBattleSettings({ isAutoBattle: nextAuto });
  },

  /**
   * 更新並持久化玩家自動戰鬥設定（包含戰術優先順序與施放條件清單）。
   * @param {Object} newSettings - 包含 isAutoBattle 或 tactics 的設定物件。
   */
  updateBattleSettings: async (newSettings = {}) => {
    const current = get().battleSettings || {};
    const updated = {
      ...current,
      ...newSettings,
      tactics: newSettings.tactics || current.tactics || [],
    };

    set((s) => ({
      battleSettings: updated,
      player: s.player ? { ...s.player, battleSettings: updated } : s.player,
    }));

    try {
      const pId = get().player?._id || '';
      if (pId) {
        await fetch(`${API_BASE}/player`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': pId,
          },
          body: JSON.stringify({ battleSettings: updated }),
        });
      }
    } catch (err) {
      console.error('[Update Battle Settings Error]', err);
    }
  },

  /**
   * 脫離/逃跑戰鬥，依據玩家與怪物速度計算成功率。
   * 成功時脫離戰鬥並將當前血量持久化寫回資料庫；失敗時消耗玩家回合並交由怪物反擊。
   * @returns {Promise<boolean>} 是否成功逃跑。
   */
  fleeBattle: async () => {
    const { combatState, player } = get();
    if (!combatState || !combatState.isBattling || combatState.isResolvingAction) return false;

    const playerParticipant = combatState.participants?.player;
    const enemyParticipant = combatState.participants?.enemy;
    const pName = playerParticipant?.name || player?.name || '冒險者';
    const pNameEn = playerParticipant?.nameEn || player?.name || 'Adventurer';
    const enemyName = enemyParticipant?.name || combatState.enemyCreature?.name || '怪物';
    const enemyNameEn =
      enemyParticipant?.nameEn ||
      combatState.enemyCreature?.nameEn ||
      enemyParticipant?.name ||
      'Monster';

    const fleeResult = calculateFleeSuccess(
      playerParticipant || player,
      enemyParticipant || combatState.enemyCreature
    );

    if (fleeResult.isSuccess) {
      if (combatIntervalTimer) {
        clearInterval(combatIntervalTimer);
        combatIntervalTimer = null;
      }

      const currentHp = Math.max(0, playerParticipant?.hp ?? player?.hp ?? 0);
      get().addLog(
        '戰鬥系統',
        'Combat System',
        `【${pName}】脫離了戰鬥。(剩餘 HP: ${currentHp})`,
        `[${pNameEn}] fled from combat. (Remaining HP: ${currentHp})`,
        'event'
      );

      set((s) => ({
        isBattling: false,
        player: s.player ? { ...s.player, hp: currentHp } : s.player,
        combatState: {
          ...s.combatState,
          isBattling: false,
          isResolvingAction: false,
        },
      }));

      try {
        const pId = player?._id || '';
        if (pId) {
          const res = await fetch(`${API_BASE}/player`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-player-id': pId,
            },
            body: JSON.stringify({ hp: currentHp }),
          });
          if (res.ok) {
            const resData = await res.json();
            if (resData.success && resData.data) {
              get().applyPlayerData(resData.data);
            }
          }
        }
      } catch (err) {
        console.error('[Battle Flee Sync Error]', err);
      }
      return true;
    }

    // 逃跑失敗
    get().addLog(
      '戰鬥系統',
      'Combat System',
      `【${pName}】試圖逃跑，但被【${enemyName}】攔住了！`,
      `[${pNameEn}] tried to flee, but was blocked by [${enemyNameEn}]!`,
      'event'
    );

    // 結算玩家當前回合的冷卻與狀態消退（逃跑行動已消耗玩家此回合）
    const updatedPlayerParticipant = playerParticipant ? { ...playerParticipant } : null;
    if (updatedPlayerParticipant) {
      const remainingStatuses = [];
      for (const s of (updatedPlayerParticipant.statuses || [])) {
        s.remainingTurns -= 1;
        if (s.remainingTurns <= 0) {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${updatedPlayerParticipant.name}】身上的【${s.name}】效果已消退。`,
            `[${updatedPlayerParticipant.nameEn || updatedPlayerParticipant.name}]'s [${s.nameEn || s.name}] status has worn off.`,
            'system'
          );
        } else {
          remainingStatuses.push(s);
        }
      }
      updatedPlayerParticipant.statuses = remainingStatuses;

      const newCooldowns = { ...(updatedPlayerParticipant.cooldowns || {}) };
      for (const k of Object.keys(newCooldowns)) {
        if (newCooldowns[k] > 0) {
          newCooldowns[k] -= 1;
        }
      }
      updatedPlayerParticipant.cooldowns = newCooldowns;
    }

    // 將行動權切換至敵方，交由戰鬥時序定時器自動推進怪物出招
    set((s) => ({
      combatState: {
        ...s.combatState,
        currentTurn: 'enemy',
        turnTimeRemaining: COMBAT_TURN_TIMEOUT,
        turnCount: (s.combatState.turnCount || 1) + 1,
        isResolvingAction: false,
        participants: {
          ...s.combatState.participants,
          player: updatedPlayerParticipant || s.combatState.participants?.player,
        },
      },
    }));

    return false;
  },

  /**
   * 執行戰鬥行動核心通用結算器 (Universal Combat Action Resolver)。
   * 具備參與者抽象與隊營分離，完整支援單人手動、自動戰術與未來多人連線擴充。
   * @param {string} actorId - 行動方識別碼 ('player' | 'enemy' | 未来 'player_2' 等)。
   * @param {string} targetId - 目標方識別碼。
   * @param {string|null} [manualSkillId=null] - 手動指定施放的技能 ID，若為 null 則啟動戰術決策。
   */
  executeCombatAction: async (actorId, targetId, manualSkillId = null) => {
    const state = get();
    const combat = state.combatState;
    if (!combat || !combat.isBattling) return false;

    set((s) => ({ combatState: { ...s.combatState, isResolvingAction: true } }));

    const participants = { ...combat.participants };
    const actor = participants[actorId];
    const target = participants[targetId];

    if (!actor || !target) {
      set((s) => ({ combatState: { ...s.combatState, isResolvingAction: false } }));
      return false;
    }

    const allSkills = state.battleSkills || [];
    const normalAttackSkill = allSkills.find(
      (s) => s.skillId === DEFAULT_ATTACK_SKILL_ID || s.skillId === 'NORMAL_ATTACK'
    ) || {
      skillId: DEFAULT_ATTACK_SKILL_ID,
      name: '普通攻擊',
      nameEn: 'Normal Attack',
      hitRateFormula: '(attacker.dexterity - defender.speed) / defender.speed * 0.25 + 0.5',
      damageFormula: 'attacker.strength - defender.defense',
      coolDown: 0,
    };

    if (actor.id === 'player') {
      actor.weaponAttack = get().getEquippedWeaponItem()?.attack || 0;
      actor.armorDefense = get().getTotalArmorDefense();
    }
    if (target.id === 'player') {
      target.armorDefense = get().getTotalArmorDefense();
    }

    // 1. 控場檢定 (如暈眩判定)
    const stunEffect = (actor.statuses || []).find((s) => s.canAct === false);
    if (stunEffect) {
      get().addLog(
        '戰鬥系統',
        'Combat System',
        `【${actor.name}】處於【${stunEffect.name || '暈眩'}】狀態中，本回合無法行動！`,
        `[${actor.nameEn || actor.name}] is affected by [${stunEffect.nameEn || 'Stunned'}], cannot act this turn!`,
        'event'
      );
    } else {
      // 2. 決定施放招式
      let selectedSkill;
      if (actor.team === 'ALLY') {
        const equippedWeapon = get().getEquippedWeaponItem();
        const combatSkills = state.player?.combatSkills || {};
        const availableSkills = getAvailableBattleSkills(allSkills, equippedWeapon, combatSkills);

        if (manualSkillId) {
          const found = availableSkills.find((s) => s.skillId === manualSkillId);
          if (found && (actor.cooldowns[found.skillId] || 0) <= 0) {
            selectedSkill = found;
          } else {
            if (found && (actor.cooldowns[found.skillId] || 0) > 0) {
              get().addLog(
                '戰鬥系統',
                'Combat System',
                `【${found.name}】冷卻中（剩餘 ${actor.cooldowns[found.skillId]} 回合），退回普通攻擊！`,
                `[${found.nameEn || found.name}] is on cooldown, defaulted to Normal Attack!`,
                'system'
              );
            }
            selectedSkill = normalAttackSkill;
          }
        } else {
          // 自動戰鬥：依據玩家配置的戰術策略清單進行條件決策
          const tactics = state.battleSettings?.tactics || [];
          selectedSkill = selectSkillByTactics(
            tactics,
            availableSkills,
            actor.statuses,
            target.statuses,
            actor.cooldowns
          );
        }
      } else {
        // 敵方怪物預設使用普通攻擊
        selectedSkill = normalAttackSkill;
      }

      // 設置冷卻計時
      if (selectedSkill.coolDown > 0) {
        actor.cooldowns[selectedSkill.skillId] = selectedSkill.coolDown;
      }

      // 3. 戰鬥回合行動結算
      const turnResult = calculateCombatTurn(
        actor,
        target,
        selectedSkill,
        actor.statuses,
        target.statuses
      );

      const skillDisplayName = selectedSkill.name || selectedSkill.skillId;
      const skillDisplayNameEn = selectedSkill.nameEn || selectedSkill.name || selectedSkill.skillId;

      if (selectedSkill.damageFormula === '0') {
        get().addLog(
          '戰鬥系統',
          'Combat System',
          `【${actor.name}】施展了【${skillDisplayName}】！`,
          `[${actor.nameEn || actor.name}] used [${skillDisplayNameEn}]!`,
          'event'
        );
      } else if (turnResult.isHit) {
        target.hp = Math.max(0, target.hp - turnResult.totalDamage);
        if (target.id === 'player') {
          set((s) => ({ player: { ...s.player, hp: target.hp } }));
        }

        if (turnResult.isGreatSuccess) {
          if (turnResult.hitCount > 1) {
            get().addLog(
              '戰鬥系統',
              'Combat System',
              `【${actor.name}】施展【${skillDisplayName}】，連續發動 ${turnResult.hitCount} 次攻擊並擊中了【${target.name}】的要害！造成雙倍傷害 ${turnResult.totalDamage} 點！(${target.name}剩餘 HP: ${target.hp}/${target.maxHp})`,
              `[${actor.nameEn || actor.name}] used [${skillDisplayNameEn}], landing ${turnResult.hitCount} hits and struck a vital point on [${target.nameEn || target.name}]! Dealt double damage ${turnResult.totalDamage}! (${target.nameEn || target.name} HP: ${target.hp}/${target.maxHp})`,
              'event'
            );
          } else {
            get().addLog(
              '戰鬥系統',
              'Combat System',
              `【${actor.name}】使用【${skillDisplayName}】擊中了【${target.name}】的要害！造成雙倍傷害 ${turnResult.totalDamage} 點！(${target.name}剩餘 HP: ${target.hp}/${target.maxHp})`,
              `[${actor.nameEn || actor.name}] used [${skillDisplayNameEn}] and struck a vital point on [${target.nameEn || target.name}]! Dealt double damage ${turnResult.totalDamage}! (${target.nameEn || target.name} HP: ${target.hp}/${target.maxHp})`,
              'event'
            );
          }
        } else if (turnResult.hitCount > 1) {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${actor.name}】施展【${skillDisplayName}】，連續發動 ${turnResult.hitCount} 次攻擊！造成總計 ${turnResult.totalDamage} 點傷害！(${target.name}剩餘 HP: ${target.hp}/${target.maxHp})`,
            `[${actor.nameEn || actor.name}] used [${skillDisplayNameEn}], landing ${turnResult.hitCount} hits for ${turnResult.totalDamage} total damage! (${target.nameEn || target.name} HP: ${target.hp}/${target.maxHp})`,
            'event'
          );
        } else {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${actor.name}】使用【${skillDisplayName}】命中【${target.name}】，造成 ${turnResult.totalDamage} 點傷害！(${target.name}剩餘 HP: ${target.hp}/${target.maxHp})`,
            `[${actor.nameEn || actor.name}] used [${skillDisplayNameEn}] on [${target.nameEn || target.name}] for ${turnResult.totalDamage} damage! (${target.nameEn || target.name} HP: ${target.hp}/${target.maxHp})`,
            'event'
          );
        }
      } else {
        get().addLog(
          '戰鬥系統',
          'Combat System',
          `【${actor.name}】使用【${skillDisplayName}】攻擊【${target.name}】，未命中！`,
          `[${actor.nameEn || actor.name}] used [${skillDisplayNameEn}] on [${target.nameEn || target.name}], missed!`,
          'event'
        );
      }

      // 4. 狀態效果 100% 施加判定
      if (Array.isArray(turnResult.appliedEffects) && turnResult.appliedEffects.length > 0) {
        const dbStatuses = state.statusEffects || [];
        for (const eff of turnResult.appliedEffects) {
          const statusDef = dbStatuses.find((s) => s.statusId === eff.statusId);
          const sName = statusDef?.name || eff.statusId;
          const sNameEn = statusDef?.nameEn || eff.statusId;

          const isSelf = eff.target === 'SELF';
          const effectReceiver = isSelf ? actor : target;
          effectReceiver.statuses = effectReceiver.statuses || [];

          const existingIdx = effectReceiver.statuses.findIndex((s) => s.statusId === eff.statusId);
          if (existingIdx >= 0) {
            effectReceiver.statuses[existingIdx].remainingTurns = Math.max(
              effectReceiver.statuses[existingIdx].remainingTurns,
              eff.duration
            );
          } else {
            effectReceiver.statuses.push({
              statusId: eff.statusId,
              name: sName,
              nameEn: sNameEn,
              canAct: statusDef?.canAct !== false,
              statModifiers: statusDef?.statModifiers || {},
              remainingTurns: eff.duration,
            });
          }

          get().addLog(
            '戰鬥系統',
            'Combat System',
            `【${effectReceiver.name}】受到【${sName}】狀態影響，持續 ${eff.duration} 回合！`,
            `[${effectReceiver.nameEn || effectReceiver.name}] is affected by [${sNameEn}] for ${eff.duration} turns!`,
            'event'
          );
        }
      }

      // 5. 勝利與戰敗結算
      if (participants.enemy.hp <= 0) {
        if (combatIntervalTimer) {
          clearInterval(combatIntervalTimer);
          combatIntervalTimer = null;
        }

        const enemyCreature = combat.enemyCreature || {};
        get().addLog(
          '戰鬥系統',
          'Combat System',
          `戰鬥結束！【${participants.player.name}】擊敗了【${participants.enemy.name}】，獲得勝利！(剩餘 HP: ${participants.player.hp})`,
          `Combat ended! [${participants.player.name}] defeated [${participants.enemy.name}]! (Remaining HP: ${participants.player.hp})`,
          'event'
        );

        let updatedInv = [...(get().inventory || [])];
        const drops = enemyCreature.drops || [];
        for (const drop of drops) {
          const min = Math.max(0, Number(drop.min) || 0);
          const max = Math.max(min, Number(drop.max) || 0);
          if (max <= 0 && min <= 0) continue;
          const dropQty = Math.floor(Math.random() * (max - min + 1)) + min;
          if (dropQty > 0) {
            const dbItem = get().items.find((i) => i.itemId === drop.itemId);
            const itemName = dbItem ? dbItem.name : drop.itemId;
            const itemNameEn = dbItem ? (dbItem.nameEn || dbItem.name) : drop.itemId;
            const dropDur = (dbItem?.durability !== undefined && dbItem.durability > 0) ? dbItem.durability : -1;

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

        // 戰鬥技能熟練度經驗累積（嚴格依據本場戰鬥鎖定之武器系別結算）
        const weaponSkillType = combat.battleWeaponType || (() => {
          const equippedWeapon = get().getEquippedWeaponItem();
          if (equippedWeapon && Array.isArray(equippedWeapon.type)) {
            const matched = equippedWeapon.type.find((t) => t !== 'WEAPON');
            if (matched) return matched;
          }
          return 'UNARMED';
        })();

        // 獲得該特定生物身上設定之專屬經驗值
        const expGain = Number(enemyCreature.exp) || 0;
        let currentCombatSkills = state.player?.combatSkills || {};

        if (expGain > 0) {
          currentCombatSkills = { ...currentCombatSkills };
          const currentExp = Number(currentCombatSkills[weaponSkillType]?.exp) || 0;
          const newExp = roundExp(currentExp + expGain);
          const oldLevel = calculateSkillLevel(currentExp);
          const newLevel = calculateSkillLevel(newExp);

          currentCombatSkills[weaponSkillType] = {
            level: newLevel,
            exp: newExp,
          };

          const skillNameZh = weaponSkillType === 'SWORD' ? '劍術' : '徒手格鬥';
          const skillNameEn = weaponSkillType === 'SWORD' ? 'Sword Mastery' : 'Unarmed Combat';
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `獲得【${skillNameZh}】戰鬥經驗值 +${expGain}！`,
            `Gained [${skillNameEn}] Combat EXP +${expGain}!`,
            'event'
          );

          if (newLevel > oldLevel) {
            get().addLog(
              '戰鬥系統',
              'Combat System',
              `恭喜！您的【${skillNameZh}】等級提升至 Lv.${newLevel}！`,
              `Congratulations! Your [${skillNameEn}] level increased to Lv.${newLevel}!`,
              'system'
            );
          }
        }

        set((s) => ({
          inventory: updatedInv,
          isBattling: false,
          player: s.player ? { ...s.player, hp: participants.player.hp, combatSkills: currentCombatSkills } : s.player,
          combatState: {
            ...s.combatState,
            isBattling: false,
            isResolvingAction: false,
            participants,
          },
        }));

        try {
          const pId = state.player?._id || '';
          if (pId) {
            const res = await fetch(`${API_BASE}/player`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-player-id': pId,
              },
              body: JSON.stringify({
                hp: participants.player.hp,
                inventory: updatedInv,
                combatSkills: currentCombatSkills,
              }),
            });
            if (res.ok) {
              const resData = await res.json();
              if (resData.success && resData.data) {
                get().applyPlayerData(resData.data);
              }
            }
          }
        } catch (err) {
          console.error('[Battle Victory Sync Error]', err);
        }
        return true;
      }

      if (participants.player.hp <= 0) {
        if (combatIntervalTimer) {
          clearInterval(combatIntervalTimer);
          combatIntervalTimer = null;
        }

        const enemyName = participants.enemy?.name || '怪物';
        const enemyNameEn = participants.enemy?.nameEn || participants.enemy?.name || 'Monster';

        get().addLog(
          '戰鬥系統',
          'Combat System',
          `戰鬥結束！【${participants.player.name}】不敵【${participants.enemy.name}】，戰敗了...`,
          `Combat ended! [${participants.player.name}] was defeated by [${participants.enemy.name}]...`,
          'event'
        );

        // 計算戰敗懲罰：隨機扣除力量/速度/靈巧 1~3 點（最低扣至 1），若三項均為 1 則扣精力 300~600 點（最低扣至 0）
        const penalty = calculateCombatDefeatPenalty(
          state.player?.stats || participants.player?.stats,
          state.player?.energy ?? 0
        );

        if (penalty.type === 'STAT') {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `受到了【${enemyName}】的致命一擊，導致【${penalty.statLabel}】降低了 ${penalty.amount} 點。`,
            `Suffered a fatal blow from [${enemyNameEn}], causing [${penalty.statLabelEn}] to decrease by ${penalty.amount}.`,
            'event'
          );
        } else {
          get().addLog(
            '戰鬥系統',
            'Combat System',
            `受到了【${enemyName}】的致命一擊導致昏迷了 ${penalty.amount} 點精力。`,
            `Suffered a fatal blow from [${enemyNameEn}], falling comatose and losing ${penalty.amount} energy.`,
            'event'
          );
        }

        set((s) => ({
          isBattling: false,
          player: s.player
            ? {
                ...s.player,
                hp: 0,
                stats: { ...s.player.stats, ...penalty.updatedStats },
                energy: penalty.updatedEnergy,
              }
            : s.player,
          combatState: {
            ...s.combatState,
            isBattling: false,
            isResolvingAction: false,
            participants,
          },
        }));

        try {
          const pId = state.player?._id || '';
          if (pId) {
            const syncPayload = {
              hp: 0,
              stats: penalty.updatedStats,
              energy: penalty.updatedEnergy,
            };
            const res = await fetch(`${API_BASE}/player`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-player-id': pId,
              },
              body: JSON.stringify(syncPayload),
            });
            if (res.ok) {
              const resData = await res.json();
              if (resData.success && resData.data) {
                get().applyPlayerData(resData.data);
              }
            }
          }
        } catch (err) {
          console.error('[Battle Defeat Sync Error]', err);
        }
        return true;
      }
    }

    // 6. 回合結束維護：衰減行動方狀態與技能冷卻
    const remainingStatuses = [];
    for (const s of (actor.statuses || [])) {
      s.remainingTurns -= 1;
      if (s.remainingTurns <= 0) {
        get().addLog(
          '戰鬥系統',
          'Combat System',
          `【${actor.name}】身上的【${s.name}】狀態已解除。`,
          `[${actor.nameEn || actor.name}]'s [${s.nameEn || s.name}] status has worn off.`,
          'event'
        );
      } else {
        remainingStatuses.push(s);
      }
    }
    actor.statuses = remainingStatuses;

    for (const k of Object.keys(actor.cooldowns || {})) {
      if (actor.cooldowns[k] > 0) {
        actor.cooldowns[k] -= 1;
      }
    }

    // 7. 切換下一行動方
    const nextTurn = actorId === 'player' ? 'enemy' : 'player';

    set((s) => ({
      combatState: {
        ...s.combatState,
        isResolvingAction: false,
        currentTurn: nextTurn,
        turnTimeRemaining: COMBAT_TURN_TIMEOUT,
        turnCount: (s.combatState.turnCount || 1) + 1,
        participants: {
          ...s.combatState.participants,
          [actorId]: actor,
          [targetId]: target,
        },
      },
    }));

    return true;
  },

  /**
   * 與野外生物發起即時回合制戰鬥，初始化戰鬥狀態機與時鐘計時器。
   * @param {Object} creature - 敵方生物/NPC 資料物件。
   * @returns {boolean} 成功進入戰鬥回傳 true，無法發起戰鬥回傳 false。
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

    const playerGoesFirst = pSpeed >= eSpeed;
    const initialTurn = playerGoesFirst ? 'player' : 'enemy';

    const savedBattleSettings = get().battleSettings || {
      isAutoBattle: false,
      tactics: [
        { priority: 1, skillId: 'SKILL_MINDS_EYE', condition: 'SELF_NOT_HAS_STATUS', targetStatusId: 'STATUS_FOCUSED' },
        { priority: 2, skillId: 'SKILL_FLAT_STRIKE', condition: 'TARGET_NOT_HAS_STATUS', targetStatusId: 'STATUS_STUN' },
        { priority: 3, skillId: 'SKILL_VOID_SLASH', condition: 'ALWAYS', targetStatusId: '' },
        { priority: 4, skillId: 'SKILL_SPINNING_SLASH', condition: 'ALWAYS', targetStatusId: '' },
      ],
    };

    const initialEquippedWeapon = get().getEquippedWeaponItem();
    let initialWeaponSkillType = 'UNARMED';
    if (initialEquippedWeapon && Array.isArray(initialEquippedWeapon.type)) {
      const matched = initialEquippedWeapon.type.find((t) => t !== 'WEAPON');
      if (matched) initialWeaponSkillType = matched;
    }

    const initialCombatState = {
      isBattling: true,
      isAutoBattle: Boolean(savedBattleSettings.isAutoBattle),
      turnTimeRemaining: COMBAT_TURN_TIMEOUT,
      currentTurn: initialTurn,
      turnCount: 1,
      battleWeaponType: initialWeaponSkillType,
      isResolvingAction: false,
      participants: {
        player: {
          id: 'player',
          name: player.name || '冒險者',
          nameEn: player.name || 'Player',
          team: 'ALLY',
          hp: player.hp,
          maxHp: player.stats?.maxHp || player.maxHp || 100,
          stats: { ...player.stats },
          weaponAttack: get().getEquippedWeaponItem()?.attack || 0,
          armorDefense: get().getTotalArmorDefense(),
          statuses: [],
          cooldowns: {},
          isPlayerControlled: true,
        },
        enemy: {
          id: 'enemy',
          name: enemyName,
          nameEn: enemyNameEn,
          team: 'ENEMY',
          hp: eMaxHp,
          maxHp: eMaxHp,
          stats: { ...creature.stats },
          statuses: [],
          cooldowns: {},
          isPlayerControlled: false,
        },
      },
      enemyCreature: creature,
    };

    set({
      isBattling: true,
      combatState: initialCombatState,
    });

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

    if (combatIntervalTimer) {
      clearInterval(combatIntervalTimer);
      combatIntervalTimer = null;
    }

    combatIntervalTimer = setInterval(() => {
      get().tickCombat();
    }, 1000);

    return true;
  },

  /**
   * 觸發後端定時心跳：在伺服器端權威結算精力恢復與道具腐敗，並即時寫入 DB 與同步 Zustand 狀態。
   */
  triggerHeartbeat: async () => {
    const { player } = get();
    if (!player) return;

    try {
      const res = await fetch(`${API_BASE}/player/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': player._id || '',
        },
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          get().applyPlayerData(result.data);
        }
      }
    } catch (err) {
      console.error('[Heartbeat Error]', err);
    }
  },

  /**
   * 結算並恢復精力（每 15 分鐘恢復 15 點精力，上限為 maxEnergy）。
   * 調用後端心跳端點，由後端權威計算並即時寫入資料庫。
   */
  settleEnergyRecovery: () => {
    get().triggerHeartbeat();
  },

  /**
   * 結算背包道具腐敗狀態。
   * 調用後端心跳端點，由後端權威扣除耐久度並即時寫入資料庫。
   */
  settleInventoryDecay: () => {
    const { inventory, items } = get();
    if (!inventory || inventory.length === 0) return;
    const now = Date.now();
    const hasDecayDue = inventory.some((item) => {
      if (!item || !item.lastDecayedAt) return false;
      const isDecay = isDecayItem(item, items.find((i) => i.itemId === item.itemId));
      if (!isDecay) return false;
      return (now - new Date(item.lastDecayedAt).getTime()) >= 60000;
    });

    if (hasDecayDue) {
      get().triggerHeartbeat();
    }
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

  /**
   * 修復當前地點指定建築物的耐久度。
   * @param {string} locationId - 地點 ID。
   * @param {string} buildingId - 建築物 ID。
   * @param {string} repairItemId - 修復道具 ID。
   * @param {number} [qty=1] - 消耗的修復道具數量。
   * @returns {Promise<boolean>} 是否修復成功。
   */
  repairBuilding: async (locationId, buildingId, repairItemId, qty = 1) => {
    const { player } = get();
    if (!player || !locationId || !buildingId || !repairItemId) return false;

    try {
      const res = await fetch(`${API_BASE}/location/repair-building`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-player-id': player._id || '' },
        body: JSON.stringify({ locationId, buildingId, repairItemId, qty }),
      });

      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        if (result.data) {
          get().applyPlayerData(result.data);
        }
        if (result.location) {
          set((state) => ({
            locations: state.locations.map((loc) =>
              loc.locationId === result.location.locationId ? result.location : loc
            ),
            currentLocation:
              state.currentLocation?.locationId === result.location.locationId
                ? result.location
                : state.currentLocation,
          }));
        }
        await get().fetchLogs();
        return true;
      } else {
        const msg = result.message || '修復失敗！';
        get().addLog('系統', 'System', msg, msg, 'system');
        return false;
      }
    } catch (err) {
      console.error('[Repair Building Error]', err);
      return false;
    }
  },
}));
