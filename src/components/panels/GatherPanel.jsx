import { useState, Fragment } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { TOOL_TYPE_LABELS } from '../../constants/translations';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName, getLocalizedDesc } from '../../utils/language';
import {
  getNpcIcon,
  isPlayerComatose,
  calculateEffectiveEnergyCost,
  calculateMaxExecutableBySatiety,
  getRequiredExpForNextLevel,
  roundExp,
  getMatchingToolsAscending,
  getItemDurabilityPercent,
  getDurabilityStatusInfo,
  getDurabilityColor,
  calculateLiquidContainerCapacity,
  calculateSuccessRate,
} from '../../utils/gameHelpers';
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
  const repairBuilding = useGameStore((state) => state.repairBuilding);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedType, setSelectedType] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [gatherQty, setGatherQty] = useState(1);
  const [buyQtys, setBuyQtys] = useState({});
  const [sellQtys, setSellQtys] = useState({});
  const [tradeTab, setTradeTab] = useState('buy');
  const [repairQtys, setRepairQtys] = useState({});
  const [isRepairing, setIsRepairing] = useState(false);

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
                const totalCost = calculateEffectiveEnergyCost(player, baseTotalCost, 'GATHER');
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

                const hasBaitRequirement = reqTools.includes('BAIT');
                const baitEntries = inventory.filter((inv) => getItemTypes(inv.itemId).includes('BAIT'));
                const totalBaitCount = baitEntries.reduce((sum, inv) => sum + (inv.count || 1), 0);
                const requiredBaitTotal = hasBaitRequirement ? 1 * gatherQty : 0;
                const hasEnoughBait = hasBaitRequirement ? totalBaitCount >= requiredBaitTotal : true;

                const nonConsumableReqs = reqTools.filter((t) => t !== 'BAIT');
                const hasNonConsumableTools = nonConsumableReqs.every(
                  (t) => locBuildingTypes.includes(t) || getMatchingToolsAscending(inventory, t, items).length > 0
                );

                const singleCost = calculateEffectiveEnergyCost(player, unitCost, 'GATHER');
                const maxBySatiety = calculateMaxExecutableBySatiety(player, singleCost);
                const hasSatiety = maxBySatiety >= 1;

                const currentEnergy = Math.round((player?.energy ?? 0) * 10) / 10;
                const hasEnergy = currentEnergy >= totalCost;
                const isComatose = isPlayerComatose(player);
                const spotDbItem = items.find((i) => i.itemId === spot.itemId);
                const spotTypes = Array.isArray(spotDbItem?.type) ? spotDbItem.type : (spotDbItem?.type ? [spotDbItem.type] : []);
                const isLiquidResource = spotTypes.includes('LIQUID');

                let totalAvailableContainerCap = Infinity;
                let hasAvailableContainer = true;
                if (isLiquidResource) {
                  const capInfo = calculateLiquidContainerCapacity(inventory, spot.itemId, items);
                  totalAvailableContainerCap = capInfo.totalAvailableCapacity;
                  hasAvailableContainer = totalAvailableContainerCap > 0;
                }
                const canGather = !isComatose && hasSatiety && hasNonConsumableTools && hasEnoughBait && hasEnergy && hasAvailableContainer;

                const buttonText = isComatose
                  ? (t.comatose || (language === 'en' ? 'Comatose' : '昏迷中'))
                  : !hasSatiety
                  ? (language === 'en' ? 'Famished' : '飢渴中')
                  : !hasNonConsumableTools
                  ? (t.missingTools || '缺少需求工具')
                  : !hasEnoughBait
                  ? (t.notEnoughBait || '肉餌不足')
                  : !hasAvailableContainer
                  ? (language === 'en' ? 'No container available' : '無可裝的空容器')
                  : !hasEnergy
                  ? (t.notEnoughEnergy || '精力不足')
                  : t.gatherBtn;

                const spotSkill = spot.skillType || (
                  nonConsumableReqs.includes('MINING_TOOL')
                    ? 'MINING'
                    : (reqTools.includes('FISHING_NET') || reqTools.includes('LANDING_NET')
                      ? 'FISHING'
                      : 'GATHERING')
                );
                const skillObj = player?.lifeSkills?.[spotSkill] || { level: 0, exp: 0 };
                const currentLevel = skillObj.level ?? 0;
                const isMax = currentLevel >= 5;
                const skillNames = {
                  GATHERING: { name: language === 'en' ? 'Gathering' : '採集', icon: '🌿' },
                  FISHING: { name: language === 'en' ? 'Fishing' : '釣魚', icon: '🎣' },
                  MINING: { name: language === 'en' ? 'Mining' : '挖礦', icon: '⛏️' },
                };
                const currentSkillInfo = skillNames[spotSkill] || { name: language === 'en' ? 'Gathering' : '採集', icon: '🌿' };
                const reqExp = getRequiredExpForNextLevel(currentLevel);
                const baseChance = typeof spot.chance === 'number' ? spot.chance : 100;
                const finalSuccessRate = calculateSuccessRate(baseChance, currentLevel);

                const maxByEnergy = singleCost > 0 ? Math.floor(currentEnergy / singleCost) : Infinity;
                const maxByBait = hasBaitRequirement ? totalBaitCount : Infinity;
                const maxByContainer = isLiquidResource ? totalAvailableContainerCap : Infinity;
                const calculatedMaxGather = (!hasNonConsumableTools || isComatose || !hasAvailableContainer || maxBySatiety <= 0)
                  ? 1
                  : Math.max(1, Math.min(maxByEnergy, maxByBait, maxByContainer, maxBySatiety));

                return (
                  <div className="gather-detail-window">
                    <div className="gather-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span />
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 500 }}>
                        {currentSkillInfo.icon} {currentSkillInfo.name} LV.{currentLevel}{isMax ? ' (MAX)' : ''} ({roundExp(skillObj.exp)}{isMax ? '' : `/${reqExp}`} EXP)
                      </span>
                    </div>

                    {isLiquidResource && (
                      <div style={{ margin: '6px 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <span>{language === 'en' ? 'Container Available Space' : '容器可用容量'}：</span>
                        <span style={{ color: '#ffffff', fontWeight: 600 }}>{totalAvailableContainerCap === Infinity ? 0 : totalAvailableContainerCap}</span>
                      </div>
                    )}

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
                              const isBuilding = locBuildingTypes.includes(toolType);
                              const matchingTools = getMatchingToolsAscending(inventory, toolType, items);
                              const hasThisTool = isBuilding || matchingTools.length > 0;
                              let displayText;
                              let badgeStyle;

                              if (isBuilding) {
                                displayText = t.toolFacility || (language === 'en' ? 'Facility' : '已具備(設施)');
                                badgeStyle = {
                                  background: 'rgba(34, 197, 94, 0.15)',
                                  color: '#4ade80',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                };
                              } else if (!hasThisTool) {
                                displayText = t.toolMissing || (language === 'en' ? 'Missing' : '缺少');
                                badgeStyle = {
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                };
                              } else {
                                const targetTool = matchingTools[0];
                                const dbI = items.find((i) => i.itemId === targetTool.itemId);
                                const percent = getItemDurabilityPercent(targetTool, dbI);
                                const statusInfo = getDurabilityStatusInfo(percent, language);
                                displayText = statusInfo.text;
                                badgeStyle = statusInfo.badgeStyle;
                              }

                              return (
                                <span
                                  key={toolType}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    ...badgeStyle,
                                  }}
                                >
                                  {typeName} ({displayText})
                                </span>
                              );
                            }
                          })}
                        </div>
                      </div>
                    )}

                    <div className="detail-action-container">
                      <div className="detail-qty-row">
                        <span className="detail-qty-label">
                          {t.gatherAttempts || (language === 'en' ? 'Attempts:' : '採集次數：')}
                        </span>
                        <QuantitySelector
                          value={gatherQty}
                          onChange={setGatherQty}
                          min={1}
                          max={calculatedMaxGather}
                        />
                      </div>
                      <div className="detail-buttons-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className="gather-cost">
                            {t.costEnergy}: -{totalCost}
                            {totalCost !== baseTotalCost && (
                              <span style={{ color: totalCost < baseTotalCost ? '#10b981' : '#ef4444', fontSize: '0.75rem', marginLeft: '4px' }}>
                                ({totalCost < baseTotalCost ? '' : '+'}{Math.round(((totalCost - baseTotalCost) / baseTotalCost) * 100)}%)
                              </span>
                            )}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            {language === 'en' ? 'Success Rate:' : '成功率：'}
                            <strong style={{ color: '#38bdf8', marginLeft: '4px' }}>{finalSuccessRate}%</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`btn-gather ${isComatose ? 'btn-comatose' : ''} ${!hasSatiety && !isComatose ? 'btn-famished' : ''}`}
                          disabled={!canGather}
                          title={buttonText}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canGather) return;
                            performGather(
                              spot.itemId,
                              unitCost,
                              Math.min(gatherQty, calculatedMaxGather)
                            );
                          }}
                        >
                          {buttonText}
                        </button>
                      </div>
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
                  const bName = dbBuilding ? (language === 'en' && dbBuilding.nameEn ? dbBuilding.nameEn : dbBuilding.name) : b.buildingId;
                  const isSelected = selectedType === 'building' && selectedId === bId;
                  const bIcon = dbBuilding?.type === 'HEATING' ? '🔥' : '🏠';
                  const maxDur = dbBuilding?.durability ?? -1;
                  const curDur = maxDur !== -1 ? (b.currentDurability !== undefined ? b.currentDurability : maxDur) : -1;
                  const percent = maxDur > 0 ? Math.max(0, Math.min(100, Math.round((curDur / maxDur) * 100))) : -1;
                  const durColor = percent >= 0 ? getDurabilityColor(percent) : '#22c55e';

                  return (
                    <div
                      key={bId}
                      className={`gather-tile building-tile ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelect('building', bId)}
                    >
                      <div className="gather-tile-icon" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span>{bIcon}</span>
                        {maxDur > 0 && (
                          <div
                            style={{
                              width: '80%',
                              height: '4px',
                              background: 'rgba(0, 0, 0, 0.6)',
                              borderRadius: '2px',
                              overflow: 'hidden',
                              marginTop: '3px',
                            }}
                            title={`${language === 'en' ? 'Durability' : '耐久度'}: ${curDur}/${maxDur}`}
                          >
                            <div
                              style={{
                                width: `${percent}%`,
                                height: '100%',
                                background: durColor,
                                transition: 'width 0.2s ease',
                              }}
                            />
                          </div>
                        )}
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
                const bName = dbBuilding ? (language === 'en' && dbBuilding.nameEn ? dbBuilding.nameEn : dbBuilding.name) : b.buildingId;
                const maxDur = dbBuilding?.durability ?? -1;
                const curDur = maxDur !== -1 ? (b.currentDurability !== undefined ? b.currentDurability : maxDur) : -1;
                const percent = maxDur > 0 ? Math.max(0, Math.min(100, Math.round((curDur / maxDur) * 100))) : -1;
                const durColor = percent >= 0 ? getDurabilityColor(percent) : '#22c55e';
                const repairItems = dbBuilding?.repairItems || [];
                const isDamaged = maxDur > 0 && curDur < maxDur;
                const isBroken = maxDur > 0 && curDur <= 0;

                return (
                  <div className="gather-detail-window">
                    <div className="gather-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="gather-detail-name">{bName}</span>
                      {maxDur === -1 ? (
                        <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                          {language === 'en' ? 'Permanent' : '永久設施'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: durColor, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${durColor}44` }}>
                          {isBroken ? (language === 'en' ? 'Broken' : '已損壞') : `${percent}%`}
                        </span>
                      )}
                    </div>

                    {maxDur > 0 && (
                      <div style={{ margin: '8px 0', padding: '8px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                          <span style={{ color: '#cbd5e1' }}>{language === 'en' ? 'Durability' : '目前耐久度'}:</span>
                          <span style={{ color: durColor, fontWeight: 600 }}>
                            {curDur} / {maxDur}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${percent}%`, height: '100%', background: durColor, transition: 'width 0.2s ease' }} />
                        </div>
                      </div>
                    )}

                    {/* 修復道具需求與控制項 */}
                    {maxDur > 0 && repairItems.length > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                          🔨 {language === 'en' ? 'Repair Materials' : '修復材料需求'}
                        </span>

                        {repairItems.map((r) => {
                          const dbItem = items.find((i) => i.itemId === r.itemId);
                          const itemName = dbItem ? getLocalizedName(dbItem, language) : r.itemId;
                          const heldCount = inventory
                            .filter((inv) => inv.itemId === r.itemId)
                            .reduce((sum, inv) => sum + (inv.count || 1), 0);
                          const rate = r.rate || 1;
                          const missingDur = Math.max(0, maxDur - curDur);
                          const neededQty = Math.ceil(missingDur / rate);
                          const maxQty = Math.max(1, Math.min(heldCount, neededQty));
                          const currentQty = repairQtys[r.itemId] ?? 1;
                          const canRepair = heldCount > 0 && isDamaged && !isRepairing;

                          return (
                            <div
                              key={r.itemId}
                              style={{
                                padding: '8px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '6px',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {dbItem?.imageUrl ? (
                                    <img src={dbItem.imageUrl} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                  ) : (
                                    <span>📦</span>
                                  )}
                                  <strong style={{ color: '#f8fafc' }}>{itemName}</strong>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: heldCount > 0 ? '#4ade80' : '#f87171' }}>
                                  {language === 'en' ? 'Held:' : '持有:'} {heldCount}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {language === 'en'
                                  ? `Restores +${rate} durability each`
                                  : `每 1 個可修復 +${rate} 點耐久度`}
                              </div>

                              {isDamaged ? (
                                heldCount > 0 ? (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                    <QuantitySelector
                                      value={Math.min(currentQty, maxQty)}
                                      onChange={(newVal) =>
                                        setRepairQtys((prev) => ({ ...prev, [r.itemId]: newVal }))
                                      }
                                      min={1}
                                      max={maxQty}
                                    />
                                    <button
                                      type="button"
                                      className="btn-repair"
                                      disabled={!canRepair}
                                      style={{
                                        padding: '4px 12px',
                                        background: canRepair ? '#10b981' : '#475569',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: canRepair ? 'pointer' : 'not-allowed',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        transition: 'background 0.2s',
                                      }}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const qtyToUse = Math.min(currentQty, maxQty);
                                        setIsRepairing(true);
                                        try {
                                          const success = await repairBuilding(player.location, b.buildingId, r.itemId, qtyToUse);
                                          if (success) {
                                            setRepairQtys((prev) => ({ ...prev, [r.itemId]: 1 }));
                                          }
                                        } finally {
                                          setIsRepairing(false);
                                        }
                                      }}
                                    >
                                      {isRepairing
                                        ? (language === 'en' ? 'Repairing...' : '修復中...')
                                        : (language === 'en' ? 'Repair' : '修復')}
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.75rem', color: '#f87171', fontStyle: 'italic' }}>
                                    {language === 'en' ? 'No repair materials in inventory.' : '（背包中未持有此修復材料）'}
                                  </div>
                                )
                              ) : (
                                <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
                                  ✓ {language === 'en' ? 'Facility is at full durability.' : '設施耐久度已滿'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
