import { useState, useEffect } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { QuantitySelector } from '../common/QuantitySelector';

/**
 * 當前場景地面放置物品 (Placed Items) 面板元件。
 * 顯示地面遺留物品，並提供拾取入背包或觸發任務接取功能。
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
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
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

  const placedItems = currentLocation?.placedItems || [];

  /**
   * 選取或取消選取地面上的放置物品。
   * @param {string} instanceId - 物品實體識別碼。
   */
  const handleSelectItem = (instanceId) => {
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
      setPickQty(1);
    } else {
      setSelectedInstanceId(instanceId);
      setPickQty(1);
    }
  };

  const selectedPlacedItem = placedItems.find(
    (p) => p.instanceId === selectedInstanceId
  );

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
      {placedItems.length === 0 ? (
        <div className="empty-inventory-notice">
          <span>📍 {language === 'en' ? 'No items at this location.' : '此地點暫無現場物品。'}</span>
        </div>
      ) : (
        <div className="inventory-panel-wrapper">
          <div className="inventory-grid">
            {placedItems.map((pItem) => {
              const dbItem = items.find((i) => i.itemId === pItem.itemId);
              const itemName = (language === 'en' && pItem.customNameEn)
                ? pItem.customNameEn
                : (pItem.customName || (dbItem ? getLocalizedName(dbItem, language) : pItem.itemId));
              const imageUrl = dbItem?.imageUrl;
              const isQuestItem = Boolean(pItem.triggerQuestId);
              const isSelected = selectedInstanceId === pItem.instanceId;
              const count = pItem.count || 1;

              return (
                <div
                  key={pItem.instanceId}
                  className={`inventory-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(pItem.instanceId)}
                >
                  <div className="item-icon-box">
                    {imageUrl ? (
                      <img src={imageUrl} alt={itemName} className="inventory-item-img" />
                    ) : (
                      <span>{isQuestItem ? '📜' : '📦'}</span>
                    )}
                  </div>
                  <div className="item-info">
                    <span className="item-name">{itemName}</span>
                  </div>
                  {count > 1 && (
                    <span className="item-count">x{count}</span>
                  )}
                  {isQuestItem && (
                    <span className="item-count" style={{ color: '#fbbf24', fontSize: '0.7rem' }}>
                      {language === 'en' ? 'Quest' : '任務'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {selectedPlacedItem && (() => {
            const dbItem = items.find((i) => i.itemId === selectedPlacedItem.itemId);
            const itemDesc = dbItem ? getLocalizedDesc(dbItem, language) : null;
            const isQuestItem = Boolean(selectedPlacedItem.triggerQuestId);
            const count = selectedPlacedItem.count || 1;
            const durabilityVal = selectedPlacedItem.durability !== undefined && selectedPlacedItem.durability !== null && selectedPlacedItem.durability > 0
              ? selectedPlacedItem.durability
              : null;

            const baseNutrition = dbItem?.nutrition || {};
            const bonusNutrition = selectedPlacedItem.bonusNutrition || {};
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

            return (
              <div className="inventory-detail-window">
                {itemDesc ? (
                  <p className="inventory-detail-desc">{itemDesc}</p>
                ) : (
                  <p className="inventory-detail-desc text-muted">
                    {language === 'en' ? 'No description available.' : '暫無物品說明。'}
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', fontSize: '0.78rem' }}>
                  {count > 1 && (
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                      {language === 'en' ? 'Quantity' : '數量'}: {count}
                    </span>
                  )}
                  {durabilityVal !== null && (
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      {language === 'en' ? 'Durability' : '耐久度'}: {durabilityVal}
                    </span>
                  )}
                </div>

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
                  {count > 1 && !isQuestItem && (
                    <div className="detail-qty-row">
                      <span className="detail-qty-label">
                        {language === 'en' ? 'Quantity:' : '選取數量：'}
                      </span>
                      <QuantitySelector
                        value={pickQty}
                        onChange={setPickQty}
                        min={1}
                        max={count}
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
                              selectedPlacedItem.triggerQuestId,
                              currentLocation.locationId,
                              selectedPlacedItem.instanceId
                            );
                          }
                          setSelectedInstanceId(null);
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
                              const success = await pickUpPlacedItem(
                                currentLocation.locationId,
                                selectedPlacedItem.instanceId,
                                pickQty
                              );
                              if (success) {
                                setSelectedInstanceId(null);
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
                            setSelectedInstanceId(null);
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
