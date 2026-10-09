import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';

export const LocationItemsPanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const player = useGameStore((state) => state.player || {});
  const items = useGameStore((state) => state.items || []);
  const pickUpPlacedItem = useGameStore((state) => state.pickUpPlacedItem);
  const acceptQuestFromPlacedItem = useGameStore((state) => state.acceptQuestFromPlacedItem);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedInstanceId, setSelectedInstanceId] = useState(null);

  const currentLocation = locations.find(
    (loc) => loc.locationId === player?.location
  ) || locations[0];

  const placedItems = currentLocation?.placedItems || [];

  const handleSelectItem = (instanceId) => {
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    } else {
      setSelectedInstanceId(instanceId);
    }
  };

  const selectedPlacedItem = placedItems.find(
    (p) => p.instanceId === selectedInstanceId
  );

  return (
    <CollapsiblePanel
      title={t.locationItemsTitle || (language === 'en' ? '📍 Location Items' : '📍 現場物品')}
      className="location-items-panel"
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
              const itemName = dbItem ? getLocalizedName(dbItem, language) : pItem.itemId;
              const imageUrl = dbItem?.imageUrl;
              const isQuestItem = Boolean(pItem.triggerQuestId);
              const isSelected = selectedInstanceId === pItem.instanceId;

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

            return (
              <div className="inventory-detail-window">
                {itemDesc ? (
                  <p className="inventory-detail-desc">{itemDesc}</p>
                ) : (
                  <p className="inventory-detail-desc text-muted">
                    {language === 'en' ? 'No description available.' : '暫無物品說明。'}
                  </p>
                )}

                <div className="inventory-detail-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
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
                            await pickUpPlacedItem(
                              currentLocation.locationId,
                              selectedPlacedItem.instanceId
                            );
                          }
                          setSelectedInstanceId(null);
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
                        }}
                      >
                        {t.putDownBtn || (language === 'en' ? 'Put Down' : '放下')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </CollapsiblePanel>
  );
};
