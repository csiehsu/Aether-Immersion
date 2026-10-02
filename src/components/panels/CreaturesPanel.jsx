import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { getNpcIcon } from '../../utils/gameHelpers';

export const CreaturesPanel = () => {
  const creatures = useGameStore((state) => state.creatures || []);
  const locations = useGameStore((state) => state.locations || []);
  const player = useGameStore((state) => state.player || {});
  const addLog = useGameStore((state) => state.addLog);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedNpcId, setSelectedNpcId] = useState(null);

  const currentLocation = locations.find(
    (loc) => loc.locationId === player?.location
  );
  const locationNpcIds = currentLocation?.npcs || [];

  const visibleCreatures = creatures.filter(
    (c) => locationNpcIds.includes(c.npcId) || locationNpcIds.includes(c.id)
  );

  const selectedCreature = visibleCreatures.find(
    (c) => (c.npcId || c.id) === selectedNpcId
  );

  const handleAttack = (cName, cNameEn) => {
    addLog(
      '戰鬥系統',
      'Combat System',
      `發起攻擊！對【${cName}】展開對決！`,
      `Initiated attack against [${cNameEn}]!`,
      'event'
    );
  };

  const handleTrade = (cName, cNameEn) => {
    addLog(
      '交易系統',
      'Trade System',
      `開啟【${cName}】的交易選單。`,
      `Opened trade menu for [${cNameEn}].`,
      'dialogue'
    );
  };

  return (
    <CollapsiblePanel title={t.creaturesTitle} className="creatures-panel">
      {visibleCreatures.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
          {language === 'en' ? 'No creatures or NPCs at this location.' : '此地點暫無生物或NPC。'}
        </div>
      ) : (
        <div className="creatures-panel-wrapper">
          <div className="creatures-horizontal-grid">
            {visibleCreatures.map((c, idx) => {
              const cId = c.npcId || c.id || idx;
              const cName = getLocalizedName(c, language);
              const icon = getNpcIcon(c);
              const isSelected = selectedNpcId === cId;

              return (
                <div
                  key={cId}
                  className={`creature-tile ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedNpcId(isSelected ? null : cId)}
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

          {selectedCreature && (() => {
            const c = selectedCreature;
            const cName = getLocalizedName(c, language);
            const cDesc = getLocalizedDesc(c, language);
            const rawType = c.typeEn || c.type || 'MONSTER';
            const cType = language === 'en'
              ? rawType
              : (rawType === 'MONSTER' ? '怪物' : rawType === 'HUMAN' ? '人類' : rawType);
            const cHp = c.stats?.maxHP ?? c.hp;
            const icon = getNpcIcon(c);
            const isHuman = rawType === 'HUMAN';

            return (
              <div className="creature-detail-window">

                {cDesc ? <p className="creature-detail-desc">{cDesc}</p> : null}

                <div className="creature-detail-stats">
                  <span className="creature-type">{t.typeCreature}: {cType}</span>
                  {cHp ? <span className="creature-hp">{t.creatureHp}: {cHp}</span> : null}
                </div>

                <div className="creature-detail-actions">
                  {isHuman ? (
                    <button
                      type="button"
                      className="btn-trade"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrade(c.name, c.nameEn || c.name);
                      }}
                    >
                      {t.tradeBtn || (language === 'en' ? 'Trade' : '交易')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-attack"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAttack(c.name, c.nameEn || c.name);
                      }}
                    >
                      {t.attackBtn || (language === 'en' ? 'Attack' : '攻擊')}
                    </button>
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
