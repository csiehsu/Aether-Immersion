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

  battleSkills: [],

  logs: [],

  isBattling: false,

  createCharacter: async (name, str, spd, dex) => {
    const strength = typeof str === 'object' ? str.strength : str;
    const speed = typeof str === 'object' ? str.speed : spd;
    const dexerity = typeof str === 'object' ? str.dexerity : dex;

    try {
      const res = await fetch(`${API_BASE}/player/create-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          stats: {
            strength,
            speed,
            dexerity,
          },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const dbP = result.data;
          const dbStats = dbP.stats || {};
          const stats = {
            strength: dbStats.strength ?? dbP.str ?? str ?? 1,
            speed: dbStats.speed ?? dbP.spd ?? spd ?? 1,
            dexerity: dbStats.dexerity ?? dbP.dex ?? dex ?? 1,
            maxHp: dbStats.maxHp ?? dbP.maxHp ?? 100,
            defense: dbStats.defense ?? 0,
          };

          set((state) => ({
            player: {
              ...state.player,
              name: dbP.name,
              stats,
              skills: dbP.skills || [{ skillId: 'NORMAL_ATTACK', level: 1 }],
              str: stats.strength,
              spd: stats.speed,
              dex: stats.dexerity,
              maxHp: stats.maxHp,
              level: 1,
              isCharacterCreated: true,
              hp: dbP.hp,
              energy: dbP.energy,
              maxEnergy: dbP.maxEnergy,
            },
            screenMode: 'game',
          }));

          get().addLog(
            '創角系統',
            'Character System',
            `角色【${dbP.name}】建立成功！能力值：力量 ${stats.strength}, 速度 ${stats.speed}, 精巧 ${stats.dexerity}。`,
            `Character [${dbP.name}] created! Stats: STR ${stats.strength}, SPD ${stats.speed}, DEX ${stats.dexerity}.`,
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
          const dbStats = dbP?.stats || {};
          const stats = {
            strength: dbStats.strength ?? dbP?.str ?? 1,
            speed: dbStats.speed ?? dbP?.spd ?? 1,
            dexerity: dbStats.dexerity ?? dbP?.dex ?? 1,
            maxHp: dbStats.maxHp ?? dbP?.maxHp ?? 100,
            defense: dbStats.defense ?? 0,
          };

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
              dex: stats.dexerity,
              maxHp: stats.maxHp,
              level: dbP?.level ?? 1,
              hp: dbP?.hp ?? 100,
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
    }

    set({
      user: { isLoggedIn: false, name: '', email: '', pictureUrl: null },
      screenMode: 'login',
    });

    get().addLog('系統驗證', 'Auth System', '已成功登出 Google 帳號。', 'Logged out of Google account.', 'system');
  },

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

  fetchBattleSkills: async () => {
    try {
      const res = await fetch(`${API_BASE}/battle-skills`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          set({ battleSkills: result.data });
        }
      } else {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch (err) {
      console.error('[Fetch Battle Skills Error]', err);
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
      await get().fetchBattleSkills();

      const res = await fetch(`${API_BASE}/player`);
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
        return;
      }
      const result = await res.json();
      if (result.success && result.data) {
        const dbP = result.data;
        const dbStats = dbP.stats || {};
        const stats = {
          strength: dbStats.strength ?? dbP.str ?? 1,
          speed: dbStats.speed ?? dbP.spd ?? 1,
          dexerity: dbStats.dexerity ?? dbP.dex ?? 1,
          maxHp: dbStats.maxHp ?? dbP.maxHp ?? 100,
          defense: dbStats.defense ?? 0,
        };

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
              dex: stats.dexerity,
              maxHp: stats.maxHp,
              hp: dbP.hp ?? state.player?.hp ?? stats.maxHp ?? 100,
              energy: dbP.energy ?? state.player?.energy ?? 4320,
              maxEnergy: dbP.maxEnergy ?? state.player?.maxEnergy ?? 4320,
              level: dbP.level ?? 1,
              location: dbP.location || state.player?.location || 'AZURE_BAY_PORT',
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

  performGather: async (itemId, cost, qty = 1) => {
    const { player, items } = get();
    const addQty = Math.max(1, Number(qty) || 1);
    const totalCost = cost * addQty;

    if (player.energy < totalCost) {
      get().addLog('系統警告', 'System Warning', '精力不足，無法進行採集！', 'Not enough energy to gather!', 'system');
      return;
    }

    const dbItem = items.find((i) => i.itemId === itemId);
    const spotName = dbItem ? dbItem.name : itemId;
    const spotNameEn = dbItem ? (dbItem.nameEn || dbItem.name) : itemId;

    set((state) => ({
      player: { ...state.player, energy: state.player.energy - totalCost },
    }));

    set((state) => {
      const existing = state.inventory.find((i) => i.itemId === itemId);
      let updatedInv;
      if (existing) {
        updatedInv = state.inventory.map((i) =>
          i.itemId === itemId ? { ...i, count: (i.count || 1) + addQty } : i
        );
      } else {
        updatedInv = [
          ...state.inventory,
          { itemId, count: addQty, quality: '普通' },
        ];
      }
      return { inventory: updatedInv };
    });

    const qtySuffix = addQty > 1 ? ` x${addQty}` : '';
    get().addLog('採集系統', 'Gather System', `在【${spotName}】成功採集獲得 [${spotName}]${qtySuffix}！(精力 -${totalCost})`, `Gathered [${spotNameEn}]${qtySuffix} at [${spotNameEn}]! (-${totalCost} Energy)`, 'event');

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
      const requiredTotalCount = req.quantity * numCraftQty;
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
        (i) => i.itemId === selectedId
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
      const dbI = items.find((i) => i.itemId === invItem.itemId);
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
      if (curCount < requiredTotalCount) {
        get().addLog(
          '製作系統',
          'Craft System',
          `合成失敗！所選材料數量不足（需 ≥${requiredTotalCount}）。`,
          `Craft failed! Selected material count insufficient (req >= ${requiredTotalCount}).`,
          'system'
        );
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
    if (firstSelId) {
      const selectedMatInv = inventory.find((i) => i.itemId === firstSelId);
      if (selectedMatInv) {
        const matDbItem = items.find((i) => i.itemId === selectedMatInv.itemId);
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

    set({ inventory: updatedInv });

    const recipeName = recipe.name;
    const recipeNameEn = recipe.nameEn || recipe.name;
    const qtySuffix = numCraftQty > 1 ? ` x${numCraftQty}` : '';
    get().addLog('製作系統', 'Craft System', `成功合成了道具 [${recipeName}]${qtySuffix}！`, `Successfully crafted [${recipeNameEn}]${qtySuffix}!`, 'event');

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

  useItem: async (inventoryItemId, qty = 1) => {
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

    const hpGain = (dbItem?.nutrition?.hp || 0) * useCount;
    const strGain = (dbItem?.nutrition?.strength || 0) * useCount;

    const currentHp = player.hp ?? 100;
    const maxHp = player.maxHp ?? 100;
    const newHp = hpGain !== 0 ? Math.min(maxHp, currentHp + hpGain) : currentHp;

    const currentStr = player.str ?? 1;
    const newStr = strGain !== 0 ? currentStr + strGain : currentStr;

    let updatedInv = [...inventory];
    if (availableCount <= useCount) {
      updatedInv.splice(invIndex, 1);
    } else {
      updatedInv[invIndex] = {
        ...invItem,
        count: availableCount - useCount,
      };
    }

    set((state) => ({
      player: {
        ...state.player,
        hp: newHp,
        str: newStr,
      },
      inventory: updatedInv,
    }));

    const itemName = dbItem ? dbItem.name : invItem.itemId;
    const itemNameEn = dbItem ? (dbItem.nameEn || dbItem.name) : invItem.itemId;

    let effectStr = '';
    let effectStrEn = '';
    if (hpGain !== 0) {
      effectStr += ` (回復 HP +${hpGain})`;
      effectStrEn += ` (+${hpGain} HP)`;
    }
    if (strGain !== 0) {
      effectStr += ` (力量 +${strGain})`;
      effectStrEn += ` (+${strGain} STR)`;
    }

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
          inventory: updatedInv,
        }),
      });
      if (!res.ok) {
        set({ mongoStatus: 'offline', isDisconnected: true });
      }
    } catch {
      set({ mongoStatus: 'offline', isDisconnected: true });
    }

    return true;
  },

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
    const pStr = player.stats?.strength ?? player.str ?? 1;
    const pDef = player.stats?.defense ?? 0;

    const eSpeed = creature.stats?.speed ?? 1;
    const eStr = creature.stats?.strength ?? creature.stats?.str ?? 5;
    const eDef = creature.stats?.defense ?? 0;
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
        const hitRate = Math.min(1, Math.max(0.1, (pSpeed - eSpeed) / eSpeed * 0.5 + 0.5));
        const isHit = Math.random() <= hitRate;
        const damage = isHit ? Math.max(1, pStr - eDef) : 0;

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

              const existingIdx = updatedInv.findIndex((i) => i.itemId === drop.itemId);
              if (existingIdx >= 0) {
                updatedInv[existingIdx] = {
                  ...updatedInv[existingIdx],
                  count: (updatedInv[existingIdx].count || 1) + dropQty,
                };
              } else {
                updatedInv.push({
                  itemId: drop.itemId,
                  count: dropQty,
                  quality: '普通',
                });
              }

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
        const hitRate = Math.min(1, Math.max(0.1, (eSpeed - pSpeed) / pSpeed * 0.5 + 0.5));
        const isHit = Math.random() <= hitRate;
        const damage = isHit ? Math.max(1, eStr - pDef) : 0;

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
