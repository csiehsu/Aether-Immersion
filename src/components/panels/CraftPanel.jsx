import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName } from '../../utils/language';
import { QuantitySelector } from '../common/QuantitySelector';

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
    if (id === 'recipe001' || id === 'recipe002') return true;
    return unlockedRecipes.some((ur) => (typeof ur === 'string' ? ur === id : ur?.recipeId === id));
  });

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
              ? rec.requiredToolTypes.join(', ')
              : (language === 'en' ? 'None' : '無');

            const reqItemsList = rec.requiredItems || [];
            const hasSelectedAllMaterials = reqItemsList.length === 0 || reqItemsList.every((req, reqIdx) => {
              const selId = selectedMaterials[reqIdx];
              if (!selId) return false;
              const inv = inventory.find((i) => i.itemId === selId);
              if (!inv) return false;
              return (inv.count || 1) >= req.quantity * craftQty;
            });

            const totalEnergyCost = (rec.energyCost || 0) * craftQty;
            const hasEnergy = (player?.energy ?? 0) >= totalEnergyCost;
            const isReadyToCraft = hasTools && hasSelectedAllMaterials && hasEnergy;

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

                  {rec.energyCost ? (
                    <div className="recipe-detail-row">
                      <span className="recipe-detail-label">{language === 'en' ? 'Energy Cost:' : '精力消耗：'}</span>
                      <span className="recipe-detail-val">{totalEnergyCost}</span>
                    </div>
                  ) : null}
                </div>

                <div className="recipe-detail-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <QuantitySelector value={craftQty} onChange={setCraftQty} min={1} />
                  <button
                    type="button"
                    className="btn-craft"
                    disabled={!isReadyToCraft}
                    onClick={(e) => handleStartCraft(rec, e, isReadyToCraft)}
                  >
                    {t.startCraft}
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
