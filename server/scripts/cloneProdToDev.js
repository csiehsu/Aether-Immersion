import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const PROD_DB_NAME = 'AetherImmersion';
const DEV_DB_NAME = 'AetherImmersion_dev';

/**
 * 將線上正式資料庫 (AetherImmersion) 的資料安全鏡像複製至本機測試資料庫 (AetherImmersion_dev)。
 * 僅單向讀取 PROD，嚴格保護正式環境資料安全。
 *
 * @param {string[]|null} [targetCollections=null] - 指定要複製的集合清單；若為 null 或空陣列則自動複製所有集合
 */
export async function cloneProdToDev(targetCollections = null) {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('[Clone Error] 請確認 .env 中已設定 MONGODB_URI！');
    process.exit(1);
  }

  const prodConn = await mongoose.createConnection(mongoURI, { dbName: PROD_DB_NAME }).asPromise();
  const devConn = await mongoose.createConnection(mongoURI, { dbName: DEV_DB_NAME }).asPromise();

  try {
    let colsToClone = targetCollections;
    if (!colsToClone || colsToClone.length === 0 || colsToClone === 'all') {
      const allCollections = await prodConn.db.listCollections().toArray();
      colsToClone = allCollections
        .map((c) => c.name)
        .filter((name) => !name.startsWith('system.'));

      if (colsToClone.length === 0) {
        colsToClone = ['locations', 'players', 'gamelogs', 'items', 'npcs', 'recipes', 'buildings', 'quests', 'battleskills'];
      }
    }

    console.log('====================================================');
    console.log('🚀 準備執行資料庫鏡像複製 (Production -> Development)');
    console.log(`來源 (唯讀): [${PROD_DB_NAME}]`);
    console.log(`目標 (寫入): [${DEV_DB_NAME}]`);
    console.log(`複製集合 (${colsToClone.length} 個): ${colsToClone.join(', ')}`);
    console.log('====================================================');

    let totalCopiedDocs = 0;
    for (const colName of colsToClone) {
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
        totalCopiedDocs += insertResult.insertedCount;
      } else {
        console.log('[Clone] 來源集合為空，略過寫入。');
      }
    }

    console.log('\n====================================================');
    console.log(`✅ 複製作業全部完成！共複製 ${colsToClone.length} 個集合、${totalCopiedDocs} 筆資料。`);
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

  // 若使用者在命令列明確指定集合（非以 -- 開頭的參數），則只複製指定集合；否則預設複製所有集合
  const customCollections = args.filter((arg) => !arg.startsWith('--'));
  const collections = customCollections.length > 0 ? customCollections : null;

  cloneProdToDev(collections);
}
