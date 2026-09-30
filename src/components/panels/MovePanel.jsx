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

  const knownList = player.knownLocations || ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'];
  const knownLocationsList = locations.filter(
    (loc) => knownList.includes(loc.locationId) || knownList.includes(loc.name)
  );

  return (
    <CollapsiblePanel title={t.moveTitle} className="move-panel">
      <div className="location-list">
        {knownLocationsList.map((loc) => {
          const isCurrent = player.location === loc.locationId || player.location === loc.name;

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
