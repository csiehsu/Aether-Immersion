import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/AetherImmersion';

  try {
    const conn = await mongoose.connect(mongoURI, {
      dbName: 'AetherImmersion',
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return true;
  } catch (err) {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB at ${mongoURI}. Error: ${err.message}`);
    console.warn('[MongoDB Warning] Server will run in Memory Fallback Mode.');
    return false;
  }
};
