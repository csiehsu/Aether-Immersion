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
 * 格式化時間戳為可作為目錄名稱的字串 (YYYY-MM-DD_HH-mm-ss)
 * @param {Date} date
 * @returns {string}
 */
const getFormattedTimestamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d}_${hh}-${mm}-${ss}`;
};

/**
 * 執行資料庫備份主函式
 * @param {string} targetDbName - 要備份的資料庫名稱 ('AetherImmersion' 或 'AetherImmersion_dev')
 * @param {string} [customTag=''] - 自訂標籤後綴 (可選)
 */
export async function backupDatabase(targetDbName, customTag = '') {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('[Backup Error] 請確認 .env 中已設定 MONGODB_URI！');
    process.exit(1);
  }

  const timestamp = getFormattedTimestamp();
  const folderName = `${targetDbName}_${timestamp}${customTag ? `_${customTag}` : ''}`;
  const targetDir = path.join(backupsDir, folderName);

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  console.log('====================================================');
  console.log('💾 開始執行資料庫全量備份');
  console.log(`來源資料庫: [${targetDbName}]`);
  console.log(`輸出資料夾: ${path.relative(rootDir, targetDir)}`);
  console.log('====================================================');

  const conn = await mongoose.createConnection(mongoURI, { dbName: targetDbName }).asPromise();

  try {
    const collections = await conn.db.listCollections().toArray();
    const collectionNames = collections
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.'));

    const stats = {};
    let totalDocs = 0;

    for (const colName of collectionNames) {
      const col = conn.collection(colName);
      const docs = await col.find({}).toArray();

      stats[colName] = docs.length;
      totalDocs += docs.length;

      // 使用 BSON EJSON 格式序列化，確保 ObjectId、Date 等型別不失真
      const jsonContent = EJSON.stringify(docs, null, 2);
      const filePath = path.join(targetDir, `${colName}.json`);
      fs.writeFileSync(filePath, jsonContent, 'utf8');

      console.log(`  📦 備份集合 [${colName}]: 共 ${docs.length} 筆資料 ➔ 已存檔`);
    }

    // 寫入備份中繼紀錄檔
    const metadata = {
      backupTimestamp: new Date().toISOString(),
      database: targetDbName,
      customTag: customTag || null,
      collectionsCount: collectionNames.length,
      totalDocuments: totalDocs,
      collections: stats,
    };
    fs.writeFileSync(path.join(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    console.log('\n====================================================');
    console.log('✅ 資料庫備份圓滿完成！');
    console.log(`總集合數: ${collectionNames.length} | 總資料筆數: ${totalDocs}`);
    console.log(`備份存放目錄: ${targetDir}`);
    console.log('====================================================');
    return targetDir;
  } catch (err) {
    console.error('[Backup Error] 備份過程發生錯誤：', err);
    throw err;
  } finally {
    await conn.close();
  }
}

// 命令列執行進入點
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('backupDb.js') ||
  process.argv[1].endsWith('backupDb')
);

if (isDirectExecution) {
  const args = process.argv.slice(2);
  const isProd = args.includes('--prod') || args.includes('--production') || process.env.NODE_ENV === 'production';
  const targetDb = isProd ? 'AetherImmersion' : 'AetherImmersion_dev';

  let customTag = '';
  const tagIdx = args.findIndex((a) => a === '--name' || a === '--tag');
  if (tagIdx >= 0 && args[tagIdx + 1]) {
    customTag = args[tagIdx + 1].trim();
  }

  backupDatabase(targetDb, customTag);
}
