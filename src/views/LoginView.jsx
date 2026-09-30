import React from 'react';
import portBg from '../assets/images/background/Port.png';
import { useGameStore, translations } from '../store/useGameStore';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

export const LoginView = () => {
  const language = useGameStore((state) => state.language);
  const setLanguage = useGameStore((state) => state.setLanguage);
  const mongoStatus = useGameStore((state) => state.mongoStatus);
  const t = translations[language] || translations['zh-TW'];

  return (
    <div className="login-screen-container">
      {/* Background static image */}
      <div className="login-bg-layer">
        <img src={portBg} alt="Port Background" className="login-bg-img" />
        <div className="login-bg-overlay"></div>
      </div>

      {/* Glassmorphism Login Card */}
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-game-title">Aether Immersion</h1>
          <p className="login-game-tagline">
            {language === 'en' ? 'Multiplayer Fantasy Adventure Web Game' : '多人奇幻冒險網頁遊戲'}
          </p>
        </div>

        {/* Status Badge */}
        <div className="login-status-row">
          <span className={`mongo-badge status-${mongoStatus}`}>
            {mongoStatus === 'connected' ? t.mongoConnected : t.mongoOffline}
          </span>
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

        <div className="login-action-area">
          <p className="login-prompt-text">
            {language === 'en' ? 'Please sign in to enter the game' : '請先登入以展開冒險之旅'}
          </p>
          <GoogleLoginButton />
        </div>
      </div>
    </div>
  );
};
