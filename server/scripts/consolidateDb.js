import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { settleItemDecay, addItemToPlacedItems, addItemsToInventory } from '../../shared/utils/gameHelpers.js';

dotenv.config();

/**
 * 批次整併指定資料庫中的地面放置物與玩家背包，將現存散落物品依照「保鮮分級桶與加權平均耐久度」壓縮堆疊。
 *
 * @param {string} targetDbName - 目標資料庫名稱 ('AetherImmersion' 或 'AetherImmersion_dev')
 */
export async function consolidateDatabase(targetDbName) {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('[Consolidate Error] 請確認 .env 中已設定 MONGODB_URI！');
    process.exit(1);
  }

  console.log('====================================================');
  console.log(`🧹 開始執行資料庫現存物品批次整併與清理作業`);
  console.log(`目標資料庫: [${targetDbName}]`);
  console.log('====================================================');

  const conn = await mongoose.createConnection(mongoURI, { dbName: targetDbName }).asPromise();

  try {
    const locationsCol = conn.collection('locations');
    const playersCol = conn.collection('players');
    const itemsCol = conn.collection('items');

    const allDbItems = await itemsCol.find({}).toArray();

    // 1. 整理場景地面放置物品 (Location.placedItems)
    console.log('\n📦 [步驟 1/2] 正在檢查與整併全場景地面放置物...');
    const locations = await locationsCol.find({}).toArray();
    let totalLocOriginal = 0;
    let totalLocConsolidated = 0;

    for (const loc of locations) {
      if (Array.isArray(loc.placedItems) && loc.placedItems.length > 0) {
        const originalCount = loc.placedItems.length;
        totalLocOriginal += originalCount;

        // 依新規則將散落物逐一堆疊合併
        let consolidated = [];
        for (const item of loc.placedItems) {
          consolidated = addItemToPlacedItems(consolidated, item, allDbItems);
        }

        // 執行跨檔位衰減結算與同檔位無縫整併
        const { updatedItems } = settleItemDecay(consolidated, allDbItems, { isPlayer: false });
        totalLocConsolidated += updatedItems.length;

        await locationsCol.updateOne(
          { _id: loc._id },
          { $set: { placedItems: updatedItems } }
        );

        console.log(`  📍 地點 [${loc.locationId}]: ${originalCount} 筆獨立實體 ➔ 壓縮為 ${updatedItems.length} 筆分級堆疊！`);
        updatedItems.forEach((p, idx) => {
          console.log(`     [${idx + 1}] ${p.itemId} x${p.count} (耐久度: ${p.durability}/${p.maxDurability})`);
        });
      }
    }
    console.log(`  ➔ 地面放置物整理完成：全場景總件數由 ${totalLocOriginal} 筆實體 壓縮至 ${totalLocConsolidated} 筆堆疊！`);

    // 2. 整理玩家背包物品 (Player.inventory)
    console.log('\n🎒 [步驟 2/2] 正在檢查與整併所有玩家背包物品...');
    const players = await playersCol.find({}).toArray();
    let totalPlayerOriginal = 0;
    let totalPlayerConsolidated = 0;

    for (const player of players) {
      if (Array.isArray(player.inventory) && player.inventory.length > 0) {
        const originalCount = player.inventory.length;
        totalPlayerOriginal += originalCount;

        let consolidatedInv = [];
        for (const item of player.inventory) {
          consolidatedInv = addItemsToInventory(
            consolidatedInv,
            item.itemId,
            item.count || 1,
            {
              instanceId: item.instanceId,
              durability: item.durability,
              maxDurability: item.maxDurability,
              quality: item.quality,
              customName: item.customName,
              customNameEn: item.customNameEn,
              bonusNutrition: item.bonusNutrition,
              contents: item.contents,
              lastDecayedAt: item.lastDecayedAt,
            },
            allDbItems
          );
        }

        const { updatedItems } = settleItemDecay(consolidatedInv, allDbItems, { isPlayer: true });
        totalPlayerConsolidated += updatedItems.length;

        if (originalCount !== updatedItems.length) {
          await playersCol.updateOne(
            { _id: player._id },
            { $set: { inventory: updatedItems } }
          );
          console.log(`  👤 玩家 [${player.name || player._id}]: 背包由 ${originalCount} 格 ➔ 整理為 ${updatedItems.length} 格！`);
        }
      }
    }
    console.log(`  ➔ 玩家背包整理完成：全部玩家背包總實體數由 ${totalPlayerOriginal} 筆 整理為 ${totalPlayerConsolidated} 筆！`);

    console.log('\n====================================================');
    console.log(`✨ [${targetDbName}] 資料庫整併清理作業圓滿完成！`);
    console.log('====================================================');
  } catch (err) {
    console.error('[Consolidate Error] 執行過程發生錯誤：', err);
  } finally {
    await conn.close();
  }
}

// 命令列執行進入點
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('consolidateDb.js') ||
  process.argv[1].endsWith('consolidateDb')
);

if (isDirectExecution) {
  const args = process.argv.slice(2);
  const isProd = args.includes('--prod') || args.includes('--production') || process.env.NODE_ENV === 'production';
  const targetDb = isProd ? 'AetherImmersion' : 'AetherImmersion_dev';

  consolidateDatabase(targetDb);
}
