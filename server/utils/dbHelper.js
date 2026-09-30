import mongoose from 'mongoose';

/**
 * Helper to check if MongoDB database is connected.
 */
export const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Generic query helper to fetch documents from a MongoDB Model,
 * seeding automatically from initialData if collection is empty,
 * or returning initialData if DB is offline.
 */
export const fetchCollectionData = async (Model, initialData) => {
  if (isDbConnected()) {
    let docs = await Model.find();
    if (!docs || docs.length === 0) {
      docs = await Model.insertMany(initialData);
    }
    return { source: 'mongodb', data: docs };
  }
  return { source: 'memory', data: initialData };
};
