import { useState, useEffect } from 'react';
import { useGameStore, translations } from '../store/useGameStore';
import {
  isPlayerComatose,
  getStatusEffects,
  getRequiredExpForNextLevel,
  calculateCurrentWeight,
  calculateMaxWeight,
  isPlayerOverburdened,
  roundExp,
  SKILL_EXP_THRESHOLDS,
  MAX_SKILL_LEVEL,
  getDurabilityColor,
  getWeightColor,
} from '../utils/gameHelpers';
import { GoogleLoginButton } from './GoogleLoginButton';
import { MAX_WATER, MAX_FOOD, ENERGY_RECOVERY_INTERVAL_MS } from '../constants/gameConstants';

/**
 * 頂部抬頭顯示器 (Top HUD) 元件。
 * 顯示玩家頭像、詳細能力下拉視窗（個人資料頁面：金錢/負重/屬性/技能）、設定選單、常駐精力條/血條/水分條/飽食條。
 * @returns {JSX.Element}
 */
export const TopHUD = () => {
  const player = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory || []);
  const items = useGameStore((state) => state.items || []);
  const user = useGameStore((state) => state.user);
  const language = useGameStore((state) => state.language);
  const setLanguage = useGameStore((state) => state.setLanguage);
  const viewMode = useGameStore((state) => state.viewMode);
  const setViewMode = useGameStore((state) => state.setViewMode);
  const settleEnergyRecovery = useGameStore((state) => state.settleEnergyRecovery);
  const settleInventoryDecay = useGameStore((state) => state.settleInventoryDecay);
  const settleGroundItemsDecay = useGameStore((state) => state.settleGroundItemsDecay);
  const t = translations[language] || translations['zh-TW'];

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerDetailsOpen, setPlayerDetailsOpen] = useState(false);
  const [statusInfoOpen, setStatusInfoOpen] = useState(false);

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
  const waterVal = player?.stats?.water ?? MAX_WATER;
  const foodVal = player?.stats?.food ?? MAX_FOOD;
  const waterPercent = Math.min(100, Math.max(0, (waterVal / MAX_WATER) * 100));
  const foodPercent = Math.min(100, Math.max(0, (foodVal / MAX_FOOD) * 100));

  const statusEffects = player ? getStatusEffects(player) : [];
  const primaryStatus = statusEffects[0] || null;

  const getStatusLabel = (eff) => {
    if (!eff) return '';
    if (eff.id === 'WELL_FED') return t.statusWellFed || '充沛飽足';
    if (eff.id === 'LIGHT_FED') return t.statusLightFed || '輕度飽足';
    if (eff.id === 'NORMAL') return t.statusNormal || '普通';
    if (eff.id === 'FAMISHED_DEHYDRATED') return t.statusFamishedDehydrated || '飢渴虛弱';
    return language === 'en' ? eff.nameEn : eff.name;
  };

  const [secondsLeft, setSecondsLeft] = useState(0);

  const lastEnergyRecoveredAt = player?.lastEnergyRecoveredAt;

  useEffect(() => {
    if (!lastEnergyRecoveredAt || isFullEnergy) return;

    const updateCountdown = () => {
      const now = Date.now();
      const lastTime = new Date(lastEnergyRecoveredAt).getTime();
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
  }, [lastEnergyRecoveredAt, isFullEnergy, settleEnergyRecovery]);

  useEffect(() => {
    if (!player?._id && !player?.name) return;
    const updateDecay = () => {
      if (settleInventoryDecay) settleInventoryDecay();
      if (settleGroundItemsDecay) settleGroundItemsDecay();
    };
    updateDecay();
    const interval = setInterval(updateDecay, 10000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateDecay();
        if (settleEnergyRecovery) settleEnergyRecovery();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [player?._id, player?.name, settleInventoryDecay, settleGroundItemsDecay, settleEnergyRecovery]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.avatar-wrapper')) {
        setPlayerDetailsOpen(false);
      }
      if (!e.target.closest('.gear-wrapper')) {
        setSettingsOpen(false);
      }
      if (!e.target.closest('.status-badge-wrapper') && !e.target.closest('.satiety-status-dropdown-menu')) {
        setStatusInfoOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

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
              if (nextState) {
                setSettingsOpen(false);
                setStatusInfoOpen(false);
              }
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
                      >
                        {getStatusLabel(primaryStatus)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="player-details-money" title={`${language === 'en' ? 'Money' : '金錢'}: ${player?.money ?? 0}`}>
                  <span>💰</span>
                  <span>{player?.money ?? 0}</span>
                </div>
              </div>

              <div className="player-details-body" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="status-bar-group details-weight">
                  <div className="status-bar-info">
                    <span className="bar-label">{language === 'en' ? 'Weight' : '負重'}</span>
                    <span className="bar-val" style={{ color: isOverburdened ? '#ef4444' : undefined, fontWeight: isOverburdened ? 700 : undefined }}>
                      {currentWeight} / {maxWeight} kg {isOverburdened ? `(${language === 'en' ? 'Overburdened' : '超重'})` : ''}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${weightPercent}%`,
                        background: getWeightColor(weightPercent, isOverburdened),
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                    {language === 'en' ? 'Attributes' : '屬性'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t.strLabel || (language === 'en' ? 'Strength' : '力量')}{language === 'en' ? ': ' : '：'}</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{player?.stats?.strength ?? player?.str ?? 1}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t.spdLabel || (language === 'en' ? 'Speed' : '速度')}{language === 'en' ? ': ' : '：'}</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{player?.stats?.speed ?? player?.spd ?? 1}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t.dexLabel || (language === 'en' ? 'Dexterity' : '精巧')}{language === 'en' ? ': ' : '：'}</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{player?.stats?.dexterity ?? player?.dex ?? 1}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t.defLabel || (language === 'en' ? 'Defense' : '防禦')}{language === 'en' ? ': ' : '：'}</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{player?.stats?.defense ?? 0}</span>
                    </div>
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
                      const skillData = player?.lifeSkills?.[s.key] || { level: 0, exp: 0 };
                      const currentLevel = skillData.level ?? 0;
                      const isMax = currentLevel >= MAX_SKILL_LEVEL;
                      const reqExp = getRequiredExpForNextLevel(currentLevel);
                      const prevExp = SKILL_EXP_THRESHOLDS[currentLevel] || 0;
                      const percent = isMax
                        ? 100
                        : Math.min(100, Math.max(0, ((skillData.exp - prevExp) / (reqExp - prevExp)) * 100));
                      const skillName = language === 'en' ? s.nameEn : s.nameZh;

                      return (
                        <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                              {s.icon} {skillName} <strong style={{ color: '#38bdf8' }}>LV.{currentLevel}{isMax ? ' (MAX)' : ''}</strong>
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                              {isMax ? roundExp(skillData.exp) : `${roundExp(skillData.exp)} / ${reqExp}`}
                            </span>
                          </div>
                          {!isMax && (
                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: '#38bdf8', transition: 'width 0.3s ease' }}></div>
                            </div>
                          )}
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
              if (nextState) {
                setPlayerDetailsOpen(false);
                setStatusInfoOpen(false);
              }
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

        <div className="status-badge-wrapper">
          {primaryStatus && (
            <button
              type="button"
              className={`hud-status-badge status-${primaryStatus.id.toLowerCase()}`}
              onClick={(e) => {
                e.stopPropagation();
                const nextState = !statusInfoOpen;
                setStatusInfoOpen(nextState);
                if (nextState) {
                  setPlayerDetailsOpen(false);
                  setSettingsOpen(false);
                }
              }}
            >
              {getStatusLabel(primaryStatus)}
            </button>
          )}
        </div>
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

        <div className="status-bar-group hp-group" title={`${t.hp}: ${player?.hp ?? 0} / ${maxHp}`}>
          <div className="status-bar-info">
            <span className="bar-label">{t.hp}</span>
            <span className="bar-val">{player?.hp ?? 0} / {maxHp}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${hpPercent}%`,
                background: getDurabilityColor(hpPercent),
              }}
            />
          </div>
        </div>

        <div className="status-bar-group water-group" title={`${t.waterLabel || (language === 'en' ? 'Water' : '水分')}: ${waterVal} / ${MAX_WATER}`}>
          <div className="status-bar-info">
            <span className="bar-label">{t.waterLabel || (language === 'en' ? 'Water' : '水分')}</span>
            <span className="bar-val">{waterVal} / {MAX_WATER}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${waterPercent}%`,
                background: getDurabilityColor(waterPercent),
              }}
            />
          </div>
        </div>

        <div className="status-bar-group food-group" title={`${t.foodLabel || (language === 'en' ? 'Food' : '飽食')}: ${foodVal} / ${MAX_FOOD}`}>
          <div className="status-bar-info">
            <span className="bar-label">{t.foodLabel || (language === 'en' ? 'Food' : '飽食')}</span>
            <span className="bar-val">{foodVal} / {MAX_FOOD}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${foodPercent}%`,
                background: getDurabilityColor(foodPercent),
              }}
            />
          </div>
        </div>
      </div>

      {statusInfoOpen && (
        <div
          className="satiety-status-dropdown-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="satiety-status-title">
            {t.satietyStatusTitle || (language === 'en' ? 'Satiety Status Details' : '飽食狀態說明')}
          </div>
          <div className="satiety-status-list">
            {[
              {
                id: 'WELL_FED',
                name: t.statusWellFed || (language === 'en' ? 'Well Fed' : '充沛飽足'),
                condition: language === 'en' ? 'Food & Water >= 80' : '飽食與水分皆達 80 以上',
                effect: language === 'en' ? 'Action energy cost -10%, restore 1 HP for every 10 energy spent' : '行動精力消耗 -10%，每消耗 10 點精力恢復 1 HP',
              },
              {
                id: 'LIGHT_FED',
                name: t.statusLightFed || (language === 'en' ? 'Light Fed' : '輕度飽足'),
                condition: language === 'en' ? 'Food & Water >= 60' : '飽食與水分皆達 60 以上',
                effect: language === 'en' ? 'Action energy cost -10%' : '行動精力消耗 -10%',
              },
              {
                id: 'NORMAL',
                name: t.statusNormal || (language === 'en' ? 'Normal' : '普通'),
                condition: language === 'en' ? 'Normal Levels' : '正常數值區間',
                effect: language === 'en' ? 'Normal energy cost (100%)' : '行動精力正常消耗 (100%)',
              },
              {
                id: 'FAMISHED_DEHYDRATED',
                name: t.statusFamishedDehydrated || (language === 'en' ? 'Famished & Dehydrated' : '飢渴虛弱'),
                condition: language === 'en' ? 'Food or Water < 30' : '飽食度或水分低於 30',
                effect: language === 'en' ? 'Action energy cost +20%' : '行動精力消耗 +20%',
              },
            ].map((item) => {
              const isActive = primaryStatus?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`satiety-status-item ${isActive ? 'active' : ''}`}
                >
                  <div className="satiety-status-header">
                    <span className={`satiety-status-name status-${item.id.toLowerCase()}`}>
                      {item.name}
                    </span>
                    {isActive && (
                      <span className="satiety-status-active-badge">
                        {t.currentStatusTag || (language === 'en' ? 'Current' : '目前狀態')}
                      </span>
                    )}
                  </div>
                  <div className="satiety-status-condition">
                    {item.condition}
                  </div>
                  <div className="satiety-status-effect">
                    {item.effect}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
