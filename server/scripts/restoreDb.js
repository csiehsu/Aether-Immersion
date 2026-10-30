import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const backupsDir = path.join(rootDir, 'backups');

const EJSON = mongoose.mongo.BSON.EJSON;

/**
 * 尋找 backups 目錄下最新的備份資料夾
 * @param {string} [filterDbName=''] - 可選篩選特定的資料庫開頭
 * @returns {string|null} 最新備份的完整路徑
 */
const findLatestBackupDir = (filterDbName = '') => {
  if (!fs.existsSync(backupsDir)) return null;
  const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !filterDbName || name.startsWith(filterDbName))
    .sort()
    .reverse();

  return dirs.length > 0 ? path.join(backupsDir, dirs[0]) : null;
};

/**
 * 執行資料庫還原主函式
 * @param {string} backupDirPath - 備份資料夾路徑 (相對或絕對路徑，若未指定則自動採用最新一筆)
 * @param {string} targetDbName - 目標還原資料庫名稱 ('AetherImmersion' 或 'AetherImmersion_dev')
 * @param {boolean} [isConfirmed=false] - 是否確認執行還原 (正式庫必須確認)
 */
export async function restoreDatabase(backupDirPath, targetDbName, isConfirmed = false) {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('[Restore Error] 請確認 .env 中已設定 MONGODB_URI！');
    process.exit(1);
  }

  // 若未傳入指定路徑，自動選取最新的備份
  let sourceDir = backupDirPath ? path.resolve(rootDir, backupDirPath) : findLatestBackupDir(targetDbName);
  if (!sourceDir && !backupDirPath) {
    sourceDir = findLatestBackupDir();
  }

  if (!sourceDir || !fs.existsSync(sourceDir)) {
    console.error(`[Restore Error] 找不到備份資料夾: ${sourceDir || backupDirPath}`);
    console.error('請確認 backups/ 目錄下是否存在備份，或指定正確的路徑。');
    process.exit(1);
  }

  // 正式庫防手滑保護
  if (targetDbName === 'AetherImmersion' && !isConfirmed) {
    console.error('====================================================');
    console.error('⚠️ [安全阻擋] 您正嘗試將備份資料還原至【線上正式資料庫 AetherImmersion】！');
    console.error('此動作將清空並覆寫線上真實玩家與場景資料！');
    console.error('若您確實要執行還原，請在指令後方加上 --confirm 參數：');
    console.error('範例: npm run db:restore:prod -- --confirm');
    console.error('====================================================');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🔄 開始執行資料庫還原作業');
  console.log(`備份來源目錄: ${path.relative(rootDir, sourceDir)}`);
  console.log(`目標還原資料庫: [${targetDbName}]`);
  console.log('====================================================');

  const conn = await mongoose.createConnection(mongoURI, { dbName: targetDbName }).asPromise();

  try {
    const files = fs.readdirSync(sourceDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== 'metadata.json');

    if (jsonFiles.length === 0) {
      console.warn('[Restore Warning] 備份目錄中未發現任何集合 JSON 檔案！');
      return;
    }

    let totalRestored = 0;

    for (const file of jsonFiles) {
      const colName = path.basename(file, '.json');
      const filePath = path.join(sourceDir, file);
      const rawContent = fs.readFileSync(filePath, 'utf8');

      // 使用 BSON EJSON 反序列化，精確還原原生 ObjectId 與 Date
      const docs = EJSON.parse(rawContent);

      const col = conn.collection(colName);
      const delRes = await col.deleteMany({});

      let insertedCount = 0;
      if (Array.isArray(docs) && docs.length > 0) {
        const insRes = await col.insertMany(docs);
        insertedCount = insRes.insertedCount;
      }
      totalRestored += insertedCount;

      console.log(`  📦 還原集合 [${colName}]: 清除原 ${delRes.deletedCount} 筆 ➔ 成功寫入 ${insertedCount} 筆資料！`);
    }

    console.log('\n====================================================');
    console.log('✅ 資料庫還原圓滿完成！');
    console.log(`共處理集合數: ${jsonFiles.length} | 總還原筆數: ${totalRestored}`);
    console.log(`目標資料庫 [${targetDbName}] 已成功還原至備份狀態！`);
    console.log('====================================================');
  } catch (err) {
    console.error('[Restore Error] 還原過程發生錯誤：', err);
    throw err;
  } finally {
    await conn.close();
  }
}

// 命令列執行進入點
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('restoreDb.js') ||
  process.argv[1].endsWith('restoreDb')
);

if (isDirectExecution) {
  const args = process.argv.slice(2);
  const isProd = args.includes('--prod') || args.includes('--production');
  const isConfirmed = args.includes('--confirm') || args.includes('-y') || args.includes('--force');
  const targetDb = isProd ? 'AetherImmersion' : 'AetherImmersion_dev';

  // 檢查是否傳入自訂備份路徑 (非 flag 參數)
  const pathArg = args.find((a) => !a.startsWith('-'));

  restoreDatabase(pathArg, targetDb, isConfirmed);
}
