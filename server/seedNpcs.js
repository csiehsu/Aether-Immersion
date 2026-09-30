import 'dotenv/config';
import { connectDB } from './config/db.js';
import { Npc } from './models/Npc.js';

export const initialNpcs = [
  {
    npcId: 'Seagull',
    name: '海鷗',
    nameEn: 'Seagull',
    description: '常在碼頭偷吃魚肉的靈敏海鳥。',
    descriptionEn: 'Nimble bird scavenging fish around docks.',
    imageUrl: '',
    icon: '🕊️',
    type: 'MONSTER',
    stats: {
      strength: 5,
      speed: 10,
      dexterity: 2,
      spiritual: 0,
      defense: 2,
      maxHP: 20,
      maxMP: 0,
    },
    drops: [
      {
        itemId: 'item001',
        dropRate: 1,
      },
    ],
    skills: [
      {
        skillId: 'normal_attack',
        level: 1,
      },
    ],
  },
  {
    npcId: 'Crab',
    name: '螃蟹',
    nameEn: 'Crab',
    description: '具有堅硬外殼與鋒利巨鉗。',
    descriptionEn: 'Armored crab with sharp pincers.',
    imageUrl: '',
    icon: '🦀',
    type: 'MONSTER',
    stats: {
      strength: 10,
      speed: 1,
      dexterity: 5,
      spiritual: 0,
      defense: 2,
      maxHP: 50,
      maxMP: 0,
    },
    drops: [],
    skills: [
      {
        skillId: 'normal_attack',
        level: 1,
      },
    ],
  },
  {
    npcId: 'Jellyfish',
    name: '水母',
    nameEn: 'Jellyfish',
    description: '彈性十足，會將觸手伸上岸邊尋找獵物。',
    descriptionEn: 'Remarkably resilient and elastic, it extends its tentacles onto the shore in search of prey.',
    imageUrl: '',
    icon: '🪼',
    type: 'MONSTER',
    stats: {
      strength: 2,
      speed: 1,
      dexterity: 10,
      spiritual: 0,
      defense: 1,
      maxHP: 10,
      maxMP: 0,
    },
    drops: [],
    skills: [
      {
        skillId: 'normal_attack',
        level: 1,
      },
    ],
  },
  {
    npcId: 'Cook',
    name: '小吃店老闆',
    nameEn: 'Cook',
    description: '店內的香氣四溢，吸引著大街上的人潮。',
    descriptionEn: 'Mouthwatering aromas spilled from the shop, drawing in the crowds from the bustling avenue.',
    imageUrl: '',
    icon: '👨‍🍳',
    type: 'HUMAN',
    stats: {},
    drops: [],
    skills: [],
  },
  {
    npcId: 'Grocer',
    name: '雜貨店老闆',
    nameEn: 'Grocer',
    description: '各種生活用品一應俱全。',
    descriptionEn: 'Fully stocked with every everyday essential you could possibly need.',
    imageUrl: '',
    icon: '🛒',
    type: 'HUMAN',
    stats: {},
    drops: [],
    skills: [],
  },
];

export const seedNpcs = async () => {
  try {
    // Keep only valid NPCs
    await Npc.deleteMany({ npcId: { $nin: ['Seagull', 'Crab', 'Jellyfish', 'Cook', 'Grocer'] } });

    for (const npcData of initialNpcs) {
      await Npc.findOneAndUpdate(
        { npcId: npcData.npcId },
        npcData,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }
    console.log('[Seed NPCs] 5 NPCs (Seagull, Crab, Jellyfish, Cook, Grocer) seeded into MongoDB.');
  } catch (err) {
    console.error('[Seed NPCs Error]', err.message);
  }
};

// Run directly if called from command line
if (process.argv[1] && process.argv[1].endsWith('seedNpcs.js')) {
  (async () => {
    const connected = await connectDB();
    if (connected) {
      await seedNpcs();
    }
    process.exit(0);
  })();
}
