import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { settleItemDecay, addItemToPlacedItems } from '../../shared/utils/gameHelpers.js';

dotenv.config();

const PROD_DB_NAME = 'AetherImmersion';
const DEV_DB_NAME = 'AetherImmersion_dev';

/**
 * 將線上正式資料庫 (AetherImmersion) 的資料安全鏡像複製至本機測試資料庫 (AetherImmersion_dev)。
 * 僅單向讀取 PROD，嚴格保護正式環境資料安全。
 *
 * @param {string[]} [targetCollections] - 指定要複製的集合清單
 * @param {boolean} [shouldConsolidate=false] - 複製後是否立即對測試庫現有散落物執行加權整併測試
 */
export async function cloneProdToDev(targetCollections = ['locations', 'players', 'gamelogs'], shouldConsolidate = false) {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('[Clone Error] 請確認 .env 中已設定 MONGODB_URI！');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🚀 準備執行資料庫鏡像複製 (Production -> Development)');
  console.log(`來源 (唯讀): [${PROD_DB_NAME}]`);
  console.log(`目標 (寫入): [${DEV_DB_NAME}]`);
  console.log(`複製集合: ${targetCollections.join(', ')}`);
  console.log('====================================================');

  const prodConn = await mongoose.createConnection(mongoURI, { dbName: PROD_DB_NAME }).asPromise();
  const devConn = await mongoose.createConnection(mongoURI, { dbName: DEV_DB_NAME }).asPromise();

  try {
    for (const colName of targetCollections) {
      console.log(`\n[Clone] 正在處理集合: [${colName}]...`);
      const prodCollection = prodConn.collection(colName);
      const devCollection = devConn.collection(colName);

      const docs = await prodCollection.find({}).toArray();
      console.log(`[Clone] 自 ${PROD_DB_NAME} 讀取到 ${docs.length} 筆資料。`);

      const deleteResult = await devCollection.deleteMany({});
      console.log(`[Clone] 已清空 ${DEV_DB_NAME} 原有資料 (共刪除 ${deleteResult.deletedCount} 筆)。`);

      if (docs.length > 0) {
        const insertResult = await devCollection.insertMany(docs);
        console.log(`[Clone] 成功複製 ${insertResult.insertedCount} 筆資料至 ${DEV_DB_NAME}！`);
      } else {
        console.log(`[Clone] 來源集合為空，略過寫入。`);
      }
    }

    // 若指定 --compact 或 --consolidate，在 dev 資料庫執行一次分級加權整併
    if (shouldConsolidate) {
      console.log('\n====================================================');
      console.log('🧪 正在測試環境 [AetherImmersion_dev] 執行現存散落物加權整併...');
      console.log('====================================================');

      const devLocations = devConn.collection('locations');
      const devItems = devConn.collection('items');
      const allDbItems = await devItems.find({}).toArray();

      const locations = await devLocations.find({}).toArray();
      for (const loc of locations) {
        if (Array.isArray(loc.placedItems) && loc.placedItems.length > 0) {
          const originalCount = loc.placedItems.length;
          
          // 利用 addItemToPlacedItems 逐一進行新堆疊規則收納
          let consolidatedPlacedItems = [];
          for (const item of loc.placedItems) {
            consolidatedPlacedItems = addItemToPlacedItems(consolidatedPlacedItems, item, allDbItems);
          }

          // 再次執行一次 settleItemDecay 保證同檔位完整收納
          const { updatedItems } = settleItemDecay(consolidatedPlacedItems, allDbItems, { isPlayer: false });

          await devLocations.updateOne(
            { _id: loc._id },
            { $set: { placedItems: updatedItems } }
          );

          console.log(`[Consolidate] 地點 [${loc.locationId}]: 地面物品由 ${originalCount} 筆獨立實體 成功壓縮為 ${updatedItems.length} 筆分級堆疊！`);
          updatedItems.forEach((p, idx) => {
            console.log(`  └─ [${idx + 1}] ${p.itemId} x${p.count} (耐久度: ${p.durability}/${p.maxDurability})`);
          });
        }
      }
    }

    console.log('\n====================================================');
    console.log('✅ 複製作業全部完成！');
    console.log(`現在您可以於本機啟動伺服器 (npm run dev:full 或 npm run server)，`);
    console.log(`本機將直接連線至 [${DEV_DB_NAME}] 進行各項操作與堆疊測試！`);
    console.log('====================================================');
  } catch (err) {
    console.error('[Clone Error] 執行過程發生錯誤：', err);
  } finally {
    await prodConn.close();
    await devConn.close();
  }
}

// 命令列執行進入點
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('cloneProdToDev.js') ||
  process.argv[1].endsWith('cloneProdToDev')
);

if (isDirectExecution) {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isCompact = args.includes('--compact') || args.includes('--consolidate');

  const collections = isAll
    ? ['locations', 'players', 'gamelogs', 'items', 'npcs', 'recipes', 'buildings', 'quests', 'battleskills']
    : ['locations', 'players', 'gamelogs'];

  cloneProdToDev(collections, isCompact);
}
