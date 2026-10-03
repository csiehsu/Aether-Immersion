import { create } from 'zustand';
import { translations } from '../constants/translations';

export { translations };

const API_BASE = 'http://localhost:5000/api';

export const useGameStore = create((set, get) => ({
  // Screen Mode ('login' | 'character_creation' | 'game')
  screenMode: 'login',

  // View Mode ('auto' | 'desktop' | 'mobile')
  viewMode: 'auto',
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
  setLanguage: (lang) => set({ language: lang }),

  // Player Stats (Loaded live from MongoDB Atlas)
  player: null,

  // Active Tab for Mobile/Portrait view
  activeTab: 'move',
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

  logs: [],

  // --- Character Creation Action ---
  createCharacter: async (name, str, spd, dex) => {
    try {
      const res = await fetch(`${API_BASE}/player/create-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, str, spd, dex }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const dbP = result.data;
          set((state) => ({
            player: {
              ...state.player,
              name: dbP.name,
              str: dbP.str,
              spd: dbP.spd,
              dex: dbP.dex,
              level: 1,
              isCharacterCreated: true,
              hp: dbP.hp,
              maxHp: dbP.maxHp,
              energy: dbP.energy,
              maxEnergy: dbP.maxEnergy,
            },
            screenMode: 'game',
          }));

          get().addLog(
            '創角系統',
            'Character System',
            `角色【${dbP.name}】建立成功！能力值：力量 ${dbP.str}, 速度 ${dbP.spd}, 精巧 ${dbP.dex}。`,
            `Character [${dbP.name}] created! Stats: STR ${dbP.str}, SPD ${dbP.spd}, DEX ${dbP.dex}.`,
            'system'
          );
          return true;
        }
      }
    } catch (err) {
      console.error('[Create Character Error]:', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
    return false;
  },

  // --- Google Auth Methods ---
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
              str: dbP?.str ?? 1,
              spd: dbP?.spd ?? 1,
              dex: dbP?.dex ?? 1,
              level: dbP?.level ?? 1,
              hp: dbP?.hp ?? 100,
              maxHp: dbP?.maxHp ?? 100,
              energy: dbP?.energy ?? 4320,
              maxEnergy: dbP?.maxEnergy ?? 4320,
              location: dbP?.location || 'AZURE_BAY_PORT',
            },
            screenMode: dbP && dbP.isCharacterCreated ? 'game' : 'character_creation',
          }));

          get().addLog('系統驗證', 'Auth System', `Google 帳號 [${gUser.name}] 登入成功！`, `Google account [${gUser.name}] logged in!`, 'system');
          return true;
        }
      }
    } catch (err) {
      console.error('[Google Auth Error]:', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
    return false;
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // Silent catch
    }

    set({
      user: { isLoggedIn: false, name: '', email: '', pictureUrl: null },
      screenMode: 'login',
    });

    get().addLog('系統驗證', 'Auth System', '已成功登出 Google 帳號。', 'Logged out of Google account.', 'system');
  },

  // --- MongoDB Sync Methods ---
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

  fetchItems: async () => {
    try {
      const res = await fetch(`${API_BASE}/items`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set({ items: result.data });
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Fetch Items Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  fetchLocations: async () => {
    try {
      const res = await fetch(`${API_BASE}/locations`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set({ locations: result.data });
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Fetch Locations Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  fetchRecipes: async () => {
    try {
      const res = await fetch(`${API_BASE}/recipes`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set({ recipes: result.data });
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Fetch Recipes Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  fetchNpcs: async () => {
    try {
      const res = await fetch(`${API_BASE}/npcs`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set({ creatures: result.data });
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Fetch NPCs Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  fetchBuildings: async () => {
    try {
      const res = await fetch(`${API_BASE}/buildings`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set({ buildings: result.data });
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Fetch Buildings Error]', err);
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  syncFromMongo: async () => {
    try {
      const status = await get().checkMongoStatus();
      if (status === 'offline') {
        set({ isDisconnected: true });
        return;
      }

      await get().fetchItems();
      await get().fetchLocations();
      await get().fetchRecipes();
      await get().fetchNpcs();
      await get().fetchBuildings();

      const res = await fetch(`${API_BASE}/player`);
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
        return;
      }
      const result = await res.json();
      if (result.success && result.data) {
        const dbP = result.data;
        set((state) => {
          const isCreated = dbP.isCharacterCreated || false;
          const nextScreen = !dbP.isLoggedIn ? 'login' : !isCreated ? 'character_creation' : 'game';

          return {
            isDisconnected: false,
            player: {
              ...state.player,
              name: dbP.name || state.player.name,
              isCharacterCreated: isCreated,
              str: dbP.str ?? state.player.str,
              spd: dbP.spd ?? state.player.spd,
              dex: dbP.dex ?? state.player.dex,
              hp: dbP.hp ?? state.player.hp,
              maxHp: dbP.maxHp ?? state.player.maxHp,
              energy: dbP.energy ?? state.player.energy,
              maxEnergy: dbP.maxEnergy ?? state.player.maxEnergy,
              level: dbP.level ?? 1,
              location: dbP.location || state.player.location,
              knownLocations: dbP.knownLocations || state.player?.knownLocations || [],
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

  // Actions
  addLog: async (sender, senderEn, text, textEn, type = 'dialogue') => {
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const newEntry = { id: Date.now(), time: timeStr, sender, senderEn, text, textEn, type };

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

  changeLocation: async (targetLocId) => {
    const { locations, player } = get();
    if (!player) return;

    const currentLoc = locations.find((l) => l.locationId === player.location);
    const connection = currentLoc?.connections?.find((c) => c.targetLocationId === targetLocId);
    const cost = connection?.energyCost ?? 1;

    if (player.energy < cost) {
      get().addLog('系統警告', 'System Warning', '精力不足，無法進行移動！', 'Not enough energy to move!', 'system');
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

  performGather: async (spotName, spotNameEn, yieldItem, yieldItemEn, cost, icon = '🪵') => {
    const { player } = get();
    if (player.energy < cost) {
      get().addLog('系統警告', 'System Warning', '精力不足，無法進行採集！', 'Not enough energy to gather!', 'system');
      return;
    }

    set((state) => ({
      player: { ...state.player, energy: state.player.energy - cost },
    }));

    set((state) => {
      const existing = state.inventory.find((i) => i.name === yieldItem);
      let updatedInv;
      if (existing) {
        updatedInv = state.inventory.map((i) =>
          i.name === yieldItem ? { ...i, count: i.count + 1 } : i
        );
      } else {
        updatedInv = [
          ...state.inventory,
          { id: `item_${Date.now()}`, name: yieldItem, nameEn: yieldItemEn, icon, count: 1, quality: '普通' },
        ];
      }
      return { inventory: updatedInv };
    });

    get().addLog('採集系統', 'Gather System', `在【${spotName}】成功採集獲得 [${yieldItem}]！(精力 -${cost})`, `Gathered [${yieldItemEn}] at [${spotNameEn}]! (-${cost} Energy)`, 'event');

    try {
      const res = await fetch(`${API_BASE}/player/gather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost, yieldItem, yieldItemEn, icon }),
      });
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }
  },

  performCraft: async (recipe, selectedMaterials = {}) => {
    const { player, inventory, items, locations, buildings } = get();
    if (!player || !recipe) return false;

    const currentLocation = locations.find((l) => l.locationId === player.location);
    const locBuildingList = currentLocation?.buildings || [];
    const locBuildingTypes = locBuildingList.map((b) => {
      const dbB = buildings.find((item) => item.buildingId === b.buildingId);
      return dbB ? dbB.type : b.buildingId;
    });

    const invToolTypes = inventory.flatMap((inv) => {
      const dbI = items.find((i) => i.itemId === inv.itemId || i.name === inv.name);
      if (!dbI || !dbI.type) return [];
      return Array.isArray(dbI.type) ? dbI.type : [dbI.type];
    });

    const reqTools = recipe.requiredToolTypes || [];
    const hasTools = reqTools.every(
      (t) => locBuildingTypes.includes(t) || invToolTypes.includes(t)
    );

    if (!hasTools) {
      get().addLog(
        '製作系統',
        'Craft System',
        `合成失敗！缺少所需工具。`,
        `Craft failed! Missing required tools.`,
        'system'
      );
      return false;
    }

    const reqItems = recipe.requiredItems || [];
    let updatedInv = inventory.map((item) => ({ ...item }));

    for (let reqIdx = 0; reqIdx < reqItems.length; reqIdx++) {
      const req = reqItems[reqIdx];
      const selectedId = selectedMaterials[reqIdx];

      if (!selectedId) {
        get().addLog(
          '製作系統',
          'Craft System',
          `合成失敗！請先選擇材料選項。`,
          `Craft failed! Please select material options first.`,
          'system'
        );
        return false;
      }

      const invIndex = updatedInv.findIndex(
        (i) => (i.id || i.itemId) === selectedId
      );

      if (invIndex < 0) {
        get().addLog(
          '製作系統',
          'Craft System',
          `合成失敗！找不到所選材料。`,
          `Craft failed! Selected material not found.`,
          'system'
        );
        return false;
      }

      const invItem = updatedInv[invIndex];
      const dbI = items.find((i) => i.itemId === invItem.itemId || i.name === invItem.name);
      const types = dbI && dbI.type ? (Array.isArray(dbI.type) ? dbI.type : [dbI.type]) : [];

      if (!types.includes(req.type)) {
        get().addLog(
          '製作系統',
          'Craft System',
          `合成失敗！所選材料類型不符。`,
          `Craft failed! Selected material type mismatch.`,
          'system'
        );
        return false;
      }

      const curCount = invItem.count || 1;
      if (curCount < req.quantity) {
        get().addLog(
          '製作系統',
          'Craft System',
          `合成失敗！所選材料數量不足（需 ≥${req.quantity}）。`,
          `Craft failed! Selected material count insufficient (req >= ${req.quantity}).`,
          'system'
        );
        return false;
      }

      if (curCount === req.quantity) {
        updatedInv[invIndex] = { ...invItem, count: 0 };
      } else {
        updatedInv[invIndex] = { ...invItem, count: curCount - req.quantity };
      }
    }

    updatedInv = updatedInv.filter((i) => i.count > 0);

    let calculatedDurability = -1;
    const firstSelId = selectedMaterials[0];
    if (firstSelId) {
      const selectedMatInv = inventory.find((i) => (i.id || i.itemId) === firstSelId);
      if (selectedMatInv) {
        const matDbItem = items.find((i) => i.itemId === selectedMatInv.itemId || i.name === selectedMatInv.name);
        const matDurability = (selectedMatInv.durability !== undefined && selectedMatInv.durability > 0)
          ? selectedMatInv.durability
          : (matDbItem && matDbItem.durability !== undefined && matDbItem.durability > 0 ? matDbItem.durability : -1);

        if (recipe.durabilityFormula && matDurability > 0) {
          try {
            const computeFn = new Function('material', `return ${recipe.durabilityFormula};`);
            calculatedDurability = computeFn({ durability: matDurability });
          } catch (err) {
            console.error('[Durability Formula Error]', err);
          }
        }
      }
    }

    const outputItems = recipe.outputItems || [];
    for (const out of outputItems) {
      const outItemId = out.itemId || recipe.recipeId;
      const dbOut = items.find(
        (i) => i.itemId === outItemId || (out.type && i.type === out.type) || (out.type && Array.isArray(i.type) && i.type.includes(out.type)) || i.name === recipe.name
      );
      const finalItemId = out.itemId || (dbOut ? dbOut.itemId : recipe.recipeId);
      const outName = dbOut ? dbOut.name : recipe.name;
      const outNameEn = dbOut ? dbOut.nameEn : (recipe.nameEn || recipe.name);
      const addQty = out.quantity || 1;

      const existingMatchIndex = updatedInv.findIndex((inv) => {
        const matchId = inv.itemId || (items.find((i) => i.name === inv.name)?.itemId);
        if (matchId !== finalItemId && inv.name !== outName) {
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
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          itemId: finalItemId,
          name: outName,
          nameEn: outNameEn,
          count: addQty,
          quality: '普通',
        };

        if (calculatedDurability > 0) {
          newItem.durability = calculatedDurability;
        }

        updatedInv.push(newItem);
      }
    }

    set({ inventory: updatedInv });

    const recipeName = recipe.name;
    const recipeNameEn = recipe.nameEn || recipe.name;
    get().addLog('製作系統', 'Craft System', `成功合成了道具 [${recipeName}]！`, `Successfully crafted [${recipeNameEn}]!`, 'event');

    try {
      await fetch(`${API_BASE}/player`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory: updatedInv }),
      });
    } catch (err) {
      console.error('[Craft Sync Error]', err);
    }

    return true;
  },
}));
