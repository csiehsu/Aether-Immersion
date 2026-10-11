import { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { getNpcIcon } from '../../utils/gameHelpers';
import {
  getAvailableQuestForNpc,
  getActiveQuestForNpc,
  checkCanSubmitQuest,
} from '../../utils/questHelpers';

/**
 * 生物與 NPC 面板元件（提供檢視、任務交接與戰鬥發起功能）。
 * @returns {JSX.Element}
 */
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

  /**
   * 檢查指定 NPC 是否有可承接任務。
   * @param {string} cId - NPC 識別碼。
   * @param {string} cName - NPC 名稱。
   * @returns {Object|null}
   */
  const checkAvailableQuest = (cId, cName) => getAvailableQuestForNpc(questsList, player, cId, cName);

  /**
   * 檢查指定 NPC 是否有關聯的進行中任務。
   * @param {string} cId - NPC 識別碼。
   * @returns {{ pQuest: Object, qDef: Object }|null}
   */
  const checkActiveQuest = (cId) => getActiveQuestForNpc(questsList, player, cId);

  /**
   * 檢查任務是否已達成提交條件。
   * @param {Object} qDef - 任務定義物件。
   * @param {Object} pQuest - 玩家任務進度物件。
   * @returns {boolean}
   */
  const checkSubmittable = (qDef, pQuest) => checkCanSubmitQuest(qDef, pQuest, inventory);

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

  /**
   * 處理 NPC 交易互動。
   */
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
              const activeQuestInfo = checkActiveQuest(cId);
              const availableQuest = checkAvailableQuest(cId, c.name);
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
            const cDesc = getLocalizedDesc(c, language);
            const rawType = c.typeEn || c.type || 'MONSTER';
            const cType = language === 'en'
              ? rawType
              : (rawType === 'MONSTER' ? '怪物' : rawType === 'HUMAN' ? '人類' : rawType);
            const cHp = c.stats?.maxHP ?? c.hp;
            const isHuman = rawType === 'HUMAN';
            const questInfo = checkActiveQuest(cId);
            const availableQuest = checkAvailableQuest(cId, c.name);
            const canSubmit = questInfo ? checkSubmittable(questInfo.qDef, questInfo.pQuest) : false;

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
