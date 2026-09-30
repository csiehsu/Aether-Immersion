import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';

export const InventoryPanel = () => {
  const inventory = useGameStore((state) => state.inventory || []);
  const items = useGameStore((state) => state.items || []);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedItemId, setSelectedItemId] = useState(null);

  const selectedItem = inventory.find(
    (item, idx) => (item.id || item.itemId || idx) === selectedItemId
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
              const itemId = item.id || item.itemId || idx;
              const dbItem = items.find(
                (i) => i.itemId === item.itemId || i.itemId === item.id || i.name === item.name
              );

              const itemName = dbItem ? getLocalizedName(dbItem, language) : getLocalizedName(item, language);
              const imageUrl = dbItem?.imageUrl;
              const quality = item.quality || '普通';
              const isSelected = selectedItemId === itemId;

              return (
                <div
                  key={itemId}
                  className={`inventory-item-card quality-${quality} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedItemId(isSelected ? null : itemId)}
                >
                  <div className="item-icon-box">
                    {imageUrl ? (
                      <img src={imageUrl} alt={itemName} className="inventory-item-img" />
                    ) : (
                      <span>{item.icon || '🐟'}</span>
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
            const dbItem = items.find(
              (i) => i.itemId === selectedItem.itemId || i.itemId === selectedItem.id || i.name === selectedItem.name
            );
            const itemName = dbItem ? getLocalizedName(dbItem, language) : getLocalizedName(selectedItem, language);
            const itemDesc = dbItem ? getLocalizedDesc(dbItem, language) : getLocalizedDesc(selectedItem, language);
            const imageUrl = dbItem?.imageUrl;

            return (
              <div className="inventory-detail-window">
                {itemDesc ? (
                  <p className="inventory-detail-desc">{itemDesc}</p>
                ) : (
                  <p className="inventory-detail-desc text-muted">
                    {language === 'en' ? 'No description available.' : '暫無道具說明。'}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </CollapsiblePanel>
  );
};
