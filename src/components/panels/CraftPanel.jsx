import React from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedName } from '../../utils/language';

export const CraftPanel = () => {
  const recipes = useGameStore((state) => state.recipes || []);
  const performCraft = useGameStore((state) => state.performCraft);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  return (
    <CollapsiblePanel title={t.craftTitle} className="craft-panel">
      <div className="recipe-grid">
        {recipes.map((rec, idx) => {
          const recName = getLocalizedName(rec, language);

          let recReq = language === 'en' ? rec.reqEn : rec.req;
          if (!recReq && rec.requiredItems) {
            const reqItemsStr = rec.requiredItems.map((i) => `${i.type} x${i.quantity}`).join(', ');
            const reqToolsStr = rec.requiredToolTypes && rec.requiredToolTypes.length > 0
              ? ` (${rec.requiredToolTypes.join(', ')})`
              : '';
            recReq = `${reqItemsStr}${reqToolsStr}`;
          }

          let recDesc = language === 'en' ? rec.descEn : rec.desc;
          if (!recDesc && rec.outputItems) {
            recDesc = language === 'en'
              ? `Yields: ${rec.outputItems.map((i) => `${i.type} x${i.quantity}`).join(', ')}`
              : `產出：${rec.outputItems.map((i) => `${i.type} x${i.quantity}`).join(', ')}`;
          }

          const icon = rec.icon || '🔥';

          return (
            <div key={rec.recipeId || rec.id || idx} className="recipe-card">
              <div className="recipe-top">
                <span className="recipe-icon">{icon}</span>
                <div className="recipe-info">
                  <h4 className="recipe-name">{recName}</h4>
                  {rec.level ? <span className="recipe-level">{t.reqLevel} LV.{rec.level}</span> : null}
                </div>
              </div>
              {recDesc ? <p className="recipe-desc">{recDesc}</p> : null}
              <div className="recipe-req">
                <span className="req-label">{t.reqMaterials}: </span>
                <span className="req-val">{recReq}</span>
              </div>
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
          );
        })}
      </div>
    </CollapsiblePanel>
  );
};
