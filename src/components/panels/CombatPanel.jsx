import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { TacticsModal } from './TacticsModal';
import { COMBAT_TURN_TIMEOUT } from '../../constants/gameConstants';
import { getAvailableBattleSkills } from '../../utils/gameHelpers';

/**
 * 即時回合制戰鬥專屬操作面板元件 (Turn-Based Combat Panel)。
 * 提供 30 秒手動決策倒數、技能按鈕出招、狀態效果圖示、自動戰鬥戰術開關與逃跑功能。
 * @returns {JSX.Element|null}
 */
export const CombatPanel = () => {
  const combatState = useGameStore((state) => state.combatState);
  const player = useGameStore((state) => state.player || {});
  const battleSkills = useGameStore((state) => state.battleSkills || []);
  const chooseCombatSkill = useGameStore((state) => state.chooseCombatSkill);
  const toggleAutoBattle = useGameStore((state) => state.toggleAutoBattle);
  const fleeBattle = useGameStore((state) => state.fleeBattle);
  const getEquippedWeaponItem = useGameStore((state) => state.getEquippedWeaponItem);
  const language = useGameStore((state) => state.language);

  const [isTacticsOpen, setIsTacticsOpen] = useState(false);

  if (!combatState || !combatState.isBattling) return null;

  const isEn = language === 'en';
  const participants = combatState.participants || {};
  const combatPlayer = participants.player || {
    name: player.name || '冒險者',
    nameEn: player.name || 'Player',
    hp: player.hp || 100,
    maxHp: player.stats?.maxHp || player.maxHp || 100,
    statuses: [],
    cooldowns: {},
  };
  const combatEnemy = participants.enemy || {
    name: '敵方生物',
    nameEn: 'Enemy',
    hp: 50,
    maxHp: 50,
    statuses: [],
    cooldowns: {},
  };

  const isPlayerTurn = combatState.currentTurn === 'player';
  const isAuto = Boolean(combatState.isAutoBattle);
  const timeLeft = combatState.turnTimeRemaining ?? COMBAT_TURN_TIMEOUT;
  const isResolving = Boolean(combatState.isResolvingAction);

  // 玩家可用技能庫（依當前裝備武器類型與對應戰鬥技能熟練度動態計算）
  const equippedWeapon = getEquippedWeaponItem ? getEquippedWeaponItem() : null;
  const combatSkills = player.combatSkills || {};
  const availableSkills = getAvailableBattleSkills(battleSkills, equippedWeapon, combatSkills);

  const playerHpPercent = Math.max(0, Math.min(100, Math.round((combatPlayer.hp / (combatPlayer.maxHp || 1)) * 100)));
  const enemyHpPercent = Math.max(0, Math.min(100, Math.round((combatEnemy.hp / (combatEnemy.maxHp || 1)) * 100)));

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '16px',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* 頂部標題與狀態資訊 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>⚔️</span>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#e2e8f0' }}>
            {isEn ? 'Turn-Based Combat' : '即時回合制戰鬥'} (R{combatState.turnCount || 1})
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: isAuto ? '#065f46' : '#1e3a8a',
              color: isAuto ? '#34d399' : '#93c5fd',
              fontWeight: 500,
            }}
          >
            {isAuto ? (isEn ? '⚡ Auto' : '⚡ 自動') : (isEn ? '🎮 Manual' : '🎮 手動')}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={toggleAutoBattle}
            style={{
              background: isAuto ? '#047857' : '#334155',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isAuto ? (isEn ? 'Switch Manual' : '切換手動') : (isEn ? 'Switch Auto' : '切換自動')}
          </button>
          <button
            type="button"
            onClick={() => setIsTacticsOpen(true)}
            style={{
              background: '#334155',
              color: '#38bdf8',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            ⚙️ {isEn ? 'Tactics' : '戰術'}
          </button>
          <button
            type="button"
            disabled={combatState.isResolvingAction}
            onClick={fleeBattle}
            style={{
              background: '#991b1b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              cursor: combatState.isResolvingAction ? 'not-allowed' : 'pointer',
              opacity: combatState.isResolvingAction ? 0.6 : 1,
              fontWeight: 500,
            }}
          >
            🏃 {isEn ? 'Flee' : '逃跑'}
          </button>
        </div>
      </div>

      {/* 雙方參戰者生命值卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* 我方玩家 */}
        <div
          style={{
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '12px',
            border: isPlayerTurn ? '2px solid #38bdf8' : '1px solid #334155',
            boxShadow: isPlayerTurn ? '0 0 10px rgba(56, 189, 248, 0.25)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
              👤 {isEn ? combatPlayer.nameEn || combatPlayer.name : combatPlayer.name}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              HP: {combatPlayer.hp}/{combatPlayer.maxHp}
            </span>
          </div>

          {/* 血條 */}
          <div style={{ height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${playerHpPercent}%`,
                backgroundColor: playerHpPercent > 50 ? '#10b981' : playerHpPercent > 20 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* 狀態效果徽章 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '22px' }}>
            {(combatPlayer.statuses || []).length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{isEn ? 'No status' : '無異常狀態'}</span>
            ) : (
              (combatPlayer.statuses || []).map((s, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: s.canAct === false ? '#7f1d1d' : '#065f46',
                    color: s.canAct === false ? '#fca5a5' : '#6ee7b7',
                    fontWeight: 500,
                  }}
                >
                  {isEn ? s.nameEn || s.name : s.name} ({s.remainingTurns}T)
                </span>
              ))
            )}
          </div>
        </div>

        {/* 敵方生物 */}
        <div
          style={{
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '12px',
            border: !isPlayerTurn ? '2px solid #f43f5e' : '1px solid #334155',
            boxShadow: !isPlayerTurn ? '0 0 10px rgba(244, 63, 94, 0.25)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
              👾 {isEn ? combatEnemy.nameEn || combatEnemy.name : combatEnemy.name}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              HP: {combatEnemy.hp}/{combatEnemy.maxHp}
            </span>
          </div>

          {/* 血條 */}
          <div style={{ height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${enemyHpPercent}%`,
                backgroundColor: enemyHpPercent > 50 ? '#10b981' : enemyHpPercent > 20 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* 敵方狀態徽章 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '22px' }}>
            {(combatEnemy.statuses || []).length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{isEn ? 'No status' : '無異常狀態'}</span>
            ) : (
              (combatEnemy.statuses || []).map((s, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: s.canAct === false ? '#7f1d1d' : '#065f46',
                    color: s.canAct === false ? '#fca5a5' : '#6ee7b7',
                    fontWeight: 500,
                  }}
                >
                  {isEn ? s.nameEn || s.name : s.name} ({s.remainingTurns}T)
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 30 秒思考倒數區 (手動模式) */}
      {!isAuto && isPlayerTurn && (
        <div
          style={{
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: timeLeft <= 10 ? '#f43f5e' : '#38bdf8', fontWeight: 600 }}>
              ⏳ {isEn ? 'Decision Time' : '決策思考倒數'}: {timeLeft}s
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {isEn ? 'Will auto-use Normal Attack on timeout' : '時間歸零將自動施放普通攻擊'}
            </span>
          </div>

          {/* 倒數計時進度條 */}
          <div style={{ height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(timeLeft / COMBAT_TURN_TIMEOUT) * 100}%`,
                backgroundColor: timeLeft <= 10 ? '#ef4444' : '#0284c7',
                transition: 'width 0.9s linear',
              }}
            />
          </div>
        </div>
      )}

      {/* 回合狀態提示 */}
      <div style={{ textAlign: 'center', fontSize: '0.85rem', color: isPlayerTurn ? '#38bdf8' : '#f59e0b', fontWeight: 500 }}>
        {isResolving
          ? (isEn ? 'Resolving action...' : '結算行動中...')
          : isPlayerTurn
          ? (isAuto
              ? (isEn ? 'Auto Battle: Deciding tactic action...' : '自動戰鬥中：依戰術排程出招中...')
              : (isEn ? 'Your Turn: Select a skill to strike!' : '輪到您的回合：請點選下方技能出招！'))
          : (isEn ? 'Enemy Turn: Enemy is preparing action...' : '敵方回合：敵方正在準備行動...')}
      </div>

      {/* 技能選擇按鈕列 */}
      <div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 500 }}>
          {isEn ? 'Combat Skills' : '可用戰鬥技能'}:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
          {availableSkills.map((skill) => {
            const cd = combatPlayer.cooldowns?.[skill.skillId] || 0;
            const isOnCd = cd > 0;
            const disabled = !isPlayerTurn || isResolving || isOnCd;

            return (
              <button
                key={skill.skillId}
                type="button"
                disabled={disabled}
                onClick={() => chooseCombatSkill(skill.skillId)}
                style={{
                  backgroundColor: isOnCd ? '#334155' : disabled ? '#1e293b' : '#0284c7',
                  color: isOnCd ? '#94a3b8' : disabled ? '#64748b' : '#ffffff',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {isEn ? skill.nameEn || skill.name : skill.name}
                </span>

                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  {isOnCd
                    ? (isEn ? `CD: ${cd}T` : `冷卻: ${cd}回合`)
                    : skill.damageFormula === '0'
                    ? (isEn ? 'Buff' : '自身增益')
                    : skill.hitCount > 1
                    ? (isEn ? `${skill.hitCount}-Hits` : `${skill.hitCount}連擊`)
                    : (isEn ? 'Attack' : '攻擊')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 自訂戰術設定彈窗 */}
      <TacticsModal isOpen={isTacticsOpen} onClose={() => setIsTacticsOpen(false)} />
    </div>
  );
};
