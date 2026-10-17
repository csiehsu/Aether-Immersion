import { useState, Fragment } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { TOOL_TYPE_LABELS } from '../../constants/translations';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import { getNpcIcon, isPlayerComatose, calculateEffectiveEnergyCost } from '../../utils/gameHelpers';
import {
  getAvailableQuestForNpc,
  getActiveQuestForNpc,
  checkCanSubmitQuest,
} from '../../utils/questHelpers';
import { QuantitySelector } from '../common/QuantitySelector';

/**
 * 區域資源面板元件。
 * 整合場景生物與 NPC 互動（交易買賣、承接/提交任務、戰鬥切換）、採集點（批量採集）、以及建築設施檢視。
 * @returns {JSX.Element}
 */
export const GatherPanel = () => {
  const locations = useGameStore((state) => state.locations || []);
  const creatures = useGameStore((state) => state.creatures || []);
  const items = useGameStore((state) => state.items || []);
  const buildings = useGameStore((state) => state.buildings || []);
  const player = useGameStore((state) => state.player || {});
  const inventory = useGameStore((state) => state.inventory || []);
  const performGather = useGameStore((state) => state.performGather);
  const performBuy = useGameStore((state) => state.performBuy);
  const performSell = useGameStore((state) => state.performSell);
  const startBattle = useGameStore((state) => state.startBattle);
  const isBattling = useGameStore((state) => state.isBattling);
  const questsList = useGameStore((state) => state.questsList || []);
  const submitQuest = useGameStore((state) => state.submitQuest);
  const acceptQuest = useGameStore((state) => state.acceptQuest);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedType, setSelectedType] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [gatherQty, setGatherQty] = useState(1);
  const [buyQtys, setBuyQtys] = useState({});
  const [sellQtys, setSellQtys] = useState({});
  const [tradeTab, setTradeTab] = useState('buy');

  /**
   * 檢查指定 NPC 是否有可承接任務。
   * @param {string} cId - NPC 識別碼。
   * @param {string} cName - NPC 名稱。
   * @returns {Object|null} 可接任務物件或 null。
   */
  const checkAvailableQuest = (cId, cName) => getAvailableQuestForNpc(questsList, player, cId, cName);

  /**
   * 檢查指定 NPC 是否有關聯的進行中任務。
   * @param {string} cId - NPC 識別碼。
   * @returns {{ pQuest: Object, qDef: Object }|null}
   */
  const checkActiveQuest = (cId) => getActiveQuestForNpc(questsList, player, cId);

  /**
   * 檢查當前任務是否已滿足提交完成條件。
   * @param {Object} qDef - 任務定義物件。
   * @param {Object} pQuest - 玩家任務進度物件。
   * @returns {boolean}
   */
  const checkSubmittable = (qDef, pQuest) => checkCanSubmitQuest(qDef, pQuest, inventory);

  /**
   * 調整 NPC 購買道具的數量。
   * @param {string} itemId - 道具識別碼。
   * @param {number|string} val - 數量數值。
   */
  const handleBuyQtyChange = (itemId, val) => {
    setBuyQtys((prev) => ({
      ...prev,
      [itemId]: Math.max(1, Number(val) || 1),
    }));
  };

  /**
   * 調整 NPC 出售道具的數量。
   * @param {string} itemId - 道具識別碼。
   * @param {number|string} val - 數量數值。
   */
  const handleSellQtyChange = (itemId, val) => {
    setSellQtys((prev) => ({
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

  /**
   * 切換選取的實體類別與 ID（生物、採集點、建築）。
   * @param {'creature' | 'gather' | 'building'} type - 實體類型。
   * @param {string|number} id - 實體識別碼。
   */
  const toggleSelect = (type, id) => {
    if (selectedType === type && selectedId === id) {
      setSelectedType(null);
      setSelectedId(null);
      setGatherQty(1);
    } else {
      setSelectedType(type);
      setSelectedId(id);
      setGatherQty(1);
      setTradeTab('buy');
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
            <Fragment>
              <div className="creatures-horizontal-grid">
                {visibleCreatures.map((c, idx) => {
                  const cId = c.npcId || c.id || idx;
                  const cName = getLocalizedName(c, language);
                  const icon = getNpcIcon(c);
                  const isSelected = selectedType === 'creature' && selectedId === cId;
                  const activeQuestInfo = checkActiveQuest(cId);
                  const availableQuest = checkAvailableQuest(cId, c.name);
                  const hasQuestBadge = Boolean(activeQuestInfo || availableQuest);

                  return (
                    <div
                      key={cId}
                      className={`creature-tile ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelect('creature', cId)}
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

              {selectedType === 'creature' && (() => {
                const c = visibleCreatures.find((item, idx) => (item.npcId || item.id || idx) === selectedId);
                if (!c) return null;
                const cDesc = getLocalizedDesc(c, language);
                const rawType = c.typeEn || c.type || 'MONSTER';
                const isHuman = rawType === 'HUMAN';

                return (
                  <div className="creature-detail-window">
                    {cDesc ? <p className="creature-detail-desc">{cDesc}</p> : null}

                    {isHuman ? (() => {
                      const hasGoodies = Array.isArray(c.goodies) && c.goodies.length > 0;
                      const hasPurchase = Array.isArray(c.purchase) && c.purchase.length > 0;

                      const renderBuyList = () => (
                        <div className="npc-goodies-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {c.goodies.map((goodie, gIdx) => {
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
                          })}
                        </div>
                      );

                      const renderSellList = () => (
                        <div className="npc-purchase-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {c.purchase.map((pItem, pIdx) => {
                            const dbItem = items.find((i) => i.itemId === pItem.itemId);
                            const pName = dbItem ? getLocalizedName(dbItem, language) : pItem.itemId;
                            const unitPrice = pItem.price || 0;
                            const invItem = inventory.find((i) => i.itemId === pItem.itemId);
                            const ownedQty = invItem ? (invItem.count || 1) : 0;
                            const currentQty = sellQtys[pItem.itemId] || 1;
                            const isSellable = ownedQty > 0 && currentQty <= ownedQty;

                            return (
                              <div
                                key={pItem.itemId || pIdx}
                                className="purchase-item-card"
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
                                  <span style={{ fontWeight: 'bold' }}>{pName}</span>
                                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.875rem' }}>
                                    <span style={{ color: '#fbbf24' }}>
                                      {language === 'en' ? `Price: ${unitPrice}` : `收購價: ${unitPrice}`}
                                    </span>
                                    <span style={{ color: '#94a3b8' }}>
                                      {language === 'en' ? `Owned: ${ownedQty}` : `持有: ${ownedQty}`}
                                    </span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                  <QuantitySelector
                                    value={currentQty}
                                    onChange={(val) => handleSellQtyChange(pItem.itemId, val)}
                                    min={1}
                                    max={Math.max(1, ownedQty)}
                                    disabled={ownedQty === 0}
                                  />
                                  <button
                                    type="button"
                                    className="btn-sell"
                                    disabled={!isSellable}
                                    style={{
                                      height: '36px',
                                      padding: '0 16px',
                                      background: isSellable ? '#f59e0b' : '#64748b',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: isSellable ? 'pointer' : 'not-allowed',
                                      fontWeight: 'bold',
                                      opacity: isSellable ? 1 : 0.6,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      performSell(c, pItem.itemId, unitPrice, currentQty);
                                    }}
                                  >
                                    {t.sellBtn || (language === 'en' ? 'Sell' : '出售')}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );

                      const questInfo = checkActiveQuest(c.npcId || c.id);
                      const availableQuest = checkAvailableQuest(c.npcId || c.id, c.name);
                      const canSubmit = questInfo ? checkSubmittable(questInfo.qDef, questInfo.pQuest) : false;

                      const shouldShowActive = questInfo && (questInfo.qDef.displayable === true || canSubmit);
                      const shouldShowAvailable = availableQuest && availableQuest.displayable === true;
                      const hasQuestToShow = Boolean(shouldShowActive || shouldShowAvailable);

                      const renderQuestSection = () => {
                        if (!hasQuestToShow) return null;
                        return (
                          <Fragment>
                            {shouldShowAvailable && (
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

                            {shouldShowActive && (
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
                          </Fragment>
                        );
                      };

                      return (
                        <Fragment>
                          {hasGoodies && hasPurchase ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                                <button
                                  type="button"
                                  style={{
                                    flex: 1,
                                    padding: '6px 12px',
                                    background: tradeTab === 'buy' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                  }}
                                  onClick={() => setTradeTab('buy')}
                                >
                                  {t.buyBtn || (language === 'en' ? 'Buy' : '購買')}
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    flex: 1,
                                    padding: '6px 12px',
                                    background: tradeTab === 'sell' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                  }}
                                  onClick={() => setTradeTab('sell')}
                                >
                                  {t.sellBtn || (language === 'en' ? 'Sell' : '出售')}
                                </button>
                              </div>
                              {tradeTab === 'buy' ? renderBuyList() : renderSellList()}
                            </div>
                          ) : hasGoodies ? (
                            <div style={{ marginTop: '8px' }}>{renderBuyList()}</div>
                          ) : hasPurchase ? (
                            <div style={{ marginTop: '8px' }}>{renderSellList()}</div>
                          ) : !hasQuestToShow ? (
                            <div style={{ padding: '8px', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', marginTop: '8px' }}>
                              {language === 'en' ? 'No items for sale or purchase.' : '此 NPC 暫無販售或收購物品。'}
                            </div>
                          ) : null}
                          {renderQuestSection()}
                        </Fragment>
                      );
                    })() : (
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
            </Fragment>
          )}

          {gatherables.length > 0 && (
            <Fragment>
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
                const unitCost = spot.cost ?? 1;
                const baseTotalCost = unitCost * gatherQty;
                const totalCost = calculateEffectiveEnergyCost(player, baseTotalCost);
                const reqTools = spot.requiredToolTypes || [];

                const getItemTypes = (targetItemId) => {
                  const dbI = items.find((i) => i.itemId === targetItemId);
                  if (!dbI || !dbI.type) return [];
                  return Array.isArray(dbI.type) ? dbI.type : [dbI.type];
                };

                const locBuildingList = currentLocation?.buildings || [];
                const locBuildingTypes = locBuildingList.map((b) => {
                  const dbB = buildings.find((item) => item.buildingId === b.buildingId);
                  return dbB ? dbB.type : b.buildingId;
                });

                const invToolTypes = inventory.flatMap((inv) => {
                  if ((inv.count || 1) <= 0) return [];
                  return getItemTypes(inv.itemId);
                });

                const hasBaitRequirement = reqTools.includes('BAIT');
                const baitEntries = inventory.filter((inv) => getItemTypes(inv.itemId).includes('BAIT'));
                const totalBaitCount = baitEntries.reduce((sum, inv) => sum + (inv.count || 1), 0);
                const requiredBaitTotal = hasBaitRequirement ? 1 * gatherQty : 0;
                const hasEnoughBait = hasBaitRequirement ? totalBaitCount >= requiredBaitTotal : true;

                const nonConsumableReqs = reqTools.filter((t) => t !== 'BAIT');
                const hasNonConsumableTools = nonConsumableReqs.every(
                  (t) => locBuildingTypes.includes(t) || invToolTypes.includes(t)
                );

                const currentEnergy = player?.energy ?? 0;
                const hasEnergy = currentEnergy >= totalCost;
                const isComatose = isPlayerComatose(player);
                const canGather = !isComatose && hasNonConsumableTools && hasEnoughBait && hasEnergy;

                const buttonText = isComatose
                  ? (t.comatoseCannotAct || '昏迷中，無法行動')
                  : !hasNonConsumableTools
                  ? (t.missingTools || '缺少需求工具')
                  : !hasEnoughBait
                  ? (t.notEnoughBait || '肉餌不足')
                  : !hasEnergy
                  ? (t.notEnoughEnergy || '精力不足')
                  : t.gatherBtn;

                return (
                  <div className="gather-detail-window">
                    <div className="gather-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span className="gather-cost">
                        {t.costEnergy}: -{totalCost}
                        {totalCost < baseTotalCost && (
                          <span style={{ color: '#10b981', fontSize: '0.75rem', marginLeft: '4px' }}>(-10%)</span>
                        )}
                        {totalCost > baseTotalCost && (
                          <span style={{ color: '#ef4444', fontSize: '0.75rem', marginLeft: '4px' }}>(+20%)</span>
                        )}
                      </span>
                      <QuantitySelector
                        value={gatherQty}
                        onChange={setGatherQty}
                        min={1}
                        max={hasBaitRequirement ? Math.max(1, totalBaitCount) : Infinity}
                      />
                    </div>

                    {reqTools.length > 0 && (
                      <div className="gather-tools-requirement" style={{ margin: '8px 0', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ color: '#94a3b8', fontWeight: 'bold' }}>{t.reqTools}：</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {reqTools.map((toolType) => {
                            const typeName = (TOOL_TYPE_LABELS[language] && TOOL_TYPE_LABELS[language][toolType]) || toolType;
                            if (toolType === 'BAIT') {
                              const isBaitMet = totalBaitCount >= requiredBaitTotal;
                              return (
                                <span
                                  key={toolType}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: isBaitMet ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: isBaitMet ? '#4ade80' : '#f87171',
                                    border: `1px solid ${isBaitMet ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                  }}
                                >
                                  {typeName} ×{gatherQty} ({isBaitMet ? `${t.toolAvailable || '持有'}: ${totalBaitCount}` : `${t.notEnoughBait || '不足'}: ${totalBaitCount}/${requiredBaitTotal}`})
                                </span>
                              );
                            } else {
                              const hasThisTool = locBuildingTypes.includes(toolType) || invToolTypes.includes(toolType);
                              return (
                                <span
                                  key={toolType}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: hasThisTool ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: hasThisTool ? '#4ade80' : '#f87171',
                                    border: `1px solid ${hasThisTool ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                  }}
                                >
                                  {typeName} ({hasThisTool ? (t.toolAvailable || '已具備') : (t.toolMissing || '缺少')})
                                </span>
                              );
                            }
                          })}
                        </div>
                      </div>
                    )}

                    <div className="gather-detail-actions">
                      <button
                        type="button"
                        className="btn-gather"
                        disabled={!canGather}
                        title={buttonText}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canGather) return;
                          performGather(
                            spot.itemId,
                            unitCost,
                            gatherQty
                          );
                        }}
                      >
                        {buttonText}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </Fragment>
          )}

          {locationBuildings.length > 0 && (
            <Fragment>
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
            </Fragment>
          )}
        </div>
      )}
    </CollapsiblePanel>
  );
};
