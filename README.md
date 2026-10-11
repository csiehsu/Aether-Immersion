# ⚓ Aether Immersion - 專案架構與系統說明文件

---

## 📁 1. 專案目錄結構 (Directory Structure)

```text
AetherImmersion/
├── server/                           # 後端 Express API 伺服器
│   ├── config/
│   │   └── db.js                     # MongoDB Mongoose 連線與 Fallback 處理
│   ├── models/                       # Mongoose 資料模型 (9 大核心 Schema)
│   │   ├── BattleSkill.js            # 戰鬥技能 Schema
│   │   ├── Building.js               # 設施/建築物 Schema
│   │   ├── GameLog.js                # 遊戲日誌 Schema
│   │   ├── Item.js                   # 道具資料與營養數值 Schema
│   │   ├── Location.js               # 地點、路線連接與地面放置物品 Schema
│   │   ├── Npc.js                    # NPC、生物、交易清單與掉落物 Schema
│   │   ├── Player.js                 # 玩家角色資料、三維能力值、水分飽食度與任務 Schema
│   │   ├── Quest.js                  # 任務目標、前置條件、接取與完成獎勵 Schema
│   │   └── Recipe.js                 # 合成製作配方 Schema
│   ├── routes/                       # Express 路由模組
│   │   ├── api.js                    # 遊戲主要 RESTful API (集合查詢/創角/採集/交易/拾取/任務/日誌)
│   │   └── auth.js                   # Google OAuth 驗證與本機 Fallback 登入路由
│   ├── seeds/                        # 初始預設種子資料 (7 大資料庫集合)
│   │   ├── seedBattleSkills.js       # 初始戰鬥技能種子資料
│   │   ├── seedBuildings.js          # 初始建築物種子資料
│   │   ├── seedItems.js              # 初始道具種子資料
│   │   ├── seedLocations.js          # 初始地點場景種子資料
│   │   ├── seedNpcs.js               # 初始 NPC / 生物種子資料
│   │   ├── seedQuests.js             # 初始任務種子資料
│   │   └── seedRecipes.js            # 初始製作配方種子資料
│   ├── utils/
│   │   └── dbHelper.js               # DB 連線狀態判定、集合查詢初始化與實體 ID 生成 Helper
│   └── index.js                      # 後端伺服器主進入點 (Port 5000)
├── src/                              # 前端 React 應用程式 (Vite + Zustand)
│   ├── assets/                       # 靜態圖片資源 (場景背景圖、各類視覺圖)
│   ├── components/                   # 共用 React 元件
│   │   ├── common/
│   │   │   └── QuantitySelector.jsx  # 🔢 數量增減調節選擇器元件 (+1/-1, +10/-10, 手動輸入)
│   │   ├── panels/                   # 功能子面板模組
│   │   │   ├── CraftPanel.jsx        # 🔨 物品製作面板 (設施工具檢驗、材料扣減、批量合成)
│   │   │   ├── CreaturesPanel.jsx    # 🐾 區域生物面板 (生物資訊、攻擊發起、任務狀態)
│   │   │   ├── GatherPanel.jsx       # 🌿 區域資源面板 (NPC 互動買賣/任務、採集點、場景建築)
│   │   │   ├── InventoryPanel.jsx    # 🎒 冒險背包面板 (道具詳情、品質、耐久度、營養效果、批量食用)
│   │   │   ├── LocationItemsPanel.jsx# 📍 現場物品面板 (地面掉落物拾取、任務道具觸發)
│   │   │   ├── LogPanel.jsx          # 📜 對話與系統紀錄面板 (分類篩選、發送對話)
│   │   │   └── MovePanel.jsx         # 🧭 地點移動面板 (相鄰場景路徑移動、精力消耗)
│   │   ├── BottomToolbar.jsx         # 📱 底部行動版/直立式功能分頁切換列
│   │   ├── CollapsiblePanel.jsx      # 📦 可折疊展開通用面板容器外殼 (Glassmorphism 樣式)
│   │   ├── GoogleLoginButton.jsx     # 🔑 Google OAuth 登入按鈕與帳號狀態頭像元件
│   │   ├── GameInterface.jsx         # 🎮 遊戲主要操作視圖與三欄版面/行動版視口容器
│   │   └── TopHUD.jsx                # 📊 頂部抬頭狀態列 (血條/精力條/水分飽食度/金錢/設定選單)
│   ├── constants/
│   │   └── translations.js           # 雙語字典檔 (繁體中文 `zh-TW` / 英文 `en`)
│   ├── store/
│   │   └── useGameStore.js           # Zustand 全域狀態管理與後端 API 動作處置中心
│   ├── utils/
│   │   ├── gameHelpers.js            # 遊戲實體圖示、實體 ID、能力值校準、背包堆疊與戰鬥計算
│   │   ├── language.js               # 雙語在地化名稱與說明文本解析工具函式
│   │   └── questHelpers.js           # 任務可接取判斷、NPC 進行中任務檢索與完成提交驗證
│   ├── views/                        # 頂層畫面路由視圖
│   │   ├── CharacterCreationView.jsx # 角色創立畫面 (引路導師選擇、三維能力值 30 點分配)
│   │   ├── DisconnectedView.jsx      # 伺服器離線 / 資料庫未連線提示畫面
│   │   └── LoginView.jsx             # 遊戲入口登入畫面
│   ├── App.jsx                       # 前端根元件與畫面分流路由
│   ├── App.css / index.css           # 全域 Glassmorphism 視覺風格樣式表
│   └── main.jsx                      # React Vite 應用程式掛載入口
├── eslint.config.js                  # ESLint 9 Flat Config 嚴格語法檢查設定
├── index.html                        # 前端主頁面 HTML
├── package.json                      # 專案依賴與執行指令設定
└── vite.config.js                    # Vite 打包構建設定檔
```

---

## 🧩 2. 前端架構與程式碼模組說明 (Frontend Architecture)

### 核心進入點與狀態管理 (Core & Store)
| 檔案路徑 | 主要功能與職責 | 說明與關聯 |
| :--- | :--- | :--- |
| `src/main.jsx` | React 應用程式掛載點。 | 將 `<App />` 掛載於 `#root`。 |
| `src/App.jsx` | 頂層畫面路由器。 | 初始化執行 `syncFromMongo()`；依據 `isDisconnected` 與 `screenMode` 切換顯示 `DisconnectedView`、`LoginView`、`CharacterCreationView` 或 `GameInterface`。 |
| `src/store/useGameStore.js` | Zustand 全域狀態管理中心。 | 封裝所有 API 呼叫，管理玩家資料、背包、場景、配方、生物、技能、任務與日誌，並提供 `consumeItem`、`performCraft`、`performBuy`、`performSell`、`startBattle` 等核心動作。 |
| `src/constants/translations.js` | 雙語字典庫。 | 定義繁體中文 (`zh-TW`) 與英文 (`en`) 的 UI 標籤、能力值名稱、按鈕與系統提示。 |

### 通用工具模組 (Utils)
| 檔案路徑 | 主要函式 | 說明與職責 |
| :--- | :--- | :--- |
| `src/utils/language.js` | `getLocalizedName(item, lang)`<br>`getLocalizedDesc(item, lang)`<br>`getLocalizedText(zh, en, lang)` | 依據當前語系代碼動態解析並回傳物件的在地化名稱或文字。 |
| `src/utils/gameHelpers.js` | `getNpcIcon(npc)`<br>`getItemIcon(item, default)`<br>`generateInstanceId(prefix)`<br>`normalizePlayerStats(stats, fallback)`<br>`addItemsToInventory(inv, id, count, opts)`<br>`calculateCombatTurn(atk, def)` | 處理 NPC/道具 Emoji、生成全域唯一實體識別碼、標準化能力值（補齊 `water`、`food` 預設 100）、背包堆疊邏輯，以及戰鬥回合命中與傷害計算。 |
| `src/utils/questHelpers.js` | `getAvailableQuestForNpc(list, player, cId, cName)`<br>`getActiveQuestForNpc(list, player, cId)`<br>`checkCanSubmitQuest(qDef, pQuest, inv)` | 驗證前置條件與等級以篩選 NPC 可接任務、檢查 NPC 是否為任務交付對象，以及驗證 `TALK_NPC`、`HAS_ITEM`、`CRAFT`、`VISIT_LOCATION` 等目標是否達成。 |

### 畫面視圖 (Views)
| 檔案路徑 | 主要功能與職責 |
| :--- | :--- |
| `src/views/LoginView.jsx` | 登入畫面。提供港口背景氛圍、伺服器連線狀態徽章、語系切換器與 Google 帳號登入入口。 |
| `src/views/CharacterCreationView.jsx` | 創角畫面。讓玩家自訂名稱、選擇引路導師（瑪莎 Martha、加利克 Garrick、凡斯 Vance、布洛克 Brock），並分配 30 點初始能力值（力量 `strength`、速度 `speed`、精巧 `dexterity`，每項最低 1 點）。 |
| `src/views/DisconnectedView.jsx` | 斷線畫面。當後端服務離線或資料庫無法連線時顯示警示，並提供「重新連線」按鈕。 |

### 核心遊戲介面與佈局 (Layout & Components)
| 檔案路徑 | 主要功能與職責 |
| :--- | :--- |
| `src/components/GameInterface.jsx` | 遊戲主操作介面。支援桌面版三欄式佈局與行動版自適應全螢幕視口 + 浮層抽屜面板 + 📍 地點說明彈窗。 |
| `src/components/TopHUD.jsx` | 頂部抬頭狀態列。顯示玩家頭像、詳細能力值下拉視窗（力量、速度、精巧、防禦、水分、飽食度）、設定選單（DB 狀態、Google 連動、語系切換、版面切換）、精力條與金錢數值。 |
| `src/components/BottomToolbar.jsx` | 行動版底部導覽工具列。包含移動、製作、區域資源、現場物品、背包、對話紀錄等分頁按鈕。 |
| `src/components/CollapsiblePanel.jsx` | 可折疊通用面板容器外殼，提供統一的 Glassmorphism 標題與摺疊開闔互動。 |
| `src/components/GoogleLoginButton.jsx` | 整合 Google OAuth 驗證登入與本機 Fallback 示範登入按鈕。 |
| `src/components/common/QuantitySelector.jsx` | 數量調節元件。支援 `+1`/`-1`、`+10`/`-10`、手動數值輸入與邊界範圍限制。 |

### 功能面板模組 (Panels)
| 檔案路徑 | 主要功能與職責 |
| :--- | :--- |
| `src/components/panels/MovePanel.jsx` | **🧭 移動面板**：顯示玩家已知且與當前地點相連的路徑，扣除精力並切換當前地點。 |
| `src/components/panels/CraftPanel.jsx` | **🔨 製作面板**：檢驗當前場景建築與背包工具、檢查材料是否足夠，支援使用 `QuantitySelector` 批量合成產物，並推進 CRAFT 類型任務。 |
| `src/components/panels/GatherPanel.jsx` | **🌿 區域資源面板**：依當前地點整合 NPC 互動（交易買賣購買/收購、任務接取/交付、發起戰鬥）、資源採集點（批量採集消耗精力）與建築設施資訊。 |
| `src/components/panels/LocationItemsPanel.jsx` | **📍 現場物品面板**：顯示當前地點地面的遺留物品，支援拾取入背包或透過撿起特殊信件觸發任務。 |
| `src/components/panels/InventoryPanel.jsx` | **🎒 冒險背包面板**：檢視背包道具數量、品質、耐久度與食用營養效果，支援使用 `QuantitySelector` 批量食用並將營養累加至各項能力值。 |
| `src/components/panels/CreaturesPanel.jsx` | **🐾 區域生物面板**：獨立檢視當前區域 NPC/怪物狀態、任務提示徽章，以及攻擊戰鬥切換。 |
| `src/components/panels/LogPanel.jsx` | **📜 對話紀錄面板**：即時滾動檢視對話、系統通知與事件日誌，支援依類型篩選與玩家自訂訊息發送。 |

---

## ⚙️ 3. 後端架構與程式碼模組說明 (Backend Architecture)

### 進入點與資料庫設定
| 檔案路徑 | 主要功能與職責 |
| :--- | :--- |
| `server/index.js` | Express 伺服器主進入點。掛載 CORS、JSON 中介軟體，註冊 API 路由，啟動 HTTP 伺服器 (Port 5000)。 |
| `server/config/db.js` | 連線至 MongoDB 資料庫。若連線失敗輸出警告並啟用 Fallback 模式。 |
| `server/utils/dbHelper.js` | 共用 Helper 函式庫：<br>• `isDbConnected()`: 檢查資料庫是否在線<br>• `fetchCollectionData(Model, initialData)`: 統一查詢集合，為空時自動載入種子資料初始化<br>• `generateInstanceId(prefix)`: 生成全域唯一實體識別碼 |

### 資料模型 (Mongoose Models)
| 檔案路徑 | 集合名稱 | 說明與欄位結構 |
| :--- | :--- | :--- |
| `server/models/Player.js` | `players` | 玩家核心資料：包含 `name`、`mentor`、`stats`（`strength`, `speed`, `dexterity`, `maxHp`, `defense`, `water`, `food`）、`hp`、`energy`、`maxEnergy`、`money`、`location`、`knownLocations`、`unlockedRecipes`、`inventory`、`quests`、`isLoggedIn`、`isCharacterCreated` 等。 |
| `server/models/Item.js` | `items` | 道具定義：包含 `itemId`、名稱與描述、類型、耐久度、重量、圖片 URL，以及營養數值 `nutrition`（`hp`, `strength`, `speed`, `dexterity`, `defense`, `maxHp`, `water`, `food`）。 |
| `server/models/Location.js` | `locations` | 場景地點：包含 `locationId`、雙語名稱與描述、背景圖片、相連地點 `connections`（含精力消耗）、可採集資源 `gatherables`、區域 NPC 清單 `npcs`、設施 `buildings`、以及地面放置物品 `placedItems`。 |
| `server/models/Recipe.js` | `recipes` | 合成配方：包含 `recipeId`、需求材料 `requiredItems`、產出項目 `outputItems`、需求設施/工具類型 `requiredToolTypes` 與解鎖條件。 |
| `server/models/Npc.js` | `npcs` | NPC 與野外生物：包含 `npcId`、類型 (`HUMAN` / `MONSTER`)、能力值、販售商品清單 `goodies`、收購清單 `purchase`、掉落物清單 `drops` 與戰鬥技能。 |
| `server/models/Building.js` | `buildings` | 建築與設施：包含 `buildingId`、類型 (`HEATING`, `CRAFTING` 等) 與雙語名稱。 |
| `server/models/BattleSkill.js` | `battleskills` | 戰鬥技能：包含 `skillId`、技能名稱、冷卻時間、消耗精力與傷害倍率。 |
| `server/models/Quest.js` | `quests` | 任務系統：包含 `questId`、觸發類型 (`NPC` 或 `ITEM`)、觸發對象、交付對象、目標清單 `objectives`（`TALK_NPC`, `HAS_ITEM`, `CRAFT`, `VISIT_LOCATION`）、接取發放獎勵 `grantsOnAccept`、完成獎勵 `rewards`、自動解鎖地點/配方、以及連鎖自動接取任務 `autoTriggerQuestId`。 |
| `server/models/GameLog.js` | `gamelogs` | 遊戲歷史日誌：包含發送時間、發送者、內文、類型 (`dialogue` / `system` / `event`)。 |

### API 端點與路由 (RESTful API Routes)
| 請求方法 | 端點路徑 | 說明與處理邏輯 |
| :--- | :--- | :--- |
| `GET` | `/api/health` | 檢查 MongoDB 連線狀態與資料庫名稱。 |
| `GET` | `/api/items` | 取得所有道具資料庫集合。 |
| `GET` | `/api/locations` | 取得所有場景地點資料（含現場放置物品）。 |
| `GET` | `/api/recipes` | 取得所有合成製作配方清單。 |
| `GET` | `/api/npcs` | 取得所有 NPC 與生物清單。 |
| `GET` | `/api/buildings` | 取得所有建築設施清單。 |
| `GET` | `/api/battle-skills` | 取得所有戰鬥技能清單。 |
| `GET` | `/api/quests` | 取得所有任務定義清單。 |
| `GET` | `/api/player` | 取得目前登入玩家資料；自動補齊數值並動態建立導師自訂個人房間。 |
| `POST` | `/api/player/create-character` | 創立新角色。驗證名稱與能力值（力量+速度+靈巧=30），動態建立導師房間與連線路徑。 |
| `PUT` | `/api/player` | 更新玩家資料（能力值、背包、已知地點、解鎖配方、任務進度等）。 |
| `POST` | `/api/player/gather` | 執行資源採集。驗證並扣除精力，增加道具至玩家背包。 |
| `POST` | `/api/location/pickup-item` | 拾取場景中的地面放置道具 (`placedItems`)，轉移至玩家背包並自場景中移除。 |
| `POST` | `/api/quest/accept` | 接取任務。建立任務進行中進度、發放接取獎勵（物品/地點/配方），若由地面物品觸發則一併拾取。 |
| `POST` | `/api/quest/submit` | 提交完成任務。驗證目標、發放獎勵、扣除觸發道具、發放完成文字，並支援連鎖自動承接下一階段任務。 |
| `GET` | `/api/logs` | 取得最新的 20 筆遊戲歷史日誌。 |
| `POST` | `/api/logs` | 新增一筆日誌訊息紀錄。 |
| `POST` | `/api/auth/google` | 驗證 Google ID Token 憑證，並自動建立/同步玩家帳號資料。 |
| `POST` | `/api/auth/logout` | 登出帳號並將玩家狀態重設為未登入。 |

---

## 🔄 4. 資料流與系統機制 (Game Systems & Data Flow)

### 1. 角色屬性與生命數值系統 (Player Attributes)
- **基礎三維能力值**：
  - **力量 (strength)**：影響物理輸出傷害與勞力型工作。
  - **速度 (speed)**：決定回合制戰鬥先手順序與攻擊命中率。
  - **靈巧 (dexterity)**：專案全域統一使用 `dexterity`，影響技術型作業與特殊行為。
- **生存數值**：
  - **生命值 (hp / maxHp)**：玩家目前體力與生命上限。
  - **防禦力 (defense)**：減免戰鬥時所受傷害。
  - **精力值 (energy / maxEnergy)**：預設最大值為 4320，移動地點與採集資源時消耗。
  - **水分 (water)**：生存核心指標，初始預設值為 100。
  - **飽食度 (food)**：生存核心指標，初始預設值為 100。

### 2. 道具消耗與營養機制 (Consumable Nutrition System)
- 全專案統一使用 `consumeItem` 函式，取消舊版別名與相容性設計。
- 消耗品道具不再提供或增減 `energy`。
- 道具的 `nutrition`（包含 `hp`, `strength`, `speed`, `dexterity`, `defense`, `maxHp`, `water`, `food`）在食用時**採累加制（Additive）加至玩家當前數值上，而非取代（Overwrite）玩家數值**。
- 支援透過 `QuantitySelector` 自訂數量批量食用。

### 3. 現場物品與地面拾取 (Placed Items System)
- 場景 Schema 包含 `placedItems` 陣列，代表散落於地面的實體道具。
- 玩家可透過 `LocationItemsPanel` 查看地面物品：
  - 一般物品：點擊「撿起」透過 `/api/location/pickup-item` 移入玩家背包。
  - 任務信件/信物：標有 `triggerQuestId`，點擊「接受」即觸發 `/api/quest/accept` 接取關聯任務並將道具拾取入背包。

### 4. 任務系統機制 (Quest System)
- 支援多種目標類型：`TALK_NPC`（對話）、`HAS_ITEM`（持有道具）、`CRAFT`（物品製作）、`VISIT_LOCATION`（造訪地點）。
- 支援等級限制（`minLevel`）與前置任務依賴（`prerequisites: [{ type: 'QUEST_COMPLETED', targetId }]`）。
- 支援接取時立即獎勵（`grantsOnAccept`：發放初始道具、解鎖地點或配方）。
- 提交完成時發放獎勵（金錢、物品、解鎖地點/配方，任務獎勵不包含線索 clues），並支援 `autoRemoveTriggerItemOnComplete` 自動扣除任務道具，以及透過 `autoTriggerQuestId` 連鎖自動接取後續章節任務。

### 5. 商店交易系統 (NPC Trading)
- 人類（HUMAN）NPC 支援各自獨立的販售清單（`goodies`）與收購清單（`purchase`）。
- 整合 `QuantitySelector` 數量選擇器，可根據金錢預算或背包庫存批量購買與出售。
- 買賣時即時同步玩家金錢（`player.money`）與背包陣列至後端資料庫。

### 6. 即時回合制戰鬥系統 (Turn-Based Combat)
- 在區域資源面板中對野外怪物發起戰鬥（`startBattle`）。
- **先手判定**：比較雙方速度（`speed`），速度較高者取得第一回合先手權。
- **命中計算**：依據攻擊方與防守方的速度差動態計算命中率：`hitRate = Math.min(1, Math.max(0.1, ((atkSpeed - defSpeed) / defSpeed) * 0.5 + 0.5))`。
- **傷害計算**：命中時傷害為 `damage = Math.max(1, atkStr - defDef)`。
- **戰利品結算**：擊敗生物後依據敵方 `drops` 掉落清單隨機產生物品並加入背包。

### 7. 導師制度與個人房間動態生成 (Mentor & Custom Room)
- 創角時可由 4 位導師中選擇引路人：瑪莎（雜貨店）、加利克（小吃店）、凡斯（海產店）、布洛克（布洛克家）。
- 系統自動呼叫 `ensureCustomRoom`，為玩家動態建立個人專屬房間（例如 `AZURE_BAY_VARIETY_SHOP_玩家名稱_ROOM`），並與導師商店建立雙向路徑連接。

---

## 🚀 5. 本地開發與啟動指南 (Setup & Getting Started)

### 1. 安裝相依套件
```bash
npm install
```

### 2. 環境變數設定 (`.env`)
在專案根目錄確認或建立 `.env` 檔案：
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/AetherImmersion?retryWrites=true&w=majority
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```
*(若未設定 Google Client ID，系統將自動啟動 Demo 模擬登入模式供開發測試)*

### 3. 啟動後端 Express API 伺服器
```bash
node server/index.js
```
- API 服務網址：`http://localhost:5000`
- 健康檢查端點：`http://localhost:5000/api/health`

### 4. 啟動前端 Vite 開發伺服器
```bash
npm run dev
```
- 前端網頁介面：`http://localhost:5173`

### 5. 語法檢查與生產環境打包測試
```bash
# 執行 ESLint 程式碼檢查
npm run lint

# 執行 Vite 生產打包構建
npm run build
```
