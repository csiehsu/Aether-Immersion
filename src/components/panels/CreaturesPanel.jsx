import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { getNpcIcon } from '../../utils/gameHelpers';

export const CreaturesPanel = () => {
  const creatures = useGameStore((state) => state.creatures || []);
  const locations = useGameStore((state) => state.locations || []);
  const player = useGameStore((state) => state.player || {});
  const inventory = useGameStore((state) => state.inventory || []);
  const questsList = useGameStore((state) => state.questsList || []);
  const submitQuest = useGameStore((state) => state.submitQuest);
  const acceptQuest = useGameStore((state) => state.acceptQuest);
  const startBattle = useGameStore((state) => state.startBattle);
  const isBattling = useGameStore((state) => state.isBattling);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedNpcId, setSelectedNpcId] = useState(null);

  const getAvailableQuestForNpc = (cId, cName) => {
    const pQuests = player?.quests || [];
    for (const qDef of (questsList || [])) {
      if (qDef.displayable !== true) continue;
      if (qDef.triggerType !== 'NPC') continue;
      const matchesNpc = qDef.triggerNpcId === cId || (cName && qDef.triggerNpcId === cName);
      if (!matchesNpc) continue;

      const alreadyHandled = pQuests.some(
        (pq) => pq.questId === qDef.questId && (pq.status === 'IN_PROGRESS' || pq.status === 'COMPLETED')
      );
      if (alreadyHandled) continue;

      if (qDef.minLevel && (player?.level || 1) < qDef.minLevel) continue;

      if (Array.isArray(qDef.prerequisites) && qDef.prerequisites.length > 0) {
        const meetsPrereq = qDef.prerequisites.every((req) => {
          if (req.type === 'QUEST_COMPLETED') {
            return pQuests.some((pq) => pq.questId === req.targetId && pq.status === 'COMPLETED');
          }
          return true;
        });
        if (!meetsPrereq) continue;
      }

      return qDef;
    }
    return null;
  };

  const getActiveQuestForNpc = (cId) => {
    const pQuests = player?.quests || [];
    const activePQuests = pQuests.filter((pq) => pq.status === 'IN_PROGRESS');
    for (const pq of activePQuests) {
      const qDef = (questsList || []).find((q) => q.questId === pq.questId);
      if (!qDef) continue;
      const isSubmitNpc = qDef.submitNpcId === cId;
      const isTargetNpc = (qDef.objectives || []).some((obj) => obj.targetNpcId === cId);
      if (isSubmitNpc || isTargetNpc) {
        return { pQuest: pq, qDef };
      }
    }
    return null;
  };

  const checkCanSubmitQuest = (qDef, pQuest) => {
    if (!qDef || !pQuest) return false;
    const objectives = qDef.objectives || [];
    for (let idx = 0; idx < objectives.length; idx++) {
      const obj = objectives[idx];
      if (obj.type === 'TALK_NPC') {
        continue;
      }
      if (obj.type === 'HAS_ITEM') {
        const ownedCount = (inventory || [])
          .filter((i) => i.itemId === obj.targetId)
          .reduce((sum, item) => sum + (item.count || 1), 0);
        if (ownedCount < (obj.requiredCount || 1)) {
          return false;
        }
      }
      if (obj.type === 'CRAFT') {
        const prog = pQuest.progress?.[idx];
        const progCount = prog?.currentCount || 0;
        const ownedCount = (inventory || [])
          .filter((i) => i.itemId === obj.targetId)
          .reduce((sum, item) => sum + (item.count || 1), 0);
        if (!prog?.isCompleted && progCount < (obj.requiredCount || 1) && ownedCount < (obj.requiredCount || 1)) {
          return false;
        }
      }
      if (obj.type === 'VISIT_LOCATION') {
        const prog = pQuest.progress?.[idx];
        if (prog && !prog.isCompleted && prog.currentCount < (obj.requiredCount || 1)) {
          return false;
        }
      }
    }
    return true;
  };

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

  const handleTrade = () => {};

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
              const activeQuestInfo = getActiveQuestForNpc(cId);
              const availableQuest = getAvailableQuestForNpc(cId, c.name);
              const hasQuestBadge = Boolean(activeQuestInfo || availableQuest);

              return (
                <div
                  key={cId}
                  className={`creature-tile ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedNpcId(isSelected ? null : cId)}
                >
                  <div className="creature-tile-avatar">
                    {hasQuestBadge && <span className="quest-exclamation-badge">❗</span>}
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
            const cId = c.npcId || c.id;
            const cName = getLocalizedName(c, language);
            const cDesc = getLocalizedDesc(c, language);
            const rawType = c.typeEn || c.type || 'MONSTER';
            const cType = language === 'en'
              ? rawType
              : (rawType === 'MONSTER' ? '怪物' : rawType === 'HUMAN' ? '人類' : rawType);
            const cHp = c.stats?.maxHP ?? c.hp;
            const isHuman = rawType === 'HUMAN';
            const questInfo = getActiveQuestForNpc(cId);
            const availableQuest = getAvailableQuestForNpc(cId, c.name);
            const canSubmit = questInfo ? checkCanSubmitQuest(questInfo.qDef, questInfo.pQuest) : false;

            return (
              <div className="creature-detail-window">

                {cDesc ? <p className="creature-detail-desc">{cDesc}</p> : null}

                <div className="creature-detail-stats">
                  <span className="creature-type">{t.typeCreature}: {cType}</span>
                  {cHp ? <span className="creature-hp">{t.creatureHp}: {cHp}</span> : null}
                </div>

                {availableQuest && (
                  <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(59, 130, 246, 0.12)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.35)' }}>
                    <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '6px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📜</span>
                      <span>{language === 'en' ? (availableQuest.titleEn || availableQuest.title) : availableQuest.title}</span>
                      <span style={{ fontSize: '0.75rem', background: '#3b82f6', color: '#fff', padding: '1px 6px', borderRadius: '4px', marginLeft: 'auto' }}>
                        {language === 'en' ? 'New Quest' : '可承接任務'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '10px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {language === 'en' ? (availableQuest.descriptionEn || availableQuest.description) : availableQuest.description}
                    </div>
                    <button
                      type="button"
                      className="btn-accept-quest"
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        background: '#3b82f6',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await acceptQuest(availableQuest.questId);
                      }}
                    >
                      {language === 'en' ? 'Accept Quest' : '承接任務'}
                    </button>
                  </div>
                )}

                {questInfo && (questInfo.qDef.displayable === true || canSubmit) && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '4px', fontSize: '0.875rem' }}>
                      📜 {questInfo.qDef.title}
                    </div>
                    {canSubmit ? (
                      <button
                        type="button"
                        className="btn-submit-quest"
                        style={{
                          width: '100%',
                          padding: '8px 16px',
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          marginTop: '4px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          submitQuest(questInfo.qDef.questId);
                        }}
                      >
                        {language === 'en' ? 'Complete Quest' : '完成任務'}
                      </button>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '4px' }}>
                        {language === 'en' ? 'Quest objectives in progress.' : '任務進行中...'}
                      </div>
                    )}
                  </div>
                )}

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
