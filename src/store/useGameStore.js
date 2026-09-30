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
  mongoStatus: 'offline',

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

  // Player Stats
  player: {
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
  },

  // Active Tab for Mobile/Portrait view
  activeTab: 'move',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // MongoDB Items Data
  items: [
    {
      itemId: 'item001',
      name: '小魚',
      nameEn: 'Small Fish',
      description: '一條充滿活力的小魚，尾巴還在奮力的拍打著。',
      descriptionEn: 'A lively small fish, its tail still flapping energetically.',
      imageUrl: 'https://res.cloudinary.com/duqyw1uhq/image/upload/v1757598031/basic_fish_aingye.png',
      type: '食材',
      durability: -1,
      weight: 1,
    },
    {
      itemId: 'item002',
      name: '烤小魚',
      nameEn: 'Grilled Small Fish',
      description: '香噴噴的烤小魚。',
      descriptionEn: 'Deliciously fragrant grilled small fish.',
      imageUrl: 'https://res.cloudinary.com/duqyw1uhq/image/upload/v1757679176/cooked_basic_fish_atrtcd.png',
      type: '料理',
      durability: -1,
      weight: 1,
    },
  ],

  // MongoDB Locations Data
  locations: [
    {
      locationId: 'AZURE_BAY_PORT',
      name: '翠潯灣港口',
      nameEn: 'Azure Bay Port',
      description: '各種船隻進出，水手們的聚集地。',
      descriptionEn: 'Bustling harbor where ships drop anchor and sailors gather.',
      image: '',
      gatherables: [{ itemId: 'item001', chance: 100 }],
      connections: [
        { targetLocationId: 'PIONEER_CABIN', staminaCost: 5 },
        { targetLocationId: 'AZURE_BAY_MARKET', staminaCost: 1 },
      ],
      hasEvent: false,
      npcs: ['Seagull', 'Crab', 'Jellyfish'],
    },
    {
      locationId: 'AZURE_BAY_MARKET',
      name: '翠潯灣商店街',
      nameEn: 'Azure Bay Market',
      description: '直通港口的大街，左右兩邊商店攤販林立，海的腥味、食物的香味、人群的喧鬧聲交織在一起。',
      descriptionEn: 'A lively market street filled with vendors and shops, filled with the salty sea breeze and delicious aromas.',
      image: 'https://res.cloudinary.com/duqyw1uhq/image/upload/v1790500710/Port_tw69qf.png',
      connections: [{ targetLocationId: 'AZURE_BAY_PORT', staminaCost: 1 }],
      gatherables: [],
      hasEvent: false,
      npcs: ['Cook', 'Grocer'],
    },
  ],

  // Crafting Recipes Data
  recipes: [
    {
      recipeId: 'recipe001',
      name: '燒烤',
      nameEn: 'Roast',
      icon: '🔥',
      outputItems: [{ type: 'FOOD', quantity: 1 }],
      requiredItems: [{ type: 'INGREDIENTS', quantity: 1 }],
      requiredToolTypes: ['HEATING'],
    },
  ],

  // Inventory Items
  inventory: [
    { id: 'item_001', itemId: 'item001', name: '小魚', nameEn: 'Small Fish', icon: '🐟', count: 1, quality: '普通' },
  ],

  // Creatures / Monsters Data
  creatures: [
    {
      npcId: 'Seagull',
      name: '海鷗',
      nameEn: 'Seagull',
      description: '常在碼頭偷吃魚肉的靈敏海鳥。',
      descriptionEn: 'Nimble bird scavenging fish around docks.',
      icon: '🕊️',
      type: 'MONSTER',
      stats: { strength: 5, speed: 10, dexterity: 2, spiritual: 0, defense: 2, maxHP: 20, maxMP: 0 },
      drops: [{ itemId: 'item001', dropRate: 1 }],
      skills: [{ skillId: 'normal_attack', level: 1 }],
    },
    {
      npcId: 'Crab',
      name: '螃蟹',
      nameEn: 'Crab',
      description: '具有堅硬外殼與鋒利巨鉗。',
      descriptionEn: 'Armored crab with sharp pincers.',
      icon: '🦀',
      type: 'MONSTER',
      stats: { strength: 10, speed: 1, dexterity: 5, spiritual: 0, defense: 2, maxHP: 50, maxMP: 0 },
      drops: [],
      skills: [{ skillId: 'normal_attack', level: 1 }],
    },
    {
      npcId: 'Jellyfish',
      name: '水母',
      nameEn: 'Jellyfish',
      description: '彈性十足，會將觸手伸上岸邊尋找獵物。',
      descriptionEn: 'Remarkably resilient and elastic, it extends its tentacles onto the shore in search of prey.',
      icon: '🪼',
      type: 'MONSTER',
      stats: { strength: 2, speed: 1, dexterity: 10, spiritual: 0, defense: 1, maxHP: 10, maxMP: 0 },
      drops: [],
      skills: [{ skillId: 'normal_attack', level: 1 }],
    },
    {
      npcId: 'Cook',
      name: '小吃店老闆',
      nameEn: 'Cook',
      description: '店內的香氣四溢，吸引著大街上的人潮。',
      descriptionEn: 'Mouthwatering aromas spilled from the shop, drawing in the crowds from the bustling avenue.',
      icon: '👨‍🍳',
      type: 'HUMAN',
      stats: {},
      drops: [],
      skills: [],
    },
    {
      npcId: 'Grocer',
      name: '雜貨店老闆',
      nameEn: 'Grocer',
      description: '各種生活用品一應俱全。',
      descriptionEn: 'Fully stocked with every everyday essential you could possibly need.',
      icon: '🛒',
      type: 'HUMAN',
      stats: {},
      drops: [],
      skills: [],
    },
  ],

  // Logs
  logs: [
    { id: 1, time: '12:00:15', sender: '碼頭老水手', senderEn: 'Old Sailor', text: '「喂！新人，歡迎來到阿埃泰爾港口。今日的海風可是相當順暢呢。」', textEn: '"Ahoy, newcomer! Welcome to Aether Port. Smooth seas today!"', type: 'dialogue' },
    { id: 2, time: '12:01:02', sender: '系統通知', senderEn: 'System', text: '您已進入【阿埃泰爾港口】安全區域。', textEn: 'Entered safe area [Aether Port].', type: 'system' },
    { id: 3, time: '12:02:40', sender: '衛兵長萊恩', senderEn: 'Captain Ryan', text: '「最近舊碼頭那邊有些異常的潮汐動靜，路過時記得多加小心。」', textEn: '"Strange tides reported near the old wharf. Keep your guard up."', type: 'dialogue' },
    { id: 4, time: '12:04:10', sender: '採集紀錄', senderEn: 'Gather Log', text: '成功採集到了 [堅硬木材] x2，消耗 5 點精力。', textEn: 'Successfully gathered [Hard Timber] x2 (-5 Energy).', type: 'event' },
  ],

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
      console.warn('[Create Character] Offline mode fallback:', err);
    }

    const maxHp = 100 + (str - 1) * 10;
    const maxEnergy = 4320;

    set((state) => ({
      player: {
        ...state.player,
        name,
        str,
        spd,
        dex,
        level: 1,
        isCharacterCreated: true,
        hp: maxHp,
        maxHp,
        energy: maxEnergy,
        maxEnergy,
      },
      screenMode: 'game',
    }));

    get().addLog(
      '創角系統',
      'Character System',
      `角色【${name}】建立成功！能力值：力量 ${str}, 速度 ${spd}, 精巧 ${dex}。`,
      `Character [${name}] created! Stats: STR ${str}, SPD ${spd}, DEX ${dex}.`,
      'system'
    );
    return true;
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
              locationEn: dbP?.locationEn || 'Azure Bay Port',
            },
            screenMode: dbP && dbP.isCharacterCreated ? 'game' : 'character_creation',
          }));

          get().addLog('系統驗證', 'Auth System', `Google 帳號 [${gUser.name}] 登入成功！`, `Google account [${gUser.name}] logged in!`, 'system');
          return true;
        }
      }
    } catch (err) {
      console.warn('[Google Auth] Offline fallback mode login:', err);
    }

    const mockUser = {
      isLoggedIn: true,
      name: 'Google 冒險者',
      email: 'adventurer@gmail.com',
      pictureUrl: null,
    };

    const isCreated = get().player.isCharacterCreated;

    set((state) => ({
      user: mockUser,
      player: { ...state.player, name: mockUser.name },
      screenMode: isCreated ? 'game' : 'character_creation',
    }));

    get().addLog('系統驗證', 'Auth System', `Google 帳號 [${mockUser.name}] 登入成功！`, `Google account [${mockUser.name}] logged in!`, 'system');
    return true;
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // Silent catch
    }

    set((state) => ({
      user: { isLoggedIn: false, name: '', email: '', pictureUrl: null },
      screenMode: 'login',
    }));

    get().addLog('系統驗證', 'Auth System', '已成功登出 Google 帳號。', 'Logged out of Google account.', 'system');
  },

  // --- MongoDB Sync Methods ---
  checkMongoStatus: async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        const status = data.mongodb === 'connected' ? 'connected' : 'offline';
        set({ mongoStatus: status });
        return status;
      }
    } catch {
      set({ mongoStatus: 'offline' });
    }
    return 'offline';
  },

  fetchItems: async () => {
    try {
      const res = await fetch(`${API_BASE}/items`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          set({ items: result.data });
        }
      }
    } catch (err) {
      console.warn('[Fetch Items] Offline fallback mode:', err);
    }
  },

  fetchLocations: async () => {
    try {
      const res = await fetch(`${API_BASE}/locations`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          set({ locations: result.data });
        }
      }
    } catch (err) {
      console.warn('[Fetch Locations] Offline fallback mode:', err);
    }
  },

  fetchRecipes: async () => {
    try {
      const res = await fetch(`${API_BASE}/recipes`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          set({ recipes: result.data });
        }
      }
    } catch (err) {
      console.warn('[Fetch Recipes] Offline fallback mode:', err);
    }
  },

  fetchNpcs: async () => {
    try {
      const res = await fetch(`${API_BASE}/npcs`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          set({ creatures: result.data });
        }
      }
    } catch (err) {
      console.warn('[Fetch NPCs] Offline fallback mode:', err);
    }
  },

  syncFromMongo: async () => {
    try {
      await get().checkMongoStatus();
      await get().fetchItems();
      await get().fetchLocations();
      await get().fetchRecipes();
      await get().fetchNpcs();
      const res = await fetch(`${API_BASE}/player`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const dbP = result.data;
          set((state) => {
            const isCreated = dbP.isCharacterCreated || false;
            const nextScreen = !dbP.isLoggedIn ? 'login' : !isCreated ? 'character_creation' : 'game';

            return {
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
                locationEn: dbP.locationEn || state.player.locationEn,
                knownLocations: (dbP.knownLocations && dbP.knownLocations.length > 0)
                  ? dbP.knownLocations
                  : state.player.knownLocations,
              },
              user: dbP.isLoggedIn
                ? { isLoggedIn: true, name: dbP.name, email: dbP.email, pictureUrl: dbP.pictureUrl }
                : state.user,
              screenMode: dbP.isLoggedIn ? nextScreen : state.screenMode,
              inventory: dbP.inventory && dbP.inventory.length > 0 ? dbP.inventory : state.inventory,
            };
          });
        }
      }
    } catch (err) {
      console.warn('[MongoDB Sync] Running in offline fallback mode:', err);
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
      await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, senderEn, text, textEn, type }),
      });
    } catch {
      // Silent catch
    }
  },

  changeLocation: async (targetLocId) => {
    const { locations, player } = get();
    const targetLoc = locations.find((l) => l.locationId === targetLocId || l.name === targetLocId);
    const locName = targetLoc ? targetLoc.name : targetLocId;

    const currentKnown = player.knownLocations || ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'];
    const updatedKnown = currentKnown.includes(targetLocId)
      ? currentKnown
      : [...currentKnown, targetLocId];

    set((state) => ({
      player: {
        ...state.player,
        location: targetLocId,
        locationEn: targetLocId,
        knownLocations: updatedKnown,
      },
    }));

    get().addLog('系統通知', 'System', `您已移動至【${locName}】。`, `Moved to [${locName}].`, 'system');

    try {
      await fetch(`${API_BASE}/player`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: targetLocId,
          locationEn: targetLocId,
          knownLocations: updatedKnown,
        }),
      });
    } catch {
      // Silent catch
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
      await fetch(`${API_BASE}/player/gather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost, yieldItem, yieldItemEn, icon }),
      });
    } catch {
      // Silent catch
    }
  },

  performCraft: (recipeName, recipeNameEn) => {
    get().addLog('製作系統', 'Craft System', `成功合成了道具 [${recipeName}]！`, `Successfully crafted [${recipeNameEn}]!`, 'event');
  },
}));
