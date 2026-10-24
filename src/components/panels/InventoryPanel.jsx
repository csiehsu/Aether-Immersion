import { useState, useMemo } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { QuantitySelector } from '../common/QuantitySelector';
import {
  calculateCurrentWeight,
  calculateMaxWeight,
  isPlayerOverburdened,
  compareItemDurability,
  getItemDurabilityPercent,
  getDurabilityColor,
} from '../../utils/gameHelpers';

/**
 * 玩家背包物品清單面板元件。
 * 依物品 ID 整合顯示卡片，點開後於說明框顯示所有獨立實體小圖示與耐久度進度條。
 * 使用或丟棄時預設以最低耐久度個體優先。
 * @returns {JSX.Element}
 */
export const InventoryPanel = () => {
  const inventory = useGameStore((state) => state.inventory || []);
  const player = useGameStore((state) => state.player || {});
  const items = useGameStore((state) => state.items || []);
  const consumeItem = useGameStore((state) => state.consumeItem);
  const dropItem = useGameStore((state) => state.dropItem);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedItemId, setSelectedItemId] = useState(null);
  const [actionQty, setActionQty] = useState(1);

  const currentWeight = calculateCurrentWeight(inventory, items);
  const maxWeight = calculateMaxWeight(player);
  const isOverburdened = isPlayerOverburdened(player, inventory, items);

  // 相同 ID 的物品統合成一個項目，統計總數量
  const groupedInventory = useMemo(() => {
    const groups = [];
    const map = new Map();
    (inventory || []).forEach((item) => {
      const key = item.itemId;
      if (!map.has(key)) {
        const newGroup = {
          itemId: key,
          items: [],
          totalCount: 0,
        };
        map.set(key, newGroup);
        groups.push(newGroup);
      }
      const g = map.get(key);
      g.items.push(item);
      g.totalCount += (item.count || 1);
    });
    return groups;
  }, [inventory]);

  /**
   * 選取或取消選取道具群組。
   * @param {string} itemId - 道具識別碼。
   */
  const handleSelectItem = (itemId) => {
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
      setActionQty(1);
    } else {
      setSelectedItemId(itemId);
      setActionQty(1);
    }
  };

  const selectedGroup = groupedInventory.find((g) => g.itemId === selectedItemId);

  // 排序選中群組下的所有獨立個體：最低耐久度優先，若耐久度相同則以資料庫順序為主
  const sortedItems = useMemo(() => {
    if (!selectedGroup) return [];
    return [...selectedGroup.items].sort(compareItemDurability);
  }, [selectedGroup]);

  return (
    <CollapsiblePanel
      title={t.inventoryTitle}
      className="inventory-panel"
      headerExtra={
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: isOverburdened ? '#ef4444' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>⚖️ {currentWeight} / {maxWeight} kg</span>
        </div>
      }
    >
      {groupedInventory.length === 0 ? (
        <div className="empty-inventory-notice">
          <span>🎒 {language === 'en' ? 'Inventory is empty.' : '背包是空的。'}</span>
        </div>
      ) : (
        <div className="inventory-panel-wrapper">
          <div className="inventory-grid">
            {groupedInventory.map((group) => {
              const dbItem = items.find((i) => i.itemId === group.itemId);
              const repItem = group.items[0] || {};
              const itemName = (language === 'en' && repItem.customNameEn)
                ? repItem.customNameEn
                : (repItem.customName || (dbItem ? getLocalizedName(dbItem, language) : group.itemId));
              const imageUrl = dbItem?.imageUrl;
              const quality = repItem.quality || '普通';
              const isSelected = selectedItemId === group.itemId;

              return (
                <div
                  key={group.itemId}
                  className={`inventory-item-card quality-${quality} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(group.itemId)}
                >
                  <div className="item-icon-box">
                    {imageUrl ? (
                      <img src={imageUrl} alt={itemName} className="inventory-item-img" />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <div className="item-info">
                    <span className="item-name">{itemName}</span>
                  </div>
                  <span className="item-count">x{group.totalCount}</span>
                </div>
              );
            })}
          </div>

          {selectedGroup && (() => {
            const repItem = sortedItems[0] || {};
            const dbItem = items.find((i) => i.itemId === selectedGroup.itemId);
            const itemDesc = dbItem ? getLocalizedDesc(dbItem, language) : null;
            const dbItemTypes = Array.isArray(dbItem?.type) ? dbItem.type : (dbItem?.type ? [dbItem.type] : []);
            const isContainer = dbItemTypes.includes('CONTAINER');

            const repLiquidDbItem = (isContainer && repItem.contents && repItem.contents.amount > 0 && repItem.contents.itemId)
              ? items.find((i) => i.itemId === repItem.contents.itemId)
              : null;

            const baseWeight = dbItem?.weight ?? 1;
            const repLiquidWeight = repLiquidDbItem
              ? Math.round((repLiquidDbItem.weight ?? 0) * repItem.contents.amount * 100) / 100
              : 0;
            const singleActualWeight = Math.round((baseWeight + repLiquidWeight) * 100) / 100;
            const totalItemWeight = Math.round(sortedItems.reduce((sum, it) => {
              let itLiquidWeight = 0;
              if (isContainer && it.contents && it.contents.amount > 0 && it.contents.itemId) {
                const dbLiquid = items.find((i) => i.itemId === it.contents.itemId);
                itLiquidWeight = (dbLiquid?.weight ?? 0) * it.contents.amount;
              }
              return sum + (baseWeight + itLiquidWeight) * (it.count || 1);
            }, 0) * 10) / 10;

            const baseNutrition = (isContainer && repLiquidDbItem)
              ? (repLiquidDbItem.nutrition || {})
              : (dbItem?.nutrition || {});
            const bonusNutrition = repItem.bonusNutrition || {};
            const totalNutrition = {
              hp: (baseNutrition.hp || 0) + (bonusNutrition.hp || 0),
              strength: (baseNutrition.strength || 0) + (bonusNutrition.strength || 0),
              speed: (baseNutrition.speed || 0) + (bonusNutrition.speed || 0),
              dexterity: (baseNutrition.dexterity || 0) + (bonusNutrition.dexterity || 0),
              defense: (baseNutrition.defense || 0) + (bonusNutrition.defense || 0),
              maxHp: (baseNutrition.maxHp || 0) + (bonusNutrition.maxHp || 0),
              water: (baseNutrition.water || 0) + (bonusNutrition.water || 0),
              food: (baseNutrition.food || 0) + (bonusNutrition.food || 0),
            };

            const hasNutrition = Boolean(
              totalNutrition.hp !== 0 ||
              totalNutrition.strength !== 0 ||
              totalNutrition.dexterity !== 0 ||
              totalNutrition.speed !== 0 ||
              totalNutrition.defense !== 0 ||
              totalNutrition.maxHp !== 0 ||
              totalNutrition.water !== 0 ||
              totalNutrition.food !== 0
            );

            const totalLiquidAmount = isContainer
              ? sortedItems.reduce((sum, it) => sum + (it.contents?.amount || 0), 0)
              : 0;
            const maxActionQty = isContainer
              ? (totalLiquidAmount > 0 ? totalLiquidAmount : 1)
              : (selectedGroup.totalCount || 1);
            const showQuantitySelector = isContainer
              ? totalLiquidAmount > 1
              : (selectedGroup.totalCount || 1) > 1;

            const hasDurability =
              (dbItem?.durability !== undefined && dbItem.durability > 0) ||
              sortedItems.some(
                (it) => it.durability !== undefined && it.durability !== null && it.durability > 0
              );

            return (
              <div className="inventory-detail-window">
                {itemDesc ? (
                  <p className="inventory-detail-desc">{itemDesc}</p>
                ) : (
                  <p className="inventory-detail-desc text-muted">
                    {language === 'en' ? 'No description available.' : '暫無道具說明。'}
                  </p>
                )}

                {/* 獨立個體小圖示區（不開放點選，僅有耐久度或容器道具顯示個體狀態） */}
                {(hasDurability || isContainer) && (
                  <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        padding: '6px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {sortedItems.map((inst, instIdx) => {
                        const percent = getItemDurabilityPercent(inst, dbItem);
                        const hasDur = percent >= 0;
                        const durColor = hasDur ? getDurabilityColor(percent) : '#22c55e';
                        const hasLiquid = Boolean(
                          isContainer && inst.contents && inst.contents.amount > 0 && inst.contents.itemId
                        );
                        const liquidDbItem = hasLiquid ? items.find((i) => i.itemId === inst.contents.itemId) : null;
                        const displayImageUrl = isContainer
                          ? (liquidDbItem?.imageUrl || null)
                          : (dbItem?.imageUrl || null);

                        return (
                          <div
                            key={inst.instanceId || `${inst.itemId}_${instIdx}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '42px',
                              height: '48px',
                              padding: '3px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'default',
                              userSelect: 'none',
                            }}
                            title={
                              isContainer
                                ? (hasLiquid
                                    ? `${liquidDbItem?.name || inst.contents.itemId} (${inst.contents.amount}/${dbItem?.capacity || 10})`
                                    : (language === 'en' ? 'Empty Container' : '空容器'))
                                : (hasDur
                                    ? (language === 'en' ? 'Durability Status' : '耐久度狀態')
                                    : '')
                            }
                          >
                            {isContainer && (
                              <div style={{ fontSize: '0.65rem', color: '#cbd5e1', marginBottom: '2px', lineHeight: 1 }}>
                                {inst.contents?.amount ?? 0}/{dbItem?.capacity || 10}
                              </div>
                            )}
                            {!isContainer && hasDur && (
                              <div
                                style={{
                                  width: '100%',
                                  height: '4px',
                                  background: 'rgba(0, 0, 0, 0.6)',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                  marginBottom: '3px',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${percent}%`,
                                    height: '100%',
                                    background: durColor,
                                    transition: 'width 0.2s ease',
                                  }}
                                />
                              </div>
                            )}
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {displayImageUrl ? (
                                <img
                                  src={displayImageUrl}
                                  alt=""
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                />
                              ) : (
                                <span style={{ fontSize: '0.9rem' }}>📦</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, marginTop: '3px' }}>
                  <span>
                    ⚖️ {language === 'en' ? 'Weight' : '重量'}: {singleActualWeight} kg{repLiquidWeight > 0 ? ` (${language === 'en' ? 'Base' : '本體'} ${baseWeight} kg + ${language === 'en' ? 'Liquid' : '液體'} ${repLiquidWeight} kg)` : ''}{(selectedGroup.totalCount || 1) > 1 ? ` (${language === 'en' ? 'Total' : '總重'}: ${totalItemWeight} kg)` : ''}
                  </span>
                </div>
                {isContainer && (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, marginTop: '3px' }}>
                    <span>
                      💧 {language === 'en' ? 'Stored Liquid' : '內存液體'}: {
                        repLiquidDbItem
                          ? `${getLocalizedName(repLiquidDbItem, language)} (${repItem.contents?.amount ?? 0}/${dbItem?.capacity || 10})`
                          : `${language === 'en' ? 'Empty' : '無'} (0/${dbItem?.capacity || 10})`
                      }
                    </span>
                  </div>
                )}

                {hasNutrition && (() => {
                  const n = totalNutrition;
                  const parts = [];
                  if (n.hp) parts.push(`HP ${n.hp > 0 ? `+${n.hp}` : n.hp}`);
                  if (n.strength) parts.push(`${language === 'en' ? 'STR' : '力量'} +${n.strength}`);
                  if (n.speed) parts.push(`${language === 'en' ? 'SPD' : '速度'} +${n.speed}`);
                  if (n.dexterity) parts.push(`${language === 'en' ? 'DEX' : '精巧'} +${n.dexterity}`);
                  if (n.defense) parts.push(`${language === 'en' ? 'DEF' : '防禦'} +${n.defense}`);
                  if (n.maxHp) parts.push(`${language === 'en' ? 'Max HP' : '最大HP'} +${n.maxHp}`);
                  if (n.water) parts.push(`${language === 'en' ? 'Water' : '水分'} ${n.water > 0 ? `+${n.water}` : n.water}`);
                  if (n.food) parts.push(`${language === 'en' ? 'Food' : '飽食'} ${n.food > 0 ? `+${n.food}` : n.food}`);
                  return parts.length > 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#60a5fa', fontWeight: 500, marginTop: '4px' }}>
                      <span>{language === 'en' ? 'Nutrition' : '食用效果'}: {parts.join(', ')}</span>
                    </div>
                  ) : null;
                })()}

                <div className="detail-action-container">
                  {showQuantitySelector && (
                    <div className="detail-qty-row">
                      <span className="detail-qty-label">
                        {language === 'en' ? 'Quantity:' : '選取數量：'}
                      </span>
                      <QuantitySelector
                        value={Math.min(actionQty, maxActionQty)}
                        onChange={setActionQty}
                        min={1}
                        max={maxActionQty}
                      />
                    </div>
                  )}
                  <div className="detail-buttons-row">
                    {(hasNutrition || isContainer) && (
                      <button
                        type="button"
                        className="btn-use-item"
                        disabled={isContainer && totalLiquidAmount <= 0}
                        style={isContainer && totalLiquidAmount <= 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (isContainer && totalLiquidAmount <= 0) return;
                          const qtyToConsume = Math.min(actionQty, maxActionQty);
                          const prevTotal = selectedGroup.totalCount || 1;
                          const success = await consumeItem(selectedGroup.itemId, qtyToConsume);
                          if (success) {
                            if (!isContainer) {
                              if (prevTotal <= qtyToConsume) {
                                setSelectedItemId(null);
                              } else {
                                setActionQty(1);
                              }
                            } else {
                              setActionQty(1);
                            }
                          }
                        }}
                      >
                        {isContainer
                          ? (language === 'en' ? 'Drink' : '飲用')
                          : (t.useBtn || (language === 'en' ? 'Use' : '使用'))}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-drop-item"
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const currentLocId = player?.location || 'AZURE_BAY_PORT';
                        const dropCount = isContainer
                          ? Math.min(actionQty, selectedGroup.totalCount || 1)
                          : actionQty;
                        const success = await dropItem(currentLocId, selectedGroup.itemId, dropCount);
                        if (success) {
                          if ((selectedGroup.totalCount || 1) <= dropCount) {
                            setSelectedItemId(null);
                          } else {
                            setActionQty(1);
                          }
                        }
                      }}
                    >
                      {t.dropBtn || (language === 'en' ? 'Drop' : '丟棄')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </CollapsiblePanel>
  );
};
