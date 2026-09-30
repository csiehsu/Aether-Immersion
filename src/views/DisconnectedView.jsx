import React from 'react';
import { useGameStore } from '../store/useGameStore';

export const DisconnectedView = () => {
  const syncFromMongo = useGameStore((state) => state.syncFromMongo);
  const language = useGameStore((state) => state.language);

  return (
    <div className="login-screen-container">
      <div className="login-card disconnected-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📡</div>
        <h1 style={{ color: '#ef4444', marginBottom: '0.75rem', fontSize: '1.75rem' }}>
          {language === 'en' ? 'Server Disconnected' : '伺服器連線失敗 / 資料庫離線'}
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.75rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
          {language === 'en'
            ? 'Unable to connect to the game server or database. This is an online game, please check your network connection and retry.'
            : '本遊戲為線上遊戲，無法存取遊戲伺服器與資料庫。請確認後端伺服器 (Port 5000) 與 MongoDB Atlas 連線狀況。'}
        </p>

        <button
          type="button"
          className="btn-create-submit"
          style={{ width: 'auto', padding: '0.75rem 2rem', margin: '0 auto' }}
          onClick={() => syncFromMongo()}
        >
          🔄 {language === 'en' ? 'Reconnect' : '重新連線'}
        </button>
      </div>
    </div>
  );
};
