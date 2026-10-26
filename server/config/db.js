import mongoose from 'mongoose';

/**
 * 取得目前環境目標資料庫名稱。
 * 1. 優先使用 process.env.MONGODB_DB_NAME
 * 2. 次之若 process.env.NODE_ENV === 'production' 則使用 'AetherImmersion'（正式玩家資料庫）
 * 3. 本機開發環境預設使用 'AetherImmersion_dev'（開發測試資料庫）
 * @returns {string} 目標資料庫名稱
 */
export const getTargetDbName = () => {
  if (process.env.MONGODB_DB_NAME) {
    return process.env.MONGODB_DB_NAME;
  }
  return process.env.NODE_ENV === 'production' ? 'AetherImmersion' : 'AetherImmersion_dev';
};

/**
 * 連線至 MongoDB 資料庫。
 * 若連線失敗則輸出警告訊息，伺服器將以 Fallback 模式運作。
 * @returns {Promise<boolean>} 連線成功回傳 true，連線失敗回傳 false。
 */
export const connectDB = async () => {
  const dbName = getTargetDbName();
  const mongoURI = process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${dbName}`;

  try {
    const conn = await mongoose.connect(mongoURI, {
      dbName,
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[MongoDB] 連線成功！資料庫: [${conn.connection.name}] (環境: ${process.env.NODE_ENV || 'development'}, 主機: ${conn.connection.host})`);
    return true;
  } catch (err) {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB at ${mongoURI} (db: ${dbName}). Error: ${err.message}`);
    console.warn('[MongoDB Warning] Server will run in Memory Fallback Mode.');
    return false;
  }
};
