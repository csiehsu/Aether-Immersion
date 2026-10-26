import { useGameStore, translations } from '../../store/useGameStore';
import {
  isPlayerComatose,
  calculateEffectiveEnergyCost,
  isPlayerOverburdened,
  calculateCurrentWeight,
  calculateMaxWeight,
  checkTravelRequirements,
} from '../../utils/gameHelpers';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';

/**
 * 地點移動面板元件。
 * 顯示玩家已知且與當前地點相鄰的目標地點，並提供移動切換功能。
 * @returns {JSX.Element}
 */
export const MovePanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory || []);
  const items = useGameStore((state) => state.items || []);
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

  const isComatose = isPlayerComatose(player);
  const isOverburdened = isPlayerOverburdened(player, inventory, items);
  const currentWeight = calculateCurrentWeight(inventory, items);
  const maxWeight = calculateMaxWeight(player);

  return (
    <CollapsiblePanel
      title={t.moveTitle}
      className="move-panel"
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
      <div className="location-list">
        {availableLocations.map((loc) => {
          const isCurrent = player?.location === loc.locationId;
          const connection = (currentLocation?.connections || []).find((c) => c.targetLocationId === loc.locationId);
          const travelCheck = checkTravelRequirements(connection, inventory, items);
          const hasRequiredItem = travelCheck.canTravel;
          const isMissingItem = !isCurrent && !hasRequiredItem;
          const isDisabled = isCurrent || isComatose || isOverburdened || !hasRequiredItem;
          const baseCost = connection?.energyCost ?? 1;
          const cost = calculateEffectiveEnergyCost(player, baseCost, 'TRAVEL');

          const buttonLabel = isCurrent
            ? t.currentLocation
            : isComatose
            ? (t.comatose || '昏迷中')
            : isOverburdened
            ? (t.overburdened || (language === 'en' ? 'Overburdened' : '負重超載'))
            : isMissingItem
            ? (language === 'en' ? `Need ${travelCheck.requiredItemNameEn || 'Item'}` : `需要${travelCheck.requiredItemName || '道具'}`)
            : t.goToLocation;

          return (
            <div key={loc.locationId} className={`location-card ${isCurrent ? 'current' : ''}`}>
              <div className="location-main">
                <div className="location-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="location-name">{getLocalizedName(loc, language)}</span>
                  {!isCurrent && (
                    <span className="location-cost" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      ⚡ {cost}
                      {cost !== baseCost && (
                        <span style={{ color: cost < baseCost ? '#10b981' : '#ef4444', marginLeft: '3px' }}>
                          ({cost < baseCost ? '' : '+'}{Math.round(((cost - baseCost) / baseCost) * 100)}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {isCurrent && <p className="location-desc">{getLocalizedDesc(loc, language)}</p>}
              </div>
              <button
                type="button"
                className={`btn-move ${isCurrent ? 'btn-active' : ''} ${isOverburdened && !isCurrent ? 'btn-overburdened' : ''} ${isMissingItem ? 'btn-missing-item' : ''} ${isComatose && !isCurrent ? 'btn-comatose' : ''}`}
                disabled={isDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDisabled) return;
                  changeLocation(loc.locationId);
                }}
              >
                {buttonLabel}
              </button>
            </div>
          );
        })}
      </div>
    </CollapsiblePanel>
  );
};
