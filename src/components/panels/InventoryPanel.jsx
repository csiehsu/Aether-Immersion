import { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { QuantitySelector } from '../common/QuantitySelector';
import {
  calculateCurrentWeight,
  calculateMaxWeight,
  isPlayerOverburdened,
} from '../../utils/gameHelpers';

/**
 * 玩家背包物品清單面板元件。
 * 顯示背包內持有道具、品質標籤、數量、耐久度、營養效果預覽，並支援批量食用消耗道具。
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

  const [selectedItemKey, setSelectedItemKey] = useState(null);
  const [actionQty, setActionQty] = useState(1);

  const currentWeight = calculateCurrentWeight(inventory, items);
  const maxWeight = calculateMaxWeight(player);
  const isOverburdened = isPlayerOverburdened(player, inventory, items);

  /**
   * 選取或取消選取背包中的道具。
   * @param {string} key - 道具實體識別碼或鍵值。
   */
  const handleSelectItem = (key) => {
    if (selectedItemKey === key) {
      setSelectedItemKey(null);
      setActionQty(1);
    } else {
      setSelectedItemKey(key);
      setActionQty(1);
    }
  };

  const selectedItem = inventory.find(
    (item, idx) => (item.instanceId || `${item.itemId}_${idx}`) === selectedItemKey
  );

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
      {inventory.length === 0 ? (
        <div className="empty-inventory-notice">
          <span>🎒 {language === 'en' ? 'Inventory is empty.' : '背包是空的。'}</span>
        </div>
      ) : (
        <div className="inventory-panel-wrapper">
          <div className="inventory-grid">
            {inventory.map((item, idx) => {
              const itemKey = item.instanceId || `${item.itemId}_${idx}`;
              const dbItem = items.find((i) => i.itemId === item.itemId);
              const itemName = (language === 'en' && item.customNameEn)
                ? item.customNameEn
                : (item.customName || (dbItem ? getLocalizedName(dbItem, language) : item.itemId));
              const imageUrl = dbItem?.imageUrl;
              const quality = item.quality || '普通';
              const isSelected = selectedItemKey === itemKey;

              return (
                <div
                  key={itemKey}
                  className={`inventory-item-card quality-${quality} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(itemKey)}
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
                  <span className="item-count">x{item.count}</span>
                </div>
              );
            })}
          </div>

          {selectedItem && (() => {
            const dbItem = items.find((i) => i.itemId === selectedItem.itemId);
            const itemDesc = dbItem ? getLocalizedDesc(dbItem, language) : null;
            const durabilityVal = selectedItem.durability !== undefined && selectedItem.durability !== null && selectedItem.durability > 0
              ? selectedItem.durability
              : (dbItem && dbItem.durability > 0 ? dbItem.durability : null);

            const baseNutrition = dbItem?.nutrition || {};
            const bonusNutrition = selectedItem.bonusNutrition || {};
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
                    {language === 'en' ? 'No description available.' : '暫無道具說明。'}
                  </p>
                )}
                {durabilityVal !== null && (
                  <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, marginTop: '4px' }}>
                    <span>{language === 'en' ? 'Durability' : '耐久度'}: {durabilityVal}</span>
                  </div>
                )}
                {(() => {
                  const singleWeight = dbItem?.weight ?? 1;
                  const totalItemWeight = Math.round(singleWeight * (selectedItem.count || 1) * 10) / 10;
                  return (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, marginTop: '3px' }}>
                      <span>⚖️ {language === 'en' ? 'Weight' : '重量'}: {singleWeight} kg ({language === 'en' ? 'Total' : '總重'}: {totalItemWeight} kg)</span>
                    </div>
                  );
                })()}
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
                  {(selectedItem.count || 1) > 1 && (
                    <div className="detail-qty-row">
                      <span className="detail-qty-label">
                        {language === 'en' ? 'Quantity:' : '選取數量：'}
                      </span>
                      <QuantitySelector
                        value={actionQty}
                        onChange={setActionQty}
                        min={1}
                        max={selectedItem.count || 1}
                      />
                    </div>
                  )}
                  <div className="detail-buttons-row">
                    {hasNutrition && (
                      <button
                        type="button"
                        className="btn-use-item"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await consumeItem(selectedItem.instanceId || selectedItem.itemId, actionQty);
                        }}
                      >
                        {t.useBtn || (language === 'en' ? 'Use' : '使用')}
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
                        const targetKey = selectedItem.instanceId || selectedItem.itemId;
                        const currentLocId = player?.location || 'AZURE_BAY_PORT';
                        const success = await dropItem(currentLocId, targetKey, actionQty);
                        if (success) {
                          if ((selectedItem.count || 1) <= actionQty) {
                            setSelectedItemKey(null);
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
