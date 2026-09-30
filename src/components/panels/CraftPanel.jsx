import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName } from '../../utils/language';

export const CraftPanel = () => {
  const recipes = useGameStore((state) => state.recipes || []);
  const performCraft = useGameStore((state) => state.performCraft);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [selectedRecipeId, setSelectedRecipeId] = useState(null);

  const selectedRecipe = recipes.find(
    (r) => (r.recipeId || r.id || r.name) === selectedRecipeId
  );

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

              return (
                <div
                  key={recId}
                  className={`recipe-tile ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedRecipeId(isSelected ? null : recId)}
                >
                  <span className="recipe-tile-name">{recName}</span>
                  {rec.level ? <span className="recipe-tile-level">LV.{rec.level}</span> : null}
                </div>
              );
            })}
          </div>

          {selectedRecipe && (() => {
            const rec = selectedRecipe;
            const recName = getLocalizedName(rec, language);

            const reqItemsStr = rec.requiredItems && rec.requiredItems.length > 0
              ? rec.requiredItems.map((i) => `${i.type} x${i.quantity}`).join(', ')
              : (language === 'en' ? rec.reqEn || rec.req || 'None' : rec.req || '無');

            const reqToolsStr = rec.requiredToolTypes && rec.requiredToolTypes.length > 0
              ? rec.requiredToolTypes.join(', ')
              : (language === 'en' ? 'None' : '無');

            const yieldStr = rec.outputItems && rec.outputItems.length > 0
              ? rec.outputItems.map((i) => `${i.type} x${i.quantity}`).join(', ')
              : (language === 'en' ? rec.descEn || rec.desc || '-' : rec.desc || '-');

            const toolLabelText = language === 'en' ? 'Required Tools:' : '需要工具：';
            const yieldLabelText = language === 'en' ? 'Yield:' : '產出：';

            return (
              <div className="recipe-detail-window">
                {rec.level ? (
                  <div className="recipe-detail-header">
                    <span className="recipe-level">{t.reqLevel} LV.{rec.level}</span>
                  </div>
                ) : null}

                <div className="recipe-detail-body">
                  <div className="recipe-detail-row">
                    <span className="recipe-detail-label">{yieldLabelText}</span>
                    <span className="recipe-detail-val">{yieldStr}</span>
                  </div>

                  <div className="recipe-detail-row">
                    <span className="recipe-detail-label">{t.reqMaterials}：</span>
                    <span className="recipe-detail-val">{reqItemsStr}</span>
                  </div>

                  <div className="recipe-detail-row">
                    <span className="recipe-detail-label">{toolLabelText}</span>
                    <span className="recipe-detail-val">{reqToolsStr}</span>
                  </div>
                </div>

                <div className="recipe-detail-actions">
                  <button
                    type="button"
                    className="btn-craft"
                    onClick={(e) => {
                      e.stopPropagation();
                      performCraft(rec.name, rec.nameEn || rec.name);
                    }}
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
