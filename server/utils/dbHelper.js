import mongoose from 'mongoose';

/**
 * Helper to check if MongoDB database is connected.
 */
export const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Query helper to fetch documents from a MongoDB Model.
 * Automatically seeds from initialData if database collection is empty.
 * Throws an error if MongoDB is disconnected.
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
