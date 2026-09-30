import React, { useState, useRef, useEffect } from 'react';
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

  const settingsRef = useRef(null);
  const playerDetailsRef = useRef(null);

  const hpPercent = Math.min(100, Math.max(0, (player.hp / player.maxHp) * 100));
  const energyPercent = Math.min(100, Math.max(0, (player.energy / player.maxEnergy) * 100));

  const playerNameText = player.name || (user?.isLoggedIn ? user.name : language === 'en' ? 'Adventurer' : '冒險者');

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
      if (playerDetailsRef.current && !playerDetailsRef.current.contains(event.target)) {
        setPlayerDetailsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="top-hud-bar">
      <div className="hud-left">
        {/* Avatar & Collapsible Player Details Popover */}
        <div className="avatar-wrapper" ref={playerDetailsRef}>
          <div
            className="avatar-frame clickable"
            onClick={() => {
              setPlayerDetailsOpen(!playerDetailsOpen);
              if (!playerDetailsOpen) setSettingsOpen(false);
            }}
            title="點擊檢視角色詳情"
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
                  <span className="player-details-level">LV.{player.level}</span>
                </div>
                <button
                  type="button"
                  className="btn-close-settings"
                  onClick={() => setPlayerDetailsOpen(false)}
                >
                  ✖
                </button>
              </div>

              <div className="player-details-body">
                {/* HP Bar */}
                <div className="status-bar-group hp-group details-hp">
                  <div className="status-bar-info">
                    <span className="bar-label">{t.hp}</span>
                    <span className="bar-val">{player.hp} / {player.maxHp}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill hp-fill" style={{ width: `${hpPercent}%` }}></div>
                  </div>
                </div>

                {/* Attributes Grid (Str, Spd, Dex) */}
                <div className="player-details-stats-grid">
                  <div className="stat-card str">
                    <span className="stat-icon">💪</span>
                    <span className="stat-label">{t.strLabel || '力量'}</span>
                    <span className="stat-value">{player.str ?? 1}</span>
                  </div>
                  <div className="stat-card spd">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-label">{t.spdLabel || '速度'}</span>
                    <span className="stat-value">{player.spd ?? 1}</span>
                  </div>
                  <div className="stat-card dex">
                    <span className="stat-icon">🎯</span>
                    <span className="stat-label">{t.dexLabel || '精巧'}</span>
                    <span className="stat-value">{player.dex ?? 1}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gear Button & System Settings Menu */}
        <div className="gear-wrapper" ref={settingsRef}>
          <button
            type="button"
            className="btn-hud-gear standalone"
            onClick={() => {
              setSettingsOpen(!settingsOpen);
              if (!settingsOpen) setPlayerDetailsOpen(false);
            }}
            title={t.settingsTitle || '系統設定'}
          >
            ⚙️
          </button>

          {settingsOpen && (
            <div className="settings-dropdown-menu">
              <div className="settings-menu-header">
                <span className="settings-menu-title">{t.settingsTitle}</span>
                <button type="button" className="btn-close-settings" onClick={() => setSettingsOpen(false)}>
                  ✖
                </button>
              </div>

              <div className="settings-menu-body">
                {/* MongoDB Status Badge */}
                <div className="menu-setting-item">
                  <span className="menu-item-label">資料庫狀態:</span>
                  <span className={`mongo-badge status-${mongoStatus}`}>
                    {mongoStatus === 'connected' ? t.mongoConnected : t.mongoOffline}
                  </span>
                </div>

                {/* Google Sign-In Component */}
                <div className="menu-setting-item">
                  <span className="menu-item-label">帳號連動:</span>
                  <GoogleLoginButton />
                </div>

                {/* Language Switcher */}
                <div className="menu-setting-item">
                  <span className="menu-item-label">語言設定:</span>
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

                {/* View Mode Toggles */}
                <div className="menu-setting-item vertical">
                  <span className="menu-item-label">{t.viewModeLabel}:</span>
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

      {/* Energy Bar Only in Right HUD */}
      <div className="hud-right-bars">
        <div className="status-bar-group energy-group">
          <div className="status-bar-info">
            <span className="bar-label">{t.energy}</span>
            <span className="bar-val">{player.energy} / {player.maxEnergy}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill energy-fill" style={{ width: `${energyPercent}%` }}></div>
          </div>
        </div>
      </div>
    </header>
  );
};
