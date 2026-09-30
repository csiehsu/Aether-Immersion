# ⚓ Aether Immersion - 專案架構與程式碼說明文件

---

## 📁 1. 專案目錄結構 (Directory Structure)

```text
AetherImmersion/
├── server/                           # 後端 Express API 伺服器
│   ├── config/
│   │   └── db.js                     # MongoDB Mongoose 連線設定
│   ├── models/                       # Mongoose 資料模型 Schema
│   │   ├── GameLog.js                # 遊戲日誌 Schema
│   │   ├── Item.js                   # 道具資料 Schema
│   │   ├── Location.js               # 地點資料 Schema
│   │   ├── Npc.js                    # NPC / 怪物資料 Schema
│   │   ├── Player.js                 # 玩家資料 Schema
│   │   └── Recipe.js                 # 合成配方 Schema
│   ├── routes/                       # Express 路由模組
│   │   ├── api.js                    # 遊戲主要 RESTful API
│   │   └── auth.js                   # Google OAuth 驗證路由
│   ├── utils/
│   │   └── dbHelper.js               # DB 連線檢查與記憶體備援查詢 Helper
│   └── index.js                      # 後端伺服器主進入點
└── src/                              # 前端 React 應用程式
    ├── assets/                       # 靜態圖片資源 (背景圖、圖片)
    ├── components/                   # 共用 React 元件
    │   ├── panels/                   # 6 大功能子面板
    │   │   ├── CraftPanel.jsx        # 🔨 物品製作面板
    │   │   ├── CreaturesPanel.jsx    # 🐾 區域生物/NPC 面板
    │   │   ├── GatherPanel.jsx       # 🌿 資源採集面板
    │   │   ├── InventoryPanel.jsx    # 🎒 冒險背包面板
    │   │   ├── LogPanel.jsx          # 📜 對話與系統紀錄面板
    │   │   └── MovePanel.jsx         # 🧭 地點移動面板
    │   ├── BottomToolbar.jsx         # 底部直立/行動版切換工具列
    │   ├── CollapsiblePanel.jsx      # 面板通用可摺疊容器外殼
    │   ├── GoogleLoginButton.jsx     # Google 登入按鈕元件
    │   ├── PortGameInterface.jsx     # 遊戲主介面與版面控制容器
    │   └── TopHUD.jsx                # 頂部狀態列 (血條/精力條/設定/角色資訊)
    ├── constants/
    │   └── translations.js           # 雙語字典檔 (繁體中文 / 英文)
    ├── store/
    │   └── useGameStore.js           # Zustand 全域狀態管理與 API 動作處置
    ├── utils/
    │   ├── gameHelpers.js            # 遊戲 Emoji 圖示與顯示輔助函式
    │   └── language.js               # 多國語言文字提取工具函式
    ├── views/                        # 主要畫面
    │   ├── CharacterCreationView.jsx # 創角畫面 (名稱輸入與 30 點屬性分配)
    │   └── LoginView.jsx             # 登入首頁畫面
    ├── App.jsx                       # 前端根元件與畫面路由分流
    ├── App.css / index.css           # 全域 Glassmorphism 樣式與佈局 CSS
    └── main.jsx                      # React Vite 掛載點
```

---

## 🧩 2. 前端程式碼功能與關聯說明 (Frontend Architecture)

### 核心進入點與狀態管理 (Core & Store)
| 檔案路徑 | 主要功能與職責 | 關聯與調用對象 |
| :--- | :--- | :--- |
| `src/main.jsx` | React 應用程式進入點，將 `<App />` 掛載至 HTML DOM `#root` 上。 | 引用 `src/App.jsx`。 |
| `src/App.jsx` | 前端根元件。初始化進行 DB 同步（`syncFromMongo()`），並根據 Zustand 的 `screenMode` 切換顯示畫面。 | 調用 `src/store/useGameStore.js`；引用 `src/views/LoginView.jsx`, `src/views/CharacterCreationView.jsx`, `src/components/PortGameInterface.jsx`。 |
| `src/store/useGameStore.js` | Zustand 全域狀態中心。儲存玩家屬性、背包、地點、配方、NPC、日誌、多語系設定與 View Mode，並封裝所有 REST API 請求動作。 | 引用 `src/constants/translations.js`；供全專案元件訂閱與調用。 |
| `src/constants/translations.js` | 專案雙語字庫字典檔，定義 `zh-TW` 與 `en` 的標籤、按鈕文字、系統提示語。 | 供 `src/store/useGameStore.js` 與各 UI 元件引用。 |

### 通用工具模組 (Utils)
| 檔案路徑 | 主要功能與職責 | 關聯與調用對象 |
| :--- | :--- | :--- |
| `src/utils/language.js` | 提供 `getLocalizedName`、`getLocalizedDesc` 與 `getLocalizedText` 工具函式，依據當前語系安全取得中文或英文文本。 | 被所有 UI 面板與主介面引用。 |
| `src/utils/gameHelpers.js` | 提供 `getNpcIcon` 與 `getItemIcon` 工具函式，處理 NPC 預設 Emoji 與道具備援圖示。 | 被 `src/components/panels/CreaturesPanel.jsx` 與 `src/components/panels/GatherPanel.jsx` 引用。 |

### 畫面 (Views)
| 檔案路徑 | 主要功能與職責 | 關聯與調用對象 |
| :--- | :--- | :--- |
| `src/views/LoginView.jsx` | 遊戲登入畫面。包含背景氛圍圖、標語、資料庫連線狀態徽章、語言切換與 Google 登入進入點。 | 調用 `src/components/GoogleLoginButton.jsx` 與 `src/store/useGameStore.js`。 |
| `src/views/CharacterCreationView.jsx` | 角色創立畫面。允許玩家輸入角色名稱，並自由分配 30 點初始能力值（力量 `str`、速度 `spd`、精巧 `dex`，每項最低 1 點）。 | 調用 `useGameStore.createCharacter()`。 |

### 核心遊戲介面與框架 (Layout Components)
| 檔案路徑 | 主要功能與職責 | 關聯與調用對象 |
| :--- | :--- | :--- |
| `src/components/PortGameInterface.jsx` | 遊戲主介面容器。支援桌面版（左右 6 欄雙側邊欄）與行動版（單一抽屜 + 底部工具列 + 📍 地點說明彈窗）。 | 引用 `TopHUD.jsx`, `BottomToolbar.jsx` 以及 6 大子面板。 |
| `src/components/TopHUD.jsx` | 頂部狀態列。顯示玩家頭像、等級、可點擊彈出之能力值詳情面板（HP、力量、速度、精巧），以及齒輪設定選單（DB 狀態、Google 帳號連動、語系切換、版面開關）。 | 引用 `GoogleLoginButton.jsx` 與 `translations.js`。 |
| `src/components/BottomToolbar.jsx` | 行動版 / 直立式檢視下固定於底部的 6 大功能頁籤分頁按鈕列。 | 傳遞頁籤點擊事件至 `PortGameInterface.jsx`。 |
| `src/components/CollapsiblePanel.jsx` | 可摺疊面板通用外殼元件。提供統一的 Glassmorphism 標題列、折疊箭頭與展開/收合動畫容器。 | 被 6 大功能面板引用包裹。 |
| `src/components/GoogleLoginButton.jsx` | 封裝 Google Identity Services 驗證與離線備援登入按鈕。 | 被 `TopHUD.jsx` 與 `LoginView.jsx` 調用。 |

### 6 大功能子面板 (Panels)
| 檔案路徑 | 主要功能與職責 | 關聯與調用對象 |
| :--- | :--- | :--- |
| `src/components/panels/MovePanel.jsx` | **🧭 地點移動面板**：列出玩家已解鎖之地點（如翠潯灣港口、翠潯灣商店街），點擊切換當前地點。 | 使用 `CollapsiblePanel.jsx`；調用 `useGameStore.changeLocation()`。 |
| `src/components/panels/CraftPanel.jsx` | **🔨 物品製作面板**：顯示合成配方、需求材料與等級，進行物品合成。 | 使用 `CollapsiblePanel.jsx`；調用 `useGameStore.performCraft()`。 |
| `src/components/panels/GatherPanel.jsx` | **🌿 資源採集面板**：根據玩家當前地點取得 DB 中對應採集點，消耗精力採集獲得道具。 | 使用 `CollapsiblePanel.jsx`；調用 `useGameStore.performGather()`。 |
| `src/components/panels/InventoryPanel.jsx` | **🎒 冒險背包面板**：顯示玩家目前擁有的道具、數量、品質與圖片。 | 使用 `CollapsiblePanel.jsx`；比對 `items` 資料庫。 |
| `src/components/panels/CreaturesPanel.jsx` | **🐾 區域生物面板**：**依當前地點過濾顯示 NPC**。怪物（MONSTER）顯示 `⚔️ 攻擊` 按鈕；人類（HUMAN）顯示 `🤝 交易` 按鈕。 | 使用 `CollapsiblePanel.jsx`；調用 `useGameStore.addLog()`。 |
| `src/components/panels/LogPanel.jsx` | **📜 對話紀錄面板**：即時顯示區域對話、系統通知與事件日誌，並提供對話輸入發送框與分流 Chip。 | 使用 `CollapsiblePanel.jsx`；調用 `useGameStore.addLog()`。 |

---

## ⚙️ 3. 後端程式碼功能與關聯說明 (Backend Architecture)

### 進入點與設定 (Entry & Configuration)
| 檔案路徑 | 主要功能與職責 | 關聯與調用對象 |
| :--- | :--- | :--- |
| `server/index.js` | Express 後端主進入點。初始化 CORS 與 JSON 解析中介軟體、連線 MongoDB Atlas，並啟動 HTTP 伺服器 (Port 5000)。 | 引用 `server/config/db.js`, `server/routes/api.js`, `server/routes/auth.js`。 |
| `server/config/db.js` | 管理 Mongoose 與 MongoDB Atlas 的連線生命週期與錯誤監聽。 | 被 `server/index.js` 調用。 |
| `server/utils/dbHelper.js` | 後端共用 Helper：`isDbConnected()` 判定 DB 狀態；`fetchCollectionData()` 提供統一的 MongoDB / 記憶體備援資料查詢。 | 被 `server/routes/api.js` 與 `server/routes/auth.js` 引用。 |

### RESTful API 路由與驗證 (Routes)
| 檔案路徑 | 主要功能與職責 | 關聯與調用對象 |
| :--- | :--- | :--- |
| `server/routes/api.js` | 提供 `/api/health`, `/api/items`, `/api/locations`, `/api/recipes`, `/api/npcs`, `/api/player`, `/api/player/create-character`, `/api/player/gather`, `/api/logs` 端點。支援資料庫連線與離線記憶體備援雙模式。 | 引用所有 Mongoose Models 與 `server/utils/dbHelper.js`。 |
| `server/routes/auth.js` | 提供 `/api/auth/google` 與 `/api/auth/logout` 驗證路由。解析 Google Credential JWT Token 並自動同步/建立 Player 資料。 | 引用 `server/models/Player.js` 與 `server/utils/dbHelper.js`。 |

### 資料模型 (Mongoose Models & Schemas)
| 檔案路徑 | 主要功能與職責 |
| :--- | :--- |
| `server/models/Player.js` | 玩家 Schema：包含角色名稱、能力值 (`str`, `spd`, `dex`)、HP、精力 (`energy`)、地點 (`location`)、已知地點陣列、背包陣列、Google 帳號資訊。 |
| `server/models/Location.js` | 地點 Schema：包含 `locationId`、雙語名稱/描述、圖片、可採集資源列表 (`gatherables`)、連接地點 (`connections`) 與區域 NPC 列表 (`npcs`)。 |
| `server/models/Item.js` | 道具 Schema：包含 `itemId` (`item001` 小魚, `item002` 烤小魚)、雙語名稱/描述、圖片 URL、類型 (食材/料理)、耐用度與重量。 |
| `server/models/Recipe.js` | 配方 Schema：包含 `recipeId` (`recipe001` 燒烤)、產出項目列表 (`outputItems`)、需求材料列表 (`requiredItems`) 與需求工具類型 (`requiredToolTypes`)。 |
| `server/models/Npc.js` | NPC/生物 Schema：包含 `npcId` (Seagull, Crab, Jellyfish, Cook, Grocer)、類型 (MONSTER / HUMAN)、能力值、掉落物與技能列表。 |
| `server/models/GameLog.js` | 遊戲日誌 Schema：紀錄發送時間、發送者、內文、雙語對照與日誌類別 (dialogue / system / event)。 |

---

## 🔄 4. 資料流與組件運作互動 (Data Flow Summary)

1. **初始化啟動**：
   - 前端掛載時發起 `syncFromMongo()`，並行請求 `/api/health`, `/api/items`, `/api/locations`, `/api/recipes`, `/api/npcs`, `/api/player` 與 `/api/logs`。
   - 若後端連線至 MongoDB Atlas，則讀取 Atlas 實體資料；若斷線或離線，自動切換至內建 Memory Fallback 資料，確保遊戲體驗不受中斷。

2. **畫面分流 (Screen Router)**：
   - 未登入時顯示 `src/views/LoginView.jsx` 畫面。
   - 登入後未創角時進入 `src/views/CharacterCreationView.jsx` 畫面，玩家分配 30 點屬性後呼叫 `/api/player/create-character` 存檔。
   - 完成創角後進入 `src/components/PortGameInterface.jsx` 主介面。

3. **依地點動態渲染與互動 (Location-Based Dynamics)**：
   - 玩家移動地點時，`CreaturesPanel` 根據 `currentLocation.npcs`（如港口包含 `Seagull`, `Crab`, `Jellyfish`；商店街包含 `Cook`, `Grocer`）過濾僅顯示當前區域的 NPC。
   - 點擊按鈕時，人類（HUMAN）觸發 `🤝 交易` 日誌，怪物（MONSTER）觸發 `⚔️ 攻擊` 戰鬥日誌。
   - `GatherPanel` 則依據 `currentLocation.gatherables` 動態比對 `items` 資料庫顯示採集點（如港口的 `item001` 小魚），扣除精力並增加玩家背包物品數量。

---

## 🚀 5. 本地開發啟動步驟 (Getting Started)

### 1. 安裝套件
```bash
npm install
```

### 2. 設定環境變數 (.env)
在專案根目錄建立 `.env` 檔案：
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/AetherImmersion?retryWrites=true&w=majority
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 3. 啟動後端 Express API 伺服器
```bash
node server/index.js
```

### 4. 啟動前端 Vite 開發伺服器
```bash
npm run dev
```

### 5. 執行生產環境打包測試
```bash
npm run build
```
