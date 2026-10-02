import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName } from '../../utils/language';

export const GatherPanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const items = useGameStore((state) => state.items || []);
  const player = useGameStore((state) => state.player);
  const performGather = useGameStore((state) => state.performGather);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedSpotId, setSelectedSpotId] = useState(null);

  const currentLocation = locations.find(
    (loc) => loc.locationId === player?.location
  );
  const gatherables = currentLocation?.gatherables || [];

  const selectedSpot = gatherables.find(
    (spot, idx) => (spot.itemId || idx) === selectedSpotId
  );

  return (
    <CollapsiblePanel title={t.gatherTitle} className="gather-panel">
      {gatherables.length === 0 ? (
        <div className="empty-gather-notice">
          <span>🍃 {language === 'en' ? 'No gatherable resources in this area.' : '此區域暫無可採集的資源。'}</span>
        </div>
      ) : (
        <div className="gather-panel-wrapper">
          <div className="gather-horizontal-grid">
            {gatherables.map((spot, idx) => {
              const spotId = spot.itemId || idx;
              const dbItem = items.find((i) => i.itemId === spot.itemId);
              const spotName = dbItem ? getLocalizedName(dbItem, language) : spot.itemId;
              const isSelected = selectedSpotId === spotId;

              return (
                <div
                  key={spotId}
                  className={`gather-tile ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedSpotId(isSelected ? null : spotId)}
                >
                  <div className="gather-tile-icon">
                    {dbItem && dbItem.imageUrl ? (
                      <img src={dbItem.imageUrl} alt={spotName} className="gather-item-img" />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <span className="gather-tile-name">{spotName}</span>
                </div>
              );
            })}
          </div>

          {selectedSpot && (() => {
            const spot = selectedSpot;
            const dbItem = items.find((i) => i.itemId === spot.itemId);
            const spotName = dbItem ? getLocalizedName(dbItem, language) : spot.itemId;
            const spotYield = spotName;
            const cost = spot.cost ?? 1;

            return (
              <div className="gather-detail-window">
                <div className="gather-detail-header">
                  <span className="gather-cost">{t.costEnergy}: -{cost}</span>
                </div>

                <div className="gather-detail-actions">
                  <button
                    type="button"
                    className="btn-gather"
                    onClick={(e) => {
                      e.stopPropagation();
                      performGather(
                        spotName,
                        spotName,
                        spotYield,
                        spotYield,
                        cost,
                        '📦'
                      );
                    }}
                  >
                    {t.gatherBtn}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </CollapsiblePanel>
  );
};
