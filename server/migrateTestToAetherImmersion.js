import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('[Migration Error] MONGODB_URI not found in environment.');
  process.exit(1);
}

const migrate = async () => {
  try {
    console.log('[Migration] Connecting to MongoDB cluster...');
    await mongoose.connect(mongoURI);
    console.log('[Migration] Connected successfully!');

    const client = mongoose.connection.client;
    const testDb = client.db('test');
    const targetDb = client.db('AetherImmersion');

    // 1. Migrate players collection
    console.log('[Migration] Checking test.players...');
    const testPlayers = await testDb.collection('players').find({}).toArray();
    console.log(`[Migration] Found ${testPlayers.length} documents in test.players.`);

    if (testPlayers.length > 0) {
      for (const playerDoc of testPlayers) {
        await targetDb.collection('players').replaceOne(
          { _id: playerDoc._id },
          playerDoc,
          { upsert: true }
        );
        console.log(`[Migration] Migrated player: ${playerDoc.name || playerDoc._id}`);
      }
      console.log(`[Migration] Copied ${testPlayers.length} players to AetherImmersion.players.`);
      await testDb.collection('players').drop();
      console.log('[Migration] Dropped collection test.players.');
    } else {
      console.log('[Migration] No documents found in test.players.');
    }

    // 2. Migrate gamelogs collection
    console.log('[Migration] Checking test.gamelogs...');
    const testLogs = await testDb.collection('gamelogs').find({}).toArray();
    console.log(`[Migration] Found ${testLogs.length} documents in test.gamelogs.`);

    if (testLogs.length > 0) {
      for (const logDoc of testLogs) {
        await targetDb.collection('gamelogs').replaceOne(
          { _id: logDoc._id },
          logDoc,
          { upsert: true }
        );
      }
      console.log(`[Migration] Copied ${testLogs.length} gamelogs to AetherImmersion.gamelogs.`);
      await testDb.collection('gamelogs').drop();
      console.log('[Migration] Dropped collection test.gamelogs.');
    } else {
      console.log('[Migration] No documents found in test.gamelogs.');
    }

    console.log('[Migration] Migration process complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[Migration Error]:', err);
    process.exit(1);
  }
};

migrate();
