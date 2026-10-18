import { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { TOOL_TYPE_LABELS } from '../../constants/translations';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName } from '../../utils/language';
import { isPlayerComatose, calculateEffectiveEnergyCost } from '../../utils/gameHelpers';
import { QuantitySelector } from '../common/QuantitySelector';

/**
 * 物品製作/合成面板元件。
 * 檢查當前地點設施與背包工具、驗證材料充足度、支援批量製作數量調節與即時合成執行。
 * @returns {JSX.Element}
 */
export const CraftPanel = () => {
  const recipes = useGameStore((state) => state.recipes || []);
  const inventory = useGameStore((state) => state.inventory || []);
  const items = useGameStore((state) => state.items || []);
  const locations = useGameStore((state) => state.locations || []);
  const buildings = useGameStore((state) => state.buildings || []);
  const player = useGameStore((state) => state.player || {});
  const performCraft = useGameStore((state) => state.performCraft);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState({});
  const [craftQty, setCraftQty] = useState(1);

  const currentLocation = locations.find((l) => l.locationId === player?.location);

  /**
   * 檢查目前場景建築或背包中是否具備配方所需的工具設施。
   * @param {Object} rec - 配方物件。
   * @returns {boolean} 工具或設施具備回傳 true，否則回傳 false。
   */
  const checkToolsAvailable = (rec) => {
    if (!rec.requiredToolTypes || rec.requiredToolTypes.length === 0) {
      return true;
    }
    const locBuildingList = currentLocation?.buildings || [];
    const locBuildingTypes = locBuildingList.map((b) => {
      const dbB = buildings.find((item) => item.buildingId === b.buildingId);
      return dbB ? dbB.type : b.buildingId;
    });

    const invToolTypes = inventory.flatMap((inv) => {
      const dbI = items.find((i) => i.itemId === inv.itemId);
      if (!dbI || !dbI.type) return [];
      return Array.isArray(dbI.type) ? dbI.type : [dbI.type];
    });

    return rec.requiredToolTypes.every(
      (t) => locBuildingTypes.includes(t) || invToolTypes.includes(t)
    );
  };

  const unlockedRecipes = player?.unlockedRecipes || [];
  const visibleRecipes = recipes.filter((r) => {
    const id = r.recipeId || r.id;
    return unlockedRecipes.some((ur) => (typeof ur === 'string' ? ur === id : ur?.recipeId === id));
  });

  /**
   * 檢查背包中是否具備配方所需的基本材料種類與數量。
   * @param {Object} rec - 配方物件。
   * @returns {boolean} 材料充足回傳 true，否則回傳 false。
   */
  const checkMaterialsAvailable = (rec) => {
    if (!rec.requiredItems || rec.requiredItems.length === 0) {
      return true;
    }
    return rec.requiredItems.every((req) => {
      return inventory.some((inv) => {
        const dbI = items.find((i) => i.itemId === inv.itemId);
        if (!dbI) return false;
        const matchesItem = req.itemId ? inv.itemId === req.itemId : false;
        const types = dbI.type ? (Array.isArray(dbI.type) ? dbI.type : [dbI.type]) : [];
        const matchesType = req.type ? types.includes(req.type) : false;
        return (matchesItem || matchesType) && (inv.count || 1) >= req.quantity;
      });
    });
  };

  const selectedRecipe = visibleRecipes.find(
    (r) => (r.recipeId || r.id || r.name) === selectedRecipeId
  );

  /**
   * 選取或取消選取指定合成配方。
   * @param {string} recId - 配方識別碼。
   */
  const handleSelectRecipe = (recId) => {
    if (selectedRecipeId === recId) {
      setSelectedRecipeId(null);
      setSelectedMaterials({});
      setCraftQty(1);
    } else {
      setSelectedRecipeId(recId);
      setSelectedMaterials({});
      setCraftQty(1);
    }
  };

  /**
   * 執行觸發合成製作。
   * @param {Object} rec - 配方物件。
   * @param {React.MouseEvent} e - 點擊事件物件。
   * @param {boolean} isReady - 當前是否滿足製作條件。
   */
  const handleStartCraft = async (rec, e, isReady) => {
    e.stopPropagation();
    if (!isReady) return;
    const success = await performCraft(rec, selectedMaterials, craftQty);
    if (success) {
      setSelectedMaterials({});
    }
  };

  return (
    <CollapsiblePanel title={t.craftTitle} className="craft-panel">
      {visibleRecipes.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
          {language === 'en' ? 'No recipes available.' : '暫無合成配方。'}
        </div>
      ) : (
        <div className="recipes-panel-wrapper">
          <div className="recipes-horizontal-grid">
            {visibleRecipes.map((rec, idx) => {
              const recId = rec.recipeId || rec.id || rec.name || idx;
              const recName = getLocalizedName(rec, language);
              const isSelected = selectedRecipeId === recId;
              const hasTools = checkToolsAvailable(rec);
              const hasMaterials = checkMaterialsAvailable(rec);
              const isCraftable = hasTools && hasMaterials;

              return (
                <div
                  key={recId}
                  className={`recipe-tile ${isSelected ? 'selected' : ''} ${!isCraftable ? 'disabled' : ''}`}
                  onClick={() => handleSelectRecipe(recId)}
                >
                  <span className={`recipe-tile-name ${!isCraftable ? 'disabled' : ''}`}>
                    {recName}
                  </span>
                  {rec.level ? <span className="recipe-tile-level">LV.{rec.level}</span> : null}
                </div>
              );
            })}
          </div>

          {selectedRecipe && (() => {
            const rec = selectedRecipe;
            const hasTools = checkToolsAvailable(rec);

            const toolLabelText = language === 'en' ? 'Required Tools:' : '需要工具：';
            const availableMatLabelText = t.availableMaterials || (language === 'en' ? 'Available Materials:' : '可用材料：');

            const reqToolsStr = rec.requiredToolTypes && rec.requiredToolTypes.length > 0
              ? rec.requiredToolTypes.map((type) => (TOOL_TYPE_LABELS[language] && TOOL_TYPE_LABELS[language][type]) || type).join(', ')
              : (language === 'en' ? 'None' : '無');

            const reqItemsList = rec.requiredItems || [];
            const hasSelectedAllMaterials = reqItemsList.length === 0 || reqItemsList.every((req, reqIdx) => {
              const selId = selectedMaterials[reqIdx];
              if (!selId) return false;
              const inv = inventory.find((i) => i.itemId === selId);
              if (!inv) return false;
              return (inv.count || 1) >= req.quantity * craftQty;
            });

            const baseEnergyCost = (rec.energyCost || 0) * craftQty;
            const totalEnergyCost = calculateEffectiveEnergyCost(player, baseEnergyCost);
            const hasEnergy = (player?.energy ?? 0) >= totalEnergyCost;
            const isComatose = isPlayerComatose(player);
            const isReadyToCraft = !isComatose && hasTools && hasSelectedAllMaterials && hasEnergy;

            return (
              <div className="recipe-detail-window">
                {rec.level ? (
                  <div className="recipe-detail-header">
                    <span className="recipe-level">{t.reqLevel} LV.{rec.level}</span>
                  </div>
                ) : null}

                <div className="recipe-detail-body">
                  {reqItemsList.map((req, reqIdx) => {
                    const reqTotal = req.quantity * craftQty;
                    const eligibleItems = inventory.filter((inv) => {
                      const dbI = items.find((i) => i.itemId === inv.itemId);
                      if (!dbI) return false;
                      const matchesItem = req.itemId ? inv.itemId === req.itemId : false;
                      const types = dbI.type ? (Array.isArray(dbI.type) ? dbI.type : [dbI.type]) : [];
                      const matchesType = req.type ? types.includes(req.type) : false;
                      return (matchesItem || matchesType) && (inv.count || 1) >= reqTotal;
                    });
                    const targetItem = req.itemId ? items.find((it) => it.itemId === req.itemId) : null;
                    const reqLabel = targetItem ? getLocalizedName(targetItem, language) : (req.type || req.itemId);

                    return (
                      <div className="recipe-detail-row vertical" key={reqIdx} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span className="recipe-detail-label">
                          {availableMatLabelText} ({reqLabel} x{reqTotal})：
                        </span>
                        <div className="material-options-wrapper">
                          {eligibleItems.length > 0 ? (
                            eligibleItems.map((inv) => {
                              const invKey = inv.itemId;
                              const dbI = items.find((i) => i.itemId === inv.itemId);
                              const itemName = dbI ? getLocalizedName(dbI, language) : inv.itemId;
                              const isOptionSelected = selectedMaterials[reqIdx] === invKey;

                              return (
                                <button
                                  key={invKey}
                                  type="button"
                                  className={`btn-material-option ${isOptionSelected ? 'selected' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMaterials((prev) => ({
                                      ...prev,
                                      [reqIdx]: isOptionSelected ? null : invKey,
                                    }));
                                  }}
                                >
                                  {itemName} ({inv.count || 1}/{reqTotal})
                                </button>
                              );
                            })
                          ) : (
                            <span className="no-material-notice">
                              {language === 'en'
                                ? `No single item matching ${reqLabel} (req >= ${reqTotal})`
                                : `無符合數量 (≥${reqTotal}) 的 ${reqLabel} 材料`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="recipe-detail-row">
                    <span className="recipe-detail-label">{toolLabelText}</span>
                    <span className="recipe-detail-val">{reqToolsStr}</span>
                  </div>

                  {(() => {
                    // 解析 base 材料與 modifier 材料以動態計算產出
                    let baseMaterialId = '';
                    const modifierMaterialIds = [];

                    reqItemsList.forEach((req, idx) => {
                      const selId = selectedMaterials[idx];
                      if (!selId) return;
                      if (req.role === 'base') {
                        if (!baseMaterialId) baseMaterialId = selId;
                      } else if (req.role === 'modifier') {
                        modifierMaterialIds.push(selId);
                      }
                    });

                    if (!baseMaterialId) {
                      baseMaterialId = selectedMaterials[0] || '';
                    }

                    // 方案 A：解析 effectiveOutputs（支援字串主要產物映射與完整產物陣列映射）
                    const mappedOutput = rec.outputs && typeof rec.outputs === 'object'
                      ? (rec.outputs[baseMaterialId] || rec.outputs['default'])
                      : null;

                    const effectiveOutputs = (Array.isArray(mappedOutput) && mappedOutput.length > 0)
                      ? mappedOutput.map((item) => ({
                        itemId: item.itemId,
                        quantity: item.quantity || 1,
                      }))
                      : (rec.outputItems || []).map((out, idx) => {
                        let finalItemId = '';
                        if (idx === 0 && typeof mappedOutput === 'string' && mappedOutput.trim()) {
                          finalItemId = mappedOutput.trim();
                        } else if (out.itemId) {
                          finalItemId = out.itemId;
                        }
                        if (!finalItemId) {
                          finalItemId = out.itemId || rec.recipeId;
                        }
                        return {
                          itemId: finalItemId,
                          quantity: out.quantity || 1,
                        };
                      });

                    let previewPrefix = '';
                    let previewPrefixEn = '';
                    const previewBonus = {
                      hp: 0, strength: 0, speed: 0, dexterity: 0, defense: 0, maxHp: 0, water: 0, food: 0,
                    };
                    let hasModifierBonus = false;

                    if (rec.modifiers && typeof rec.modifiers === 'object') {
                      modifierMaterialIds.forEach((modId) => {
                        const mod = rec.modifiers[modId];
                        if (mod) {
                          if (mod.prefix) {
                            previewPrefix = previewPrefix ? `${previewPrefix}・${mod.prefix}` : mod.prefix;
                          }
                          if (mod.prefixEn) {
                            previewPrefixEn = previewPrefixEn ? `${mod.prefixEn} ${previewPrefixEn}` : mod.prefixEn;
                          }
                          if (mod.bonusNutrition) {
                            for (const [k, v] of Object.entries(mod.bonusNutrition)) {
                              if (typeof v === 'number' && v !== 0 && previewBonus[k] !== undefined) {
                                previewBonus[k] += v;
                                hasModifierBonus = true;
                              }
                            }
                          }
                        }
                      });
                    }

                    const primaryFinalId = effectiveOutputs[0]?.itemId || '';
                    const primaryDbItem = items.find((i) => i.itemId === primaryFinalId);

                    const baseNut = primaryDbItem?.nutrition || {};
                    const totalNut = {
                      hp: (baseNut.hp || 0) + (hasModifierBonus ? previewBonus.hp : 0),
                      strength: (baseNut.strength || 0) + (hasModifierBonus ? previewBonus.strength : 0),
                      speed: (baseNut.speed || 0) + (hasModifierBonus ? previewBonus.speed : 0),
                      dexterity: (baseNut.dexterity || 0) + (hasModifierBonus ? previewBonus.dexterity : 0),
                      defense: (baseNut.defense || 0) + (hasModifierBonus ? previewBonus.defense : 0),
                      maxHp: (baseNut.maxHp || 0) + (hasModifierBonus ? previewBonus.maxHp : 0),
                      water: (baseNut.water || 0) + (hasModifierBonus ? previewBonus.water : 0),
                      food: (baseNut.food || 0) + (hasModifierBonus ? previewBonus.food : 0),
                    };

                    const nutParts = [];
                    if (totalNut.hp) nutParts.push(`HP ${totalNut.hp > 0 ? `+${totalNut.hp}` : totalNut.hp}`);
                    if (totalNut.strength) nutParts.push(`${language === 'en' ? 'STR' : '力量'} +${totalNut.strength}`);
                    if (totalNut.speed) nutParts.push(`${language === 'en' ? 'SPD' : '速度'} +${totalNut.speed}`);
                    if (totalNut.dexterity) nutParts.push(`${language === 'en' ? 'DEX' : '精巧'} +${totalNut.dexterity}`);
                    if (totalNut.defense) nutParts.push(`${language === 'en' ? 'DEF' : '防禦'} +${totalNut.defense}`);
                    if (totalNut.maxHp) nutParts.push(`${language === 'en' ? 'Max HP' : '最大HP'} +${totalNut.maxHp}`);
                    if (totalNut.water) nutParts.push(`${language === 'en' ? 'Water' : '水分'} ${totalNut.water > 0 ? `+${totalNut.water}` : totalNut.water}`);
                    if (totalNut.food) nutParts.push(`${language === 'en' ? 'Food' : '飽食'} ${totalNut.food > 0 ? `+${totalNut.food}` : totalNut.food}`);

                    return (
                      <div className="recipe-detail-row preview-box" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', gap: '4px', marginTop: '2px' }}>
                        <span className="recipe-detail-label">{language === 'en' ? 'Output:' : '產出預覽：'}</span>
                        {effectiveOutputs.map((out, outIdx) => {
                          const isPrimary = (outIdx === 0);
                          const previewDbItem = items.find((i) => i.itemId === out.itemId);
                          const baseItemName = previewDbItem ? getLocalizedName(previewDbItem, language) : (out.itemId || rec.name);
                          const previewDisplayName = isPrimary && previewPrefix && language !== 'en'
                            ? `${previewPrefix}・${baseItemName}`
                            : (isPrimary && previewPrefixEn && language === 'en' ? `${previewPrefixEn} ${baseItemName}` : baseItemName);
                          const outputQuantity = (out.quantity || 1) * craftQty;

                          return (
                            <div key={`${out.itemId}_${outIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {previewDbItem?.imageUrl && (
                                <img src={previewDbItem.imageUrl} alt={previewDisplayName} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                              )}
                              <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                                {previewDisplayName} x{outputQuantity}
                              </span>
                            </div>
                          );
                        })}
                        {nutParts.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
                            <span>{language === 'en' ? 'Effect' : '效果'}: {nutParts.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {rec.energyCost ? (
                    <div className="recipe-detail-row">
                      <span className="recipe-detail-label">{language === 'en' ? 'Energy Cost:' : '精力消耗：'}</span>
                      <span className="recipe-detail-val">
                        {totalEnergyCost}
                        {totalEnergyCost < baseEnergyCost && (
                          <span style={{ color: '#10b981', fontSize: '0.75rem', marginLeft: '6px' }}>(-10%)</span>
                        )}
                        {totalEnergyCost > baseEnergyCost && (
                          <span style={{ color: '#ef4444', fontSize: '0.75rem', marginLeft: '6px' }}>(+20%)</span>
                        )}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="recipe-detail-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <QuantitySelector value={craftQty} onChange={setCraftQty} min={1} />
                  <button
                    type="button"
                    className="btn-craft"
                    disabled={!isReadyToCraft}
                    title={isComatose ? (t.comatoseCannotAct || '昏迷中，無法行動') : undefined}
                    onClick={(e) => handleStartCraft(rec, e, isReadyToCraft)}
                  >
                    {isComatose ? (t.comatose || '昏迷中') : t.startCraft}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </CollapsiblePanel>
  );
};
