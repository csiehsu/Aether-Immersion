import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { QuantitySelector } from '../common/QuantitySelector';

export const InventoryPanel = () => {
  const inventory = useGameStore((state) => state.inventory || []);
  const items = useGameStore((state) => state.items || []);
  const useItem = useGameStore((state) => state.useItem);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedItemId, setSelectedItemId] = useState(null);
  const [useQty, setUseQty] = useState(1);

  const handleSelectItem = (itemId) => {
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
      setUseQty(1);
    } else {
      setSelectedItemId(itemId);
      setUseQty(1);
    }
  };

  const selectedItem = inventory.find(
    (item) => item.itemId === selectedItemId
  );

  return (
    <CollapsiblePanel title={t.inventoryTitle} className="inventory-panel">
      {inventory.length === 0 ? (
        <div className="empty-inventory-notice">
          <span>🎒 {language === 'en' ? 'Inventory is empty.' : '背包是空的。'}</span>
        </div>
      ) : (
        <div className="inventory-panel-wrapper">
          <div className="inventory-grid">
            {inventory.map((item, idx) => {
              const itemId = item.itemId;
              const dbItem = items.find((i) => i.itemId === item.itemId);
              const itemName = dbItem ? getLocalizedName(dbItem, language) : item.itemId;
              const imageUrl = dbItem?.imageUrl;
              const quality = item.quality || '普通';
              const isSelected = selectedItemId === itemId;

              return (
                <div
                  key={`${itemId}_${idx}`}
                  className={`inventory-item-card quality-${quality} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(itemId)}
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

            const hasNutrition = Boolean(
              dbItem?.nutrition && (dbItem.nutrition.hp !== 0 || dbItem.nutrition.strength !== 0)
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
                {hasNutrition && (
                  <div className="inventory-detail-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <QuantitySelector
                      value={useQty}
                      onChange={setUseQty}
                      min={1}
                      max={selectedItem.count || 1}
                    />
                    <button
                      type="button"
                      className="btn-use-item"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await useItem(selectedItem.itemId, useQty);
                      }}
                    >
                      {t.useBtn || (language === 'en' ? 'Use' : '使用')}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </CollapsiblePanel>
  );
};
