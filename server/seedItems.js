import 'dotenv/config';
import { connectDB } from './config/db.js';
import { Item } from './models/Item.js';

export const initialItems = [
  {
    itemId: 'item001',
    name: '小魚',
    nameEn: 'Small Fish',
    description: '一條充滿活力的小魚，尾巴還在奮力的拍打著。',
    descriptionEn: 'A lively small fish, its tail still flapping energetically.',
    imageUrl: 'https://res.cloudinary.com/duqyw1uhq/image/upload/v1757598031/basic_fish_aingye.png',
    type: 'INGREDIENTS',
    durability: -1,
    weight: 1,
    smell: {
      type: 'FISHY',
      level: 2,
    },
    nutrition: {
      strength: 0.1,
      hp: -10,
    },
  },
  {
    itemId: 'item002',
    name: '烤小魚',
    nameEn: 'Grilled Small Fish',
    description: '香噴噴的烤小魚。',
    descriptionEn: 'Deliciously fragrant grilled small fish.',
    imageUrl: 'https://res.cloudinary.com/duqyw1uhq/image/upload/v1757679176/cooked_basic_fish_atrtcd.png',
    type: 'FOOD',
    durability: -1,
    weight: 1,
    smell: {
      type: 'ROASTY',
      level: 5,
    },
    nutrition: {
      strength: 0.1,
      hp: 10,
    },
  },
];

export const seedItems = async () => {
  try {
    for (const itemData of initialItems) {
      await Item.findOneAndUpdate(
        { itemId: itemData.itemId },
        itemData,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }
    console.log('[Seed Items] Updated item001 type to INGREDIENTS and item002 type to FOOD.');
  } catch (err) {
    console.error('[Seed Items Error]', err.message);
  }
};

// Run directly if called from command line
if (process.argv[1] && process.argv[1].endsWith('seedItems.js')) {
  (async () => {
    const connected = await connectDB();
    if (connected) {
      await seedItems();
    }
    process.exit(0);
  })();
}
