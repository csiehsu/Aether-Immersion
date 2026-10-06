import React, { useState } from 'react';
import { useGameStore, translations } from '../store/useGameStore';
import { GoogleLoginButton } from './GoogleLoginButton';

export const TopHUD = () => {
  const player = useGameStore((state) => state.player);
  const user = useGameStore((state) => state.user);
  const language = useGameStore((state) => state.language);
  const setLanguage = useGameStore((state) => state.setLanguage);
  const mongoStatus = useGameStore((state) => state.mongoStatus);
  const viewMode = useGameStore((state) => state.viewMode);
  const setViewMode = useGameStore((state) => state.setViewMode);
  const t = translations[language] || translations['zh-TW'];

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerDetailsOpen, setPlayerDetailsOpen] = useState(false);

  const maxHp = player?.stats?.maxHp ?? player?.maxHp ?? 100;
  const hpPercent = player ? Math.min(100, Math.max(0, (player.hp / maxHp) * 100)) : 0;
  const energyPercent = player ? Math.min(100, Math.max(0, (player.energy / player.maxEnergy) * 100)) : 0;

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
                  <span className="player-details-name">{playerNameText}</span>
                  <span className="player-details-level">LV.{player?.level ?? 1}</span>
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
                    <span className="stat-value">{player?.stats?.dexerity ?? player?.dex ?? 1}</span>
                  </div>
                  <div className="stat-card def">
                    <span className="stat-icon">🛡️</span>
                    <span className="stat-label">{t.defLabel || '防禦'}</span>
                    <span className="stat-value">{player?.stats?.defense ?? 0}</span>
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
      </div>

      <div className="hud-right-bars">
        <div className="status-bar-group energy-group">
          <div className="status-bar-info">
            <span className="bar-label">{t.energy}</span>
            <span className="bar-val">{player?.energy ?? 0} / {player?.maxEnergy ?? 4320}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill energy-fill" style={{ width: `${energyPercent}%` }}></div>
          </div>
        </div>
      </div>
    </header>
  );
};
