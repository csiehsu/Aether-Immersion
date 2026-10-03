import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName } from '../../utils/language';

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
      const dbI = items.find((i) => i.itemId === inv.itemId || i.name === inv.name);
      if (!dbI || !dbI.type) return [];
      return Array.isArray(dbI.type) ? dbI.type : [dbI.type];
    });

    return rec.requiredToolTypes.every(
      (t) => locBuildingTypes.includes(t) || invToolTypes.includes(t)
    );
  };

  const checkMaterialsAvailable = (rec) => {
    if (!rec.requiredItems || rec.requiredItems.length === 0) {
      return true;
    }
    return rec.requiredItems.every((req) => {
      return inventory.some((inv) => {
        const dbI = items.find((i) => i.itemId === inv.itemId || i.name === inv.name);
        if (!dbI || !dbI.type) return false;
        const types = Array.isArray(dbI.type) ? dbI.type : [dbI.type];
        return types.includes(req.type) && (inv.count || 1) >= req.quantity;
      });
    });
  };

  const selectedRecipe = recipes.find(
    (r) => (r.recipeId || r.id || r.name) === selectedRecipeId
  );

  const handleSelectRecipe = (recId) => {
    if (selectedRecipeId === recId) {
      setSelectedRecipeId(null);
      setSelectedMaterials({});
    } else {
      setSelectedRecipeId(recId);
      setSelectedMaterials({});
    }
  };

  const handleStartCraft = async (rec, e, isReady) => {
    e.stopPropagation();
    if (!isReady) return;
    const success = await performCraft(rec, selectedMaterials);
    if (success) {
      setSelectedMaterials({});
    }
  };

  return (
    <CollapsiblePanel title={t.craftTitle} className="craft-panel">
      {recipes.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
          {language === 'en' ? 'No recipes available.' : '暫無合成配方。'}
        </div>
      ) : (
        <div className="recipes-panel-wrapper">
          <div className="recipes-horizontal-grid">
            {recipes.map((rec, idx) => {
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
              const inv = inventory.find((i) => (i.id || i.itemId) === selId);
              if (!inv) return false;
              return (inv.count || 1) >= req.quantity;
            });

            const isReadyToCraft = hasTools && hasSelectedAllMaterials;

            return (
              <div className="recipe-detail-window">
                {rec.level ? (
                  <div className="recipe-detail-header">
                    <span className="recipe-level">{t.reqLevel} LV.{rec.level}</span>
                  </div>
                ) : null}

                <div className="recipe-detail-body">
                  {reqItemsList.map((req, reqIdx) => {
                    const eligibleItems = inventory.filter((inv) => {
                      const dbI = items.find((i) => i.itemId === inv.itemId || i.name === inv.name);
                      if (!dbI || !dbI.type) return false;
                      const types = Array.isArray(dbI.type) ? dbI.type : [dbI.type];
                      return types.includes(req.type) && (inv.count || 1) >= req.quantity;
                    });

                    return (
                      <div className="recipe-detail-row vertical" key={reqIdx} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span className="recipe-detail-label">
                          {availableMatLabelText} ({req.type} x{req.quantity})：
                        </span>
                        <div className="material-options-wrapper">
                          {eligibleItems.length > 0 ? (
                            eligibleItems.map((inv) => {
                              const invKey = inv.id || inv.itemId;
                              const dbI = items.find((i) => i.itemId === inv.itemId || i.name === inv.name);
                              const itemName = dbI ? getLocalizedName(dbI, language) : getLocalizedName(inv, language);
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
                                  {itemName} ({inv.count || 1}/{req.quantity})
                                </button>
                              );
                            })
                          ) : (
                            <span className="no-material-notice">
                              {language === 'en'
                                ? `No single item matching ${req.type} (req >= ${req.quantity})`
                                : `無符合數量 (≥${req.quantity}) 的 ${req.type} 材料`}
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
                </div>

                <div className="recipe-detail-actions">
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
