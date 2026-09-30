import React from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';

export const GatherPanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const items = useGameStore((state) => state.items || []);
  const player = useGameStore((state) => state.player);
  const performGather = useGameStore((state) => state.performGather);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const currentLocation = locations.find(
    (loc) => loc.locationId === player.location || loc.name === player.location
  );
  const gatherables = currentLocation?.gatherables || [];

  return (
    <CollapsiblePanel title={t.gatherTitle} className="gather-panel">
      <div className="gather-grid">
        {gatherables.length > 0 ? (
          gatherables.map((spot, idx) => {
            const dbItem = items.find((i) => i.itemId === spot.itemId);

            const spotName = dbItem
              ? getLocalizedName(dbItem, language)
              : (language === 'en' ? (spot.nameEn || spot.name || spot.itemId) : (spot.name || spot.itemId));
            const spotYield = spotName;
            const spotDesc = dbItem ? getLocalizedDesc(dbItem, language) : (spot.desc || '');
            const cost = spot.cost ?? 5;

            return (
              <div key={spot.itemId || idx} className="gather-card">
                <div className="gather-icon-wrap">
                  {dbItem && dbItem.imageUrl ? (
                    <img src={dbItem.imageUrl} alt={spotName} className="gather-item-img" />
                  ) : (
                    <span>{spot.icon || '🐟'}</span>
                  )}
                </div>
                <div className="gather-detail">
                  <h4 className="gather-name">{spotName}</h4>
                  {spotDesc ? <p className="gather-desc">{spotDesc}</p> : null}
                  <div className="gather-meta">
                    <span className="gather-yield">{t.obtain}: {spotYield}</span>
                    <span className="gather-cost">{t.costEnergy}: -{cost}</span>
                  </div>
                </div>
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
                      dbItem?.imageUrl ? '🐟' : (spot.icon || '🐟')
                    );
                  }}
                >
                  {t.gatherBtn}
                </button>
              </div>
            );
          })
        ) : (
          <div className="empty-gather-notice">
            <span>🍃 {language === 'en' ? 'No gatherable resources in this area.' : '此區域暫無可採集的資源。'}</span>
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
};
