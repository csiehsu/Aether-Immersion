import { useState, useEffect } from 'react';
import { useGameStore, translations } from '../store/useGameStore';
import {
  isPlayerComatose,
  getStatusEffects,
  getRequiredExpForNextLevel,
  calculateCurrentWeight,
  calculateMaxWeight,
  isPlayerOverburdened,
} from '../utils/gameHelpers';
import { GoogleLoginButton } from './GoogleLoginButton';
import { MAX_WATER, MAX_FOOD, ENERGY_RECOVERY_INTERVAL_MS } from '../constants/gameConstants';

/**
 * 頂部抬頭顯示器 (Top HUD) 元件。
 * 顯示玩家頭像、詳細能力下拉視窗、設定選單、精力條與當前持有金錢。
 * @returns {JSX.Element}
 */
export const TopHUD = () => {
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory || []);
  const items = useGameStore((state) => state.items || []);
  const user = useGameStore((state) => state.user);
  const language = useGameStore((state) => state.language);
  const setLanguage = useGameStore((state) => state.setLanguage);
  const mongoStatus = useGameStore((state) => state.mongoStatus);
  const viewMode = useGameStore((state) => state.viewMode);
  const setViewMode = useGameStore((state) => state.setViewMode);
  const settleEnergyRecovery = useGameStore((state) => state.settleEnergyRecovery);
  const t = translations[language] || translations['zh-TW'];

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerDetailsOpen, setPlayerDetailsOpen] = useState(false);

  const maxHp = player?.stats?.maxHp ?? player?.maxHp ?? 100;
  const maxEnergy = player?.maxEnergy ?? 4320;
  const hpPercent = player ? Math.min(100, Math.max(0, (player.hp / maxHp) * 100)) : 0;
  const displayEnergy = player?.energy != null ? Math.round(player.energy * 10) / 10 : 0;
  const energyPercent = player ? Math.min(100, Math.max(0, (displayEnergy / maxEnergy) * 100)) : 0;
  const isFullEnergy = displayEnergy >= maxEnergy;
  const isComatose = isPlayerComatose(player);
  const currentWeight = calculateCurrentWeight(inventory, items);
  const maxWeight = calculateMaxWeight(player);
  const isOverburdened = isPlayerOverburdened(player, inventory, items);
  const weightPercent = maxWeight > 0 ? Math.min(100, Math.max(0, (currentWeight / maxWeight) * 100)) : 0;

  const statusEffects = player ? getStatusEffects(player) : [];
  const primaryStatus = statusEffects[0] || null;

  const getStatusLabel = (eff) => {
    if (!eff) return '';
    if (eff.id === 'WELL_FED') return t.statusWellFed || '充沛飽足';
    if (eff.id === 'LIGHT_FED') return t.statusLightFed || '輕度飽足';
    if (eff.id === 'FAMISHED_DEHYDRATED') return t.statusFamishedDehydrated || '飢渴虛弱';
    return language === 'en' ? eff.nameEn : eff.name;
  };

  const getStatusDesc = (eff) => {
    if (!eff) return '';
    if (eff.id === 'WELL_FED') return t.statusWellFedDesc || eff.description;
    if (eff.id === 'LIGHT_FED') return t.statusLightFedDesc || eff.description;
    if (eff.id === 'FAMISHED_DEHYDRATED') return t.statusFamishedDehydratedDesc || eff.description;
    return language === 'en' ? eff.descriptionEn : eff.description;
  };

  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!player || isFullEnergy) return;

    const updateCountdown = () => {
      const now = Date.now();
      const lastTime = player.lastEnergyRecoveredAt
        ? new Date(player.lastEnergyRecoveredAt).getTime()
        : now;
      const elapsed = now - lastTime;
      if (elapsed >= ENERGY_RECOVERY_INTERVAL_MS) {
        settleEnergyRecovery();
      } else {
        const remaining = Math.max(0, Math.ceil((ENERGY_RECOVERY_INTERVAL_MS - elapsed) / 1000));
        setSecondsLeft(remaining);
      }
    };

    const initialTimeout = setTimeout(updateCountdown, 0);
    const interval = setInterval(updateCountdown, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [player, isFullEnergy, settleEnergyRecovery]);

  const formatCountdown = (secs) => {
    if (secs <= 0) return '00:00';
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainderSecs).padStart(2, '0')}`;
  };

  const playerNameText = player?.name || (user?.isLoggedIn ? user.name : t.playerDefaultName);

  return (
    <header className="top-hud-bar">
      <div className="hud-left">
        <div className="avatar-wrapper">
          <div
            className="avatar-frame clickable"
            onClick={() => {
              const nextState = !playerDetailsOpen;
              setPlayerDetailsOpen(nextState);
              if (nextState) setSettingsOpen(false);
            }}
            title="查看角色資料"
          >
            {user?.isLoggedIn && user?.pictureUrl ? (
              <img src={user.pictureUrl} alt={user.name} className="hud-google-avatar" />
            ) : (
              <span className="avatar-icon">👤</span>
            )}
          </div>

          {playerDetailsOpen && (
            <div className="player-details-dropdown-menu">
              <div className="player-details-header">
                <div className="player-avatar-preview">
                  {user?.isLoggedIn && user?.pictureUrl ? (
                    <img src={user.pictureUrl} alt={user.name} className="hud-google-avatar-large" />
                  ) : (
                    <span className="avatar-icon-large">👤</span>
                  )}
                </div>
                <div className="player-basic-info">
                  <span className="player-details-name">
                    {playerNameText}
                    {isComatose && (
                      <span className="player-comatose-tag" style={{ color: '#ef4444', marginLeft: '6px', fontWeight: 'bold' }}>
                        （{t.comatose || '昏迷中'}）
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    <span className="player-details-level">LV.{player?.level ?? 1}</span>
                    {primaryStatus && (
                      <span
                        className={`hud-status-badge mini status-${primaryStatus.id.toLowerCase()}`}
                        title={getStatusDesc(primaryStatus)}
                      >
                        {getStatusLabel(primaryStatus)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="player-details-body">
                <div className="status-bar-group hp-group details-hp">
                  <div className="status-bar-info">
                    <span className="bar-label">{t.hp}</span>
                    <span className="bar-val">{player?.hp ?? 0} / {maxHp}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill hp-fill" style={{ width: `${hpPercent}%` }}></div>
                  </div>
                </div>

                <div className="status-bar-group details-weight" style={{ marginBottom: '8px' }}>
                  <div className="status-bar-info">
                    <span className="bar-label">⚖️ {language === 'en' ? 'Weight' : '負重'}</span>
                    <span className="bar-val" style={{ color: isOverburdened ? '#ef4444' : undefined, fontWeight: isOverburdened ? 700 : undefined }}>
                      {currentWeight} / {maxWeight} kg {isOverburdened ? `(${language === 'en' ? 'Overburdened' : '超重'})` : ''}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${weightPercent}%`,
                        background: isOverburdened ? '#ef4444' : (weightPercent >= 80 ? '#f59e0b' : '#38bdf8'),
                      }}
                    />
                  </div>
                </div>

                <div className="player-details-stats-grid">
                  <div className="stat-card str">
                    <span className="stat-icon">💪</span>
                    <span className="stat-label">{t.strLabel || '力量'}</span>
                    <span className="stat-value">{player?.stats?.strength ?? player?.str ?? 1}</span>
                  </div>
                  <div className="stat-card spd">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-label">{t.spdLabel || '速度'}</span>
                    <span className="stat-value">{player?.stats?.speed ?? player?.spd ?? 1}</span>
                  </div>
                  <div className="stat-card dex">
                    <span className="stat-icon">🎯</span>
                    <span className="stat-label">{t.dexLabel || '精巧'}</span>
                    <span className="stat-value">{player?.stats?.dexterity ?? player?.dex ?? 1}</span>
                  </div>
                  <div className="stat-card def">
                    <span className="stat-icon">🛡️</span>
                    <span className="stat-label">{t.defLabel || '防禦'}</span>
                    <span className="stat-value">{player?.stats?.defense ?? 0}</span>
                  </div>
                  <div className="stat-card water">
                    <span className="stat-icon">💧</span>
                    <span className="stat-label">{t.waterLabel || '水分'}</span>
                    <span className="stat-value">{player?.stats?.water ?? MAX_WATER}</span>
                  </div>
                  <div className="stat-card food">
                    <span className="stat-icon">🍖</span>
                    <span className="stat-label">{t.foodLabel || '飽食'}</span>
                    <span className="stat-value">{player?.stats?.food ?? MAX_FOOD}</span>
                  </div>
                </div>

                <div className="player-details-skills-section" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                    {language === 'en' ? 'Life Skills' : '生活技能'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { key: 'GATHERING', icon: '🌿', nameZh: '採集', nameEn: 'Gathering' },
                      { key: 'FISHING', icon: '🎣', nameZh: '釣魚', nameEn: 'Fishing' },
                      { key: 'MINING', icon: '⛏️', nameZh: '挖礦', nameEn: 'Mining' },
                      { key: 'COOKING', icon: '🍳', nameZh: '料理', nameEn: 'Cooking' },
                    ].map((s) => {
                      const skillData = player?.lifeSkills?.[s.key] || { level: 1, exp: 0 };
                      const reqExp = getRequiredExpForNextLevel(skillData.level);
                      const percent = Math.min(100, Math.max(0, (skillData.exp / reqExp) * 100));
                      const skillName = language === 'en' ? s.nameEn : s.nameZh;

                      return (
                        <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                              {s.icon} {skillName} <strong style={{ color: '#38bdf8' }}>LV.{skillData.level}</strong>
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                              {skillData.exp} / {reqExp}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: '#38bdf8', transition: 'width 0.3s ease' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="gear-wrapper">
          <button
            type="button"
            className="btn-hud-gear standalone"
            onClick={() => {
              const nextState = !settingsOpen;
              setSettingsOpen(nextState);
              if (nextState) setPlayerDetailsOpen(false);
            }}
            title={t.settingsTitle || '系統設定'}
          >
            ⚙️
          </button>

          {settingsOpen && (
            <div className="settings-dropdown-menu">
              <div className="settings-menu-header">
                <span className="settings-menu-title">{t.settingsTitle}</span>
              </div>

              <div className="settings-menu-body">
                <div className="menu-setting-item">
                  <span className="menu-item-label">{t.dbStatusLabel}</span>
                  <span className={`mongo-badge status-${mongoStatus}`}>
                    {mongoStatus === 'connected' ? t.mongoConnected : t.mongoOffline}
                  </span>
                </div>

                <div className="menu-setting-item">
                  <span className="menu-item-label">{t.accountLinkLabel}</span>
                  <GoogleLoginButton />
                </div>

                <div className="menu-setting-item">
                  <span className="menu-item-label">{t.languageLabel}</span>
                  <div className="language-switcher">
                    <button
                      type="button"
                      className={`btn-lang ${language === 'zh-TW' ? 'active' : ''}`}
                      onClick={() => setLanguage('zh-TW')}
                    >
                      繁體中文
                    </button>
                    <button
                      type="button"
                      className={`btn-lang ${language === 'en' ? 'active' : ''}`}
                      onClick={() => setLanguage('en')}
                    >
                      English
                    </button>
                  </div>
                </div>

                <div className="menu-setting-item vertical">
                  <span className="menu-item-label">{t.viewModeLabel}</span>
                  <div className="view-mode-buttons-row">
                    <button
                      type="button"
                      className={`btn-mode-toggle ${viewMode === 'auto' ? 'active' : ''}`}
                      onClick={() => setViewMode('auto')}
                    >
                      🖥️/📱 {t.autoView}
                    </button>
                    <button
                      type="button"
                      className={`btn-mode-toggle ${viewMode === 'desktop' ? 'active' : ''}`}
                      onClick={() => setViewMode('desktop')}
                    >
                      🖥️ {t.desktopView}
                    </button>
                    <button
                      type="button"
                      className={`btn-mode-toggle ${viewMode === 'mobile' ? 'active' : ''}`}
                      onClick={() => setViewMode('mobile')}
                    >
                      📱 {t.mobileView}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {primaryStatus && (
          <div
            className={`hud-status-badge status-${primaryStatus.id.toLowerCase()}`}
            title={getStatusDesc(primaryStatus)}
          >
            {getStatusLabel(primaryStatus)}
          </div>
        )}
      </div>

      <div className="hud-right-bars">
        <div
          className="status-bar-group energy-group"
          title={`${t.energyRecoveryTooltip || '每 15 分鐘恢復 15 點精力'} (${isFullEnergy ? (t.energyFull || '精力已滿') : `${t.nextEnergyRecovery || '下次恢復'}: ${formatCountdown(secondsLeft)}`})`}
        >
          <div className="status-bar-info">
            <span className="bar-label">
              {t.energy}
              {!isFullEnergy && secondsLeft > 0 && (
                <span style={{ fontSize: '0.68rem', color: '#fbbf24', marginLeft: '4px', fontWeight: 'normal' }}>
                  ⏱️{formatCountdown(secondsLeft)}
                </span>
              )}
            </span>
            <span className="bar-val">{displayEnergy} / {maxEnergy}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill energy-fill" style={{ width: `${energyPercent}%` }}></div>
          </div>
        </div>
        <div className="hud-money-row" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.8125rem', fontWeight: 'bold', color: '#fbbf24' }}>
          <span>💰</span>
          <span>{player?.money ?? 0}</span>
        </div>
      </div>
    </header>
  );
};
