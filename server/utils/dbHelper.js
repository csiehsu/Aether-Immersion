import mongoose from 'mongoose';

/**
 * 檢查目前 MongoDB 資料庫連線狀態。
 * @returns {boolean} 連線成功且就緒回傳 true，否則回傳 false。
 */
export const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * 統一查詢 MongoDB 集合資料的 Helper 函式。
 * 若集合為空，會自動由 initialData 進行種子資料初始化。
 * @param {import('mongoose').Model} Model - Mongoose 資料模型。
 * @param {Array<Object>} initialData - 若集合為空時預設寫入的初始資料陣列。
 * @throws {Error} 當資料庫未連線時拋出錯誤。
 * @returns {Promise<{ source: string, data: Array<Object> }>} 包含來源識別與資料陣列的物件。
 */
export const fetchCollectionData = async (Model, initialData) => {
  if (!isDbConnected()) {
    throw new Error('資料庫未連線，請稍後重試！');
  }
  let docs = await Model.find();
  if (!docs || docs.length === 0) {
    docs = await Model.insertMany(initialData);
  }
  return { source: 'mongodb', data: docs };
};

/**
 * 生成全域唯一的實體識別碼 (Instance ID)。
 * @param {string} [prefix='inst'] - 識別碼前綴字串。
 * @returns {string} 包含前綴、時間戳與隨機字串的唯一識別碼。
 */
export const generateInstanceId = (prefix = 'inst') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};
