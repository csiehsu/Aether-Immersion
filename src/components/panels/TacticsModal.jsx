import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { TACTIC_CONDITIONS } from '../../constants/gameConstants';

/**
 * 自動戰鬥戰術策略配置彈窗元件 (Gambits / Auto Tactics Settings Modal)。
 * 允許玩家依序自訂技能施放條件與優先級，設定完成後自動寫入玩家資料庫。
 * @param {Object} props
 * @param {boolean} props.isOpen - 彈窗是否開啟。
 * @param {Function} props.onClose - 關閉彈窗回調。
 * @returns {JSX.Element|null}
 */
export const TacticsModal = ({ isOpen, onClose }) => {
  const battleSettings = useGameStore((state) => state.battleSettings || {});
  const battleSkills = useGameStore((state) => state.battleSkills || []);
  const statusEffects = useGameStore((state) => state.statusEffects || []);
  const updateBattleSettings = useGameStore((state) => state.updateBattleSettings);
  const language = useGameStore((state) => state.language);

  const isEn = language === 'en';

  const defaultTactics = [
    { priority: 1, skillId: 'SKILL_MINDS_EYE', condition: 'SELF_NOT_HAS_STATUS', targetStatusId: 'STATUS_FOCUSED' },
    { priority: 2, skillId: 'SKILL_FLAT_STRIKE', condition: 'TARGET_NOT_HAS_STATUS', targetStatusId: 'STATUS_STUN' },
    { priority: 3, skillId: 'SKILL_VOID_SLASH', condition: 'ALWAYS', targetStatusId: '' },
    { priority: 4, skillId: 'SKILL_SPINNING_SLASH', condition: 'ALWAYS', targetStatusId: '' },
  ];

  const [tactics, setTactics] = useState(() => {
    return Array.isArray(battleSettings.tactics) && battleSettings.tactics.length > 0
      ? battleSettings.tactics.map((t, idx) => ({ ...t, priority: idx + 1 }))
      : defaultTactics;
  });

  if (!isOpen) return null;

  const availableSpecialSkills = battleSkills.filter(
    (s) => s.skillId !== 'SKILL_NORMAL_ATTACK' && s.skillId !== 'NORMAL_ATTACK'
  );

  const handleMoveUp = (index) => {
    if (index <= 0) return;
    const next = [...tactics];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setTactics(next.map((t, idx) => ({ ...t, priority: idx + 1 })));
  };

  const handleMoveDown = (index) => {
    if (index >= tactics.length - 1) return;
    const next = [...tactics];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setTactics(next.map((t, idx) => ({ ...t, priority: idx + 1 })));
  };

  const handleDelete = (index) => {
    const next = tactics.filter((_, idx) => idx !== index);
    setTactics(next.map((t, idx) => ({ ...t, priority: idx + 1 })));
  };

  const handleAdd = () => {
    const defaultSkill = availableSpecialSkills[0]?.skillId || 'SKILL_MINDS_EYE';
    const newTactic = {
      priority: tactics.length + 1,
      skillId: defaultSkill,
      condition: 'ALWAYS',
      targetStatusId: '',
    };
    setTactics([...tactics, newTactic]);
  };

  const handleUpdate = (index, field, value) => {
    const next = [...tactics];
    next[index] = { ...next[index], [field]: value };
    if (field === 'condition' && value === 'ALWAYS') {
      next[index].targetStatusId = '';
    }
    setTactics(next);
  };

  const handleSaveAndClose = async () => {
    await updateBattleSettings({ tactics });
    onClose();
  };

  const handleReset = () => {
    setTactics(defaultTactics);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#38bdf8' }}>
              ⚙️ {isEn ? 'Auto Battle Tactics Configuration' : '自動戰鬥戰術策略配置'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              {isEn
                ? 'Skills are evaluated sequentially by priority. If no condition is met, Normal Attack is used.'
                : '由上至下依優先度評估，條件滿足且未在冷卻時施放；皆不滿足時使用普通攻擊。'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Tactics List */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tactics.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>
              {isEn ? 'No tactics configured. Normal Attack will be used every turn.' : '尚未配置任何戰術策略，戰鬥時將一律使用普通攻擊。'}
            </div>
          ) : (
            tactics.map((t, idx) => {
              const showStatusSelect = t.condition && t.condition !== 'ALWAYS';

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8' }}>
                      #{idx + 1} {isEn ? 'Priority' : '優先順序'}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveUp(idx)}
                        style={{
                          background: '#334155',
                          color: idx === 0 ? '#64748b' : '#f8fafc',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === tactics.length - 1}
                        onClick={() => handleMoveDown(idx)}
                        style={{
                          background: '#334155',
                          color: idx === tactics.length - 1 ? '#64748b' : '#f8fafc',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          cursor: idx === tactics.length - 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        style={{
                          background: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: showStatusSelect ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                    {/* Skill Selector */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {isEn ? 'Skill' : '施放招式'}
                      </label>
                      <select
                        value={t.skillId}
                        onChange={(e) => handleUpdate(idx, 'skillId', e.target.value)}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          color: '#f8fafc',
                          border: '1px solid #475569',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '0.85rem',
                        }}
                      >
                        {availableSpecialSkills.map((s) => (
                          <option key={s.skillId} value={s.skillId}>
                            {isEn ? s.nameEn || s.name : s.name} (CD: {s.coolDown || 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Condition Selector */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {isEn ? 'Condition' : '施放條件'}
                      </label>
                      <select
                        value={t.condition || 'ALWAYS'}
                        onChange={(e) => handleUpdate(idx, 'condition', e.target.value)}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          color: '#f8fafc',
                          border: '1px solid #475569',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '0.85rem',
                        }}
                      >
                        {Object.values(TACTIC_CONDITIONS).map((cond) => (
                          <option key={cond.id} value={cond.id}>
                            {isEn ? cond.labelEn : cond.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target Status Selector */}
                    {showStatusSelect && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                          {isEn ? 'Status' : '指定狀態'}
                        </label>
                        <select
                          value={t.targetStatusId || ''}
                          onChange={(e) => handleUpdate(idx, 'targetStatusId', e.target.value)}
                          style={{
                            width: '100%',
                            background: '#1e293b',
                            color: '#f8fafc',
                            border: '1px solid #475569',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '0.85rem',
                          }}
                        >
                          <option value="">{isEn ? '-- Select Status --' : '-- 選擇狀態 --'}</option>
                          {statusEffects.map((eff) => (
                            <option key={eff.statusId} value={eff.statusId}>
                              {isEn ? eff.nameEn || eff.name : eff.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={handleAdd}
            style={{
              padding: '8px 12px',
              background: '#334155',
              color: '#38bdf8',
              border: '1px dashed #475569',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            + {isEn ? 'Add Tactic Rule' : '新增戰術規則'}
          </button>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f172a',
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {isEn ? 'Reset Default' : '重設為預設'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#475569',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {isEn ? 'Cancel' : '取消'}
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 16px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {isEn ? 'Save Tactics' : '儲存戰術'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
