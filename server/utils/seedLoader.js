import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedsDir = path.join(__dirname, '../seeds');

/**
 * 安全動態載入本機種子資料。
 * 若檔案不存在（如雲端正式部署環境，未包含受保護的種子檔案），
 * 則自動回傳空陣列，保護遊戲探索內容不外洩，並確保伺服器平順以 MongoDB 純資料庫模式啟動。
 *
 * @returns {Promise<{
 *   initialItems: Array<Object>,
 *   initialLocations: Array<Object>,
 *   initialRecipes: Array<Object>,
 *   initialNpcs: Array<Object>,
 *   initialBuildings: Array<Object>,
 *   initialBattleSkills: Array<Object>,
 *   initialQuests: Array<Object>
 * }>} 種子資料物件
 */
export async function getSeedData() {
  const emptySeeds = {
    initialItems: [],
    initialLocations: [],
    initialRecipes: [],
    initialNpcs: [],
    initialBuildings: [],
    initialBattleSkills: [],
    initialQuests: [],
  };

  if (!fs.existsSync(seedsDir)) {
    console.log('[SeedLoader] 未檢測到本機種子資料夾，伺服器以純資料庫 (MongoDB) 模式運作。');
    return emptySeeds;
  }

  try {
    const loadSeed = async (filename, propName) => {
      const fullPath = path.join(seedsDir, filename);
      if (!fs.existsSync(fullPath)) return [];
      const fileUrl = pathToFileURL(fullPath).href;
      const mod = await import(fileUrl);
      return Array.isArray(mod[propName]) ? mod[propName] : [];
    };

    const [
      initialItems,
      initialLocations,
      initialRecipes,
      initialNpcs,
      initialBuildings,
      initialBattleSkills,
      initialQuests,
    ] = await Promise.all([
      loadSeed('seedItems.js', 'initialItems'),
      loadSeed('seedLocations.js', 'initialLocations'),
      loadSeed('seedRecipes.js', 'initialRecipes'),
      loadSeed('seedNpcs.js', 'initialNpcs'),
      loadSeed('seedBuildings.js', 'initialBuildings'),
      loadSeed('seedBattleSkills.js', 'initialBattleSkills'),
      loadSeed('seedQuests.js', 'initialQuests'),
    ]);

    return {
      initialItems,
      initialLocations,
      initialRecipes,
      initialNpcs,
      initialBuildings,
      initialBattleSkills,
      initialQuests,
    };
  } catch (err) {
    console.warn('[SeedLoader Warning] 載入本機種子資料失敗，安全降級為純資料庫模式：', err.message);
    return emptySeeds;
  }
}
