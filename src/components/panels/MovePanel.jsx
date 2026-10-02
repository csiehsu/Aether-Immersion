import React from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';

export const MovePanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const player = useGameStore((state) => state.player);
  const changeLocation = useGameStore((state) => state.changeLocation);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const currentLocation = locations.find(
    (l) => l.locationId === player?.location
  );
  const connectedIds = (currentLocation?.connections || []).map((c) => c.targetLocationId);

  const knownList = player?.knownLocations || [];
  const availableLocations = locations.filter((loc) => {
    const isCurrent = loc.locationId === player?.location;
    if (isCurrent) return true;

    const isKnown = knownList.includes(loc.locationId);
    const isAdjacent = connectedIds.includes(loc.locationId);

    return isKnown && isAdjacent;
  });

  return (
    <CollapsiblePanel title={t.moveTitle} className="move-panel">
      <div className="location-list">
        {availableLocations.map((loc) => {
          const isCurrent = player?.location === loc.locationId;

          return (
            <div key={loc.locationId} className={`location-card ${isCurrent ? 'current' : ''}`}>
              <div className="location-main">
                <div className="location-title-row">
                  <span className="location-name">{getLocalizedName(loc, language)}</span>
                </div>
                {isCurrent && <p className="location-desc">{getLocalizedDesc(loc, language)}</p>}
              </div>
              <button
                type="button"
                className={`btn-move ${isCurrent ? 'btn-active' : ''}`}
                disabled={isCurrent}
                onClick={(e) => {
                  e.stopPropagation();
                  changeLocation(loc.locationId);
                }}
              >
                {isCurrent ? t.currentLocation : t.goToLocation}
              </button>
            </div>
          );
        })}
      </div>
    </CollapsiblePanel>
  );
};
