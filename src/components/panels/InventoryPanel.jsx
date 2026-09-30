import React from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';

export const InventoryPanel = () => {
  const inventory = useGameStore((state) => state.inventory || []);
  const items = useGameStore((state) => state.items || []);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  return (
    <CollapsiblePanel title={t.inventoryTitle} className="inventory-panel">
      <div className="inventory-grid">
        {inventory.length > 0 ? (
          inventory.map((item, idx) => {
            const dbItem = items.find(
              (i) => i.itemId === item.itemId || i.itemId === item.id || i.name === item.name
            );

            const itemName = dbItem ? getLocalizedName(dbItem, language) : getLocalizedName(item, language);
            const itemDesc = dbItem ? getLocalizedDesc(dbItem, language) : getLocalizedDesc(item, language);
            const imageUrl = dbItem?.imageUrl;
            const quality = item.quality || '普通';

            return (
              <div
                key={item.id || item.itemId || idx}
                className={`inventory-item-card quality-${quality}`}
                title={itemDesc ? `${itemName}: ${itemDesc}` : itemName}
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
          })
        ) : (
          <div className="empty-inventory-notice">
            <span>🎒 {language === 'en' ? 'Inventory is empty.' : '背包是空的。'}</span>
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
};
