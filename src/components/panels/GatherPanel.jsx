import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { getNpcIcon } from '../../utils/gameHelpers';
import { QuantitySelector } from '../common/QuantitySelector';

export const GatherPanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const creatures = useGameStore((state) => state.creatures || []);
  const items = useGameStore((state) => state.items || []);
  const buildings = useGameStore((state) => state.buildings || []);
  const player = useGameStore((state) => state.player || {});
  const performGather = useGameStore((state) => state.performGather);
  const performBuy = useGameStore((state) => state.performBuy);
  const startBattle = useGameStore((state) => state.startBattle);
  const isBattling = useGameStore((state) => state.isBattling);
  const addLog = useGameStore((state) => state.addLog);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedType, setSelectedType] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [gatherQty, setGatherQty] = useState(1);
  const [buyQtys, setBuyQtys] = useState({});

  const handleBuyQtyChange = (itemId, val) => {
    setBuyQtys((prev) => ({
      ...prev,
      [itemId]: Math.max(1, Number(val) || 1),
    }));
  };

  const currentLocation = locations.find(
    (loc) => loc.locationId === player?.location
  );

  const locationNpcIds = currentLocation?.npcs || [];
  const visibleCreatures = creatures.filter(
    (c) => locationNpcIds.includes(c.npcId) || locationNpcIds.includes(c.id)
  );

  const gatherables = currentLocation?.gatherables || [];
  const locationBuildings = currentLocation?.buildings || [];

  const toggleSelect = (type, id) => {
    if (selectedType === type && selectedId === id) {
      setSelectedType(null);
      setSelectedId(null);
      setGatherQty(1);
    } else {
      setSelectedType(type);
      setSelectedId(id);
      setGatherQty(1);
    }
  };

  const hasAnyContent = visibleCreatures.length > 0 || gatherables.length > 0 || locationBuildings.length > 0;

  return (
    <CollapsiblePanel title={t.gatherTitle} className="gather-panel">
      {!hasAnyContent ? (
        <div className="empty-gather-notice">
          <span>🍃 {language === 'en' ? 'No regional resources in this area.' : '此區域暫無資源。'}</span>
        </div>
      ) : (
        <div className="gather-panel-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleCreatures.length > 0 && (
            <React.Fragment>
              <div className="creatures-horizontal-grid">
                {visibleCreatures.map((c, idx) => {
                  const cId = c.npcId || c.id || idx;
                  const cName = getLocalizedName(c, language);
                  const icon = getNpcIcon(c);
                  const isSelected = selectedType === 'creature' && selectedId === cId;

                  return (
                    <div
                      key={cId}
                      className={`creature-tile ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelect('creature', cId)}
                    >
                      <div className="creature-tile-avatar">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={cName} className="creature-img" />
                        ) : (
                          <span>{icon}</span>
                        )}
                      </div>
                      <span className="creature-tile-name">{cName}</span>
                    </div>
                  );
                })}
              </div>

              {selectedType === 'creature' && (() => {
                const c = visibleCreatures.find((item, idx) => (item.npcId || item.id || idx) === selectedId);
                if (!c) return null;
                const cName = getLocalizedName(c, language);
                const cDesc = getLocalizedDesc(c, language);
                const rawType = c.typeEn || c.type || 'MONSTER';
                const isHuman = rawType === 'HUMAN';

                return (
                  <div className="creature-detail-window">
                    {cDesc ? <p className="creature-detail-desc">{cDesc}</p> : null}

                    {isHuman ? (
                      <div className="npc-goodies-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {(!c.goodies || c.goodies.length === 0) ? (
                          <div style={{ padding: '8px', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>
                            {language === 'en' ? 'No items for sale.' : '此 NPC 暫無販售物品。'}
                          </div>
                        ) : (
                          c.goodies.map((goodie, gIdx) => {
                            const dbItem = items.find((i) => i.itemId === goodie.itemId);
                            const gName = dbItem ? getLocalizedName(dbItem, language) : goodie.itemId;
                            const currentQty = buyQtys[goodie.itemId] || 1;
                            const unitPrice = goodie.price || 0;
                            const maxAffordableQty = unitPrice > 0 ? Math.floor((player.money ?? 0) / unitPrice) : Infinity;
                            const isAffordable = unitPrice === 0 || (currentQty * unitPrice <= (player.money ?? 0));

                            return (
                              <div
                                key={goodie.itemId || gIdx}
                                className="goodie-item-card"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                  padding: '8px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 'bold' }}>{gName}</span>
                                  <span style={{ color: '#fbbf24', fontSize: '0.875rem' }}>
                                    {language === 'en' ? `Price: ${unitPrice}` : `單價: ${unitPrice}`}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                  <QuantitySelector
                                    value={currentQty}
                                    onChange={(val) => handleBuyQtyChange(goodie.itemId, val)}
                                    min={1}
                                    max={maxAffordableQty}
                                  />
                                  <button
                                    type="button"
                                    className="btn-buy"
                                    disabled={!isAffordable}
                                    style={{
                                      height: '36px',
                                      padding: '0 16px',
                                      background: isAffordable ? '#10b981' : '#64748b',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: isAffordable ? 'pointer' : 'not-allowed',
                                      fontWeight: 'bold',
                                      opacity: isAffordable ? 1 : 0.6,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      performBuy(c, goodie.itemId, unitPrice, currentQty);
                                    }}
                                  >
                                    {t.buyBtn || (language === 'en' ? 'Buy' : '購買')}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <div className="creature-detail-actions" style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          className="btn-attack"
                          disabled={isBattling}
                          onClick={(e) => {
                            e.stopPropagation();
                            startBattle(c);
                          }}
                        >
                          {isBattling
                            ? (language === 'en' ? 'Battling...' : '戰鬥中...')
                            : (t.attackBtn || (language === 'en' ? 'Attack' : '攻擊'))}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </React.Fragment>
          )}

          {gatherables.length > 0 && (
            <React.Fragment>
              <div className="gather-horizontal-grid">
                {gatherables.map((spot, idx) => {
                  const spotId = spot.itemId || idx;
                  const dbItem = items.find((i) => i.itemId === spot.itemId);
                  const spotName = dbItem ? getLocalizedName(dbItem, language) : spot.itemId;
                  const isSelected = selectedType === 'gather' && selectedId === spotId;

                  return (
                    <div
                      key={spotId}
                      className={`gather-tile ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelect('gather', spotId)}
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

              {selectedType === 'gather' && (() => {
                const spot = gatherables.find((item, idx) => (item.itemId || idx) === selectedId);
                if (!spot) return null;
                const dbItem = items.find((i) => i.itemId === spot.itemId);
                const spotName = dbItem ? getLocalizedName(dbItem, language) : spot.itemId;
                const spotYield = spotName;
                const unitCost = spot.cost ?? 1;
                const totalCost = unitCost * gatherQty;

                return (
                  <div className="gather-detail-window">
                    <div className="gather-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span className="gather-cost">{t.costEnergy}: -{totalCost}</span>
                      <QuantitySelector value={gatherQty} onChange={setGatherQty} min={1} />
                    </div>

                    <div className="gather-detail-actions">
                      <button
                        type="button"
                        className="btn-gather"
                        onClick={(e) => {
                          e.stopPropagation();
                          performGather(
                            spot.itemId,
                            unitCost,
                            gatherQty
                          );
                        }}
                      >
                        {t.gatherBtn}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          )}

          {locationBuildings.length > 0 && (
            <React.Fragment>
              <div className="buildings-horizontal-grid">
                {locationBuildings.map((b, idx) => {
                  const bId = b.buildingId || idx;
                  const dbBuilding = buildings.find((item) => item.buildingId === b.buildingId);
                  const bName = dbBuilding ? (dbBuilding.name || dbBuilding.buildingId) : b.buildingId;
                  const isSelected = selectedType === 'building' && selectedId === bId;
                  const bIcon = dbBuilding?.type === 'HEATING' ? '🔥' : '🏠';

                  return (
                    <div
                      key={bId}
                      className={`gather-tile building-tile ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelect('building', bId)}
                    >
                      <div className="gather-tile-icon">
                        <span>{bIcon}</span>
                      </div>
                      <span className="gather-tile-name">{bName}</span>
                    </div>
                  );
                })}
              </div>

              {selectedType === 'building' && (() => {
                const b = locationBuildings.find((item, idx) => (item.buildingId || idx) === selectedId);
                if (!b) return null;
                const dbBuilding = buildings.find((item) => item.buildingId === b.buildingId);
                const bName = dbBuilding ? (dbBuilding.name || dbBuilding.buildingId) : b.buildingId;
                const bType = dbBuilding ? dbBuilding.type : 'BUILDING';

                return (
                  <div className="gather-detail-window">
                    <div className="gather-detail-header">
                      <span className="gather-detail-name">{bName}</span>
                    </div>
                    <div className="creature-detail-stats">
                      <span className="creature-type">
                        {t.typeCreature || (language === 'en' ? 'Type' : '類型')}: {bType}
                      </span>
                      {b.lifespan !== undefined && b.lifespan !== null && (
                        <span className="building-lifespan">
                          {language === 'en' ? 'Lifespan' : '壽命'}: {b.lifespan}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          )}
        </div>
      )}
    </CollapsiblePanel>
  );
};
