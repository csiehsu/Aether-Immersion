import { useState, useEffect, useMemo } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { QuantitySelector } from '../common/QuantitySelector';
import {
  compareItemDurability,
  getItemDurabilityPercent,
  getDurabilityColor,
} from '../../utils/gameHelpers';

/**
 * 當前場景地面放置物品 (Placed Items) 面板元件。
 * 依物品 ID 整合顯示卡片，點開後於說明框顯示所有獨立實體小圖示與耐久度進度條。
 * 拾取時預設以最高耐久度個體優先。
 * @returns {JSX.Element}
 */
export const LocationItemsPanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const player = useGameStore((state) => state.player || {});
  const items = useGameStore((state) => state.items || []);
  const pickUpPlacedItem = useGameStore((state) => state.pickUpPlacedItem);
  const fetchLocations = useGameStore((state) => state.fetchLocations);
  const acceptQuestFromPlacedItem = useGameStore((state) => state.acceptQuestFromPlacedItem);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [isOpen, setIsOpen] = useState(true);
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [pickQty, setPickQty] = useState(1);

  // 面板展開時每 10 秒自動重新整理同步一次現場物品
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      if (fetchLocations) {
        fetchLocations();
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [isOpen, fetchLocations]);

  const currentLocation = locations.find(
    (loc) => loc.locationId === player?.location
  ) || locations[0];

  const placedItems = useMemo(
    () => currentLocation?.placedItems || [],
    [currentLocation?.placedItems]
  );

  // 相同 ID 的物品統合成一個項目，任務觸發物品因具備特殊觸發條件而各自保留
  const groupedPlacedItems = useMemo(() => {
    const groups = [];
    const map = new Map();
    placedItems.forEach((pItem) => {
      const key = pItem.triggerQuestId ? pItem.instanceId : pItem.itemId;
      if (!map.has(key)) {
        const newGroup = {
          key,
          itemId: pItem.itemId,
          items: [],
          totalCount: 0,
          isQuestItem: Boolean(pItem.triggerQuestId),
          triggerQuestId: pItem.triggerQuestId,
        };
        map.set(key, newGroup);
        groups.push(newGroup);
      }
      const g = map.get(key);
      g.items.push(pItem);
      g.totalCount += (pItem.count || 1);
    });
    return groups;
  }, [placedItems]);

  /**
   * 選取或取消選取地面上的放置物品群組。
   * @param {string} key - 群組鍵值。
   */
  const handleSelectItem = (key) => {
    if (selectedGroupKey === key) {
      setSelectedGroupKey(null);
      setPickQty(1);
    } else {
      setSelectedGroupKey(key);
      setPickQty(1);
    }
  };

  const selectedGroup = groupedPlacedItems.find((g) => g.key === selectedGroupKey);

  // 排序選中群組下的所有獨立個體：最高耐久度優先，若耐久度相同則以現場資料庫順序為主
  const sortedItems = useMemo(() => {
    if (!selectedGroup) return [];
    return [...selectedGroup.items].sort((a, b) => compareItemDurability(a, b, 'desc'));
  }, [selectedGroup]);

  return (
    <CollapsiblePanel
      title={t.locationItemsTitle || (language === 'en' ? '📍 Location Items' : '📍 現場物品')}
      className="location-items-panel"
      isOpen={isOpen}
      onToggle={setIsOpen}
      headerExtra={
        <button
          type="button"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '2px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
          }}
          onClick={async (e) => {
            e.stopPropagation();
            if (fetchLocations) {
              await fetchLocations();
            }
          }}
          title={t.refresh || '重新整理'}
        >
          <span>🔄</span>
          <span>{t.refresh || '重新整理'}</span>
        </button>
      }
    >
      {groupedPlacedItems.length === 0 ? (
        <div className="empty-inventory-notice">
          <span>📍 {language === 'en' ? 'No items at this location.' : '此地點暫無現場物品。'}</span>
        </div>
      ) : (
        <div className="inventory-panel-wrapper">
          <div className="inventory-grid">
            {groupedPlacedItems.map((group) => {
              const repItem = group.items[0] || {};
              const dbItem = items.find((i) => i.itemId === group.itemId);
              const itemName = (language === 'en' && repItem.customNameEn)
                ? repItem.customNameEn
                : (repItem.customName || (dbItem ? getLocalizedName(dbItem, language) : group.itemId));
              const imageUrl = dbItem?.imageUrl;
              const isSelected = selectedGroupKey === group.key;

              return (
                <div
                  key={group.key}
                  className={`inventory-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(group.key)}
                >
                  <div className="item-icon-box">
                    {imageUrl ? (
                      <img src={imageUrl} alt={itemName} className="inventory-item-img" />
                    ) : (
                      <span>{group.isQuestItem ? '📜' : '📦'}</span>
                    )}
                  </div>
                  <div className="item-info">
                    <span className="item-name">{itemName}</span>
                  </div>
                  {group.totalCount > 1 && (
                    <span className="item-count">x{group.totalCount}</span>
                  )}
                  {group.isQuestItem && (
                    <span className="item-count" style={{ color: '#fbbf24', fontSize: '0.7rem' }}>
                      {language === 'en' ? 'Quest' : '任務'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {selectedGroup && (() => {
            const repItem = sortedItems[0] || {};
            const dbItem = items.find((i) => i.itemId === selectedGroup.itemId);
            const itemDesc = dbItem ? getLocalizedDesc(dbItem, language) : null;
            const isQuestItem = selectedGroup.isQuestItem;

            const baseNutrition = dbItem?.nutrition || {};
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

            const hasDurability = sortedItems.some(
              (it) => it.durability !== undefined && it.durability !== null && it.durability > 0
            );

            return (
              <div className="inventory-detail-window">
                {itemDesc ? (
                  <p className="inventory-detail-desc">{itemDesc}</p>
                ) : (
                  <p className="inventory-detail-desc text-muted">
                    {language === 'en' ? 'No description available.' : '暫無物品說明。'}
                  </p>
                )}

                {/* 獨立個體小圖示區（不開放點選，上方進度條呈現耐久度色彩，不顯示數字） */}
                {(sortedItems.length > 1 || hasDurability) && (
                  <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                      {language === 'en' ? 'Individual Items:' : '現場實體狀態：'}
                    </div>
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

                        return (
                          <div
                            key={inst.instanceId || `${inst.itemId}_${instIdx}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '38px',
                              height: '46px',
                              padding: '3px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'default',
                              userSelect: 'none',
                            }}
                            title={hasDur ? (language === 'en' ? 'Durability Status' : '耐久度狀態') : ''}
                          >
                            {hasDur && (
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
                              {dbItem?.imageUrl ? (
                                <img
                                  src={dbItem.imageUrl}
                                  alt=""
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                />
                              ) : (
                                <span style={{ fontSize: '0.9rem' }}>{isQuestItem ? '📜' : '📦'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                  {selectedGroup.totalCount > 1 && !isQuestItem && (
                    <div className="detail-qty-row">
                      <span className="detail-qty-label">
                        {language === 'en' ? 'Quantity:' : '選取數量：'}
                      </span>
                      <QuantitySelector
                        value={pickQty}
                        onChange={setPickQty}
                        min={1}
                        max={selectedGroup.totalCount}
                      />
                    </div>
                  )}
                  <div className="detail-buttons-row">
                    {isQuestItem ? (
                      <button
                        type="button"
                        className="btn-use-item"
                        style={{ background: '#3b82f6', color: '#ffffff' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (acceptQuestFromPlacedItem) {
                            await acceptQuestFromPlacedItem(
                              selectedGroup.triggerQuestId,
                              currentLocation.locationId,
                              selectedGroup.items[0]?.instanceId
                            );
                          }
                          setSelectedGroupKey(null);
                          setPickQty(1);
                        }}
                      >
                        {t.acceptBtn || (language === 'en' ? 'Accept' : '接受')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn-use-item"
                          style={{ background: '#10b981', color: '#ffffff' }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (pickUpPlacedItem) {
                              const targetKey = selectedGroup.itemId;
                              const success = await pickUpPlacedItem(
                                currentLocation.locationId,
                                targetKey,
                                pickQty
                              );
                              if (success) {
                                if (selectedGroup.totalCount <= pickQty) {
                                  setSelectedGroupKey(null);
                                }
                                setPickQty(1);
                              }
                            }
                          }}
                        >
                          {t.pickupBtn || (language === 'en' ? 'Pick Up' : '撿起')}
                        </button>
                        <button
                          type="button"
                          className="btn-use-item"
                          style={{ background: '#475569', color: '#ffffff' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGroupKey(null);
                            setPickQty(1);
                          }}
                        >
                          {t.putDownBtn || (language === 'en' ? 'Put Down' : '放下')}
                        </button>
                      </>
                    )}
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
