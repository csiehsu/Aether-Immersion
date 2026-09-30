import 'dotenv/config';
import { connectDB } from './config/db.js';
import { Location } from './models/Location.js';

export const initialLocations = [
  {
    locationId: 'AZURE_BAY_PORT',
    name: '翠潯灣港口',
    nameEn: 'Azure Bay Port',
    description: '各種船隻進出，水手們的聚集地。',
    descriptionEn: 'Bustling harbor where ships drop anchor and sailors gather.',
    image: '',
    gatherables: [
      {
        itemId: 'item001',
        chance: 100,
      },
    ],
    connections: [
      {
        targetLocationId: 'PIONEER_CABIN',
        staminaCost: 5,
      },
      {
        targetLocationId: 'AZURE_BAY_MARKET',
        staminaCost: 1,
      },
    ],
    npcs: ['Seagull', 'Crab', 'Jellyfish'],
    hasEvent: false,
  },
  {
    locationId: 'AZURE_BAY_MARKET',
    name: '翠潯灣商店街',
    nameEn: 'Azure Bay Market',
    description: '直通港口的大街，左右兩邊商店攤販林立，海的腥味、食物的香味、人群的喧鬧聲交織在一起。',
    descriptionEn: 'A lively market street filled with vendors and shops, filled with the salty sea breeze and delicious aromas.',
    image: 'https://res.cloudinary.com/duqyw1uhq/image/upload/v1790500710/Port_tw69qf.png',
    connections: [
      {
        targetLocationId: 'AZURE_BAY_PORT',
        staminaCost: 1,
      },
    ],
    gatherables: [],
    npcs: ['Cook', 'Grocer'],
    hasEvent: false,
  },
];

export const seedLocations = async () => {
  try {
    for (const locData of initialLocations) {
      await Location.findOneAndUpdate(
        { locationId: locData.locationId },
        locData,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }
    console.log('[Seed Locations] Locations updated with npcs list in MongoDB Atlas (AZURE_BAY_PORT: Seagull, Crab, Jellyfish | AZURE_BAY_MARKET: Cook, Grocer).');
  } catch (err) {
    console.error('[Seed Locations Error]', err.message);
  }
};

// Run directly if called from command line
if (process.argv[1] && process.argv[1].endsWith('seedLocations.js')) {
  connectDB().then(() => seedLocations().then(() => process.exit(0)));
}
