import { useGameStore } from '../store/useGameStore';

/**
 * 伺服器/資料庫連線中斷提示視圖元件。
 * 當後端離線或資料庫未就緒時顯示，並提供重新連線按鈕。
 * @returns {JSX.Element}
 */
export const DisconnectedView = () => {
  const syncFromMongo = useGameStore((state) => state.syncFromMongo);
  const language = useGameStore((state) => state.language);

  return (
    <div className="login-screen-container">
      <div className="login-card disconnected-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📡</div>
        <h1 style={{ color: '#ef4444', marginBottom: '1.75rem', fontSize: '1.75rem' }}>
          {language === 'en' ? 'Server Disconnected' : '伺服器連線失敗 / 資料庫離線'}
        </h1>

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
