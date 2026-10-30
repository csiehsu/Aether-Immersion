import { useState, useEffect } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedText } from '../../utils/language';

/**
 * 根據日誌的 createdAt (UTC 時間戳) 格式化為玩家裝置本機時區之時間字串 (HH:mm:ss)。
 * 若無 createdAt 則 fallback 至 log.time 或空字串。
 * @param {{ createdAt?: string | Date, time?: string }} log
 * @returns {string}
 */
const formatLogTime = (log) => {
  if (log?.createdAt) {
    const d = new Date(log.createdAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }
  }
  return log?.time || '';
};

/**
 * 遊戲訊息與對話紀錄面板元件。
 * 支援依類型篩選（全部、對話、系統、事件）與自訂玩家對話文字發送功能。
 * 對話與事件僅在該地點可見，系統訊息為玩家私人不分地點。
 * @returns {JSX.Element}
 */
export const LogPanel = () => {
  const logs = useGameStore((state) => state.logs);
  const addLog = useGameStore((state) => state.addLog);
  const fetchLogs = useGameStore((state) => state.fetchLogs);
  const player = useGameStore((state) => state.player || {});
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [isOpen, setIsOpen] = useState(true);
  const [filter, setFilter] = useState('all');
  const [inputText, setInputText] = useState('');

  // 面板展開時每 10 秒自動重新整理同步一次最新日誌訊息
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      if (fetchLogs) {
        fetchLogs();
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [isOpen, fetchLogs]);

  const currentLocationId = player?.location || 'AZURE_BAY_PORT';
  const currentPlayerId = player?._id || player?.googleId || player?.name || '';

  const filteredLogs = logs.filter((log) => {
    // 1. 地點過濾：若為對話 (dialogue) 或事件 (event)，只有在該地點才能查看
    if (log.type === 'dialogue' || log.type === 'event') {
      if (log.locationId && log.locationId !== currentLocationId) {
        return false;
      }
    }

    // 2. 私人過濾：若為系統訊息 (system)，僅有觸發該訊息的玩家才能看見
    if (log.type === 'system') {
      if (log.targetPlayerId && currentPlayerId && log.targetPlayerId !== currentPlayerId) {
        return false;
      }
    }

    // 3. 類型頁籤篩選
    if (filter === 'all') return true;
    return log.type === filter;
  });

  /**
   * 處理發送玩家自訂對話訊息。
   * @param {React.FormEvent<HTMLFormElement>} e - 表單提交事件。
   */
  const handleSendDialogue = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const playerName = player?.name || (language === 'en' ? 'Adventurer' : '冒險者');
    addLog(playerName, playerName, inputText.trim(), inputText.trim(), 'dialogue', currentLocationId);
    setInputText('');
  };

  return (
    <CollapsiblePanel
      title={t.logTitle}
      className="log-panel"
      isOpen={isOpen}
      onToggle={setIsOpen}
      headerExtra={
        <button
          type="button"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '2px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
          }}
          onClick={async (e) => {
            e.stopPropagation();
            if (fetchLogs) {
              await fetchLogs();
            }
          }}
          aria-label={t.refresh || '重新整理'}
        >
          <span>🔄</span>
          <span>{t.refresh || '重新整理'}</span>
        </button>
      }
    >
      <div className="log-filters">
        <button
          type="button"
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t.filterAll}
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'dialogue' ? 'active' : ''}`}
          onClick={() => setFilter('dialogue')}
        >
          {t.filterDialogue}
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'system' ? 'active' : ''}`}
          onClick={() => setFilter('system')}
        >
          {t.filterSystem}
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'event' ? 'active' : ''}`}
          onClick={() => setFilter('event')}
        >
          {t.filterEvent}
        </button>
      </div>

      <div className="log-scroll-area">
        {filteredLogs.map((log) => {
          const senderText = getLocalizedText(log.sender, log.senderEn, language);
          const logText = getLocalizedText(log.text, log.textEn, language);
          // 僅對話 (dialogue) 顯示發話者姓名；系統訊息與事件訊息不顯示發話者
          const showSender = log.type === 'dialogue';
          const timeStr = formatLogTime(log);

          return (
            <div key={log.id || log._id} className={`log-row type-${log.type}`}>
              {timeStr && <span className="log-time">[{timeStr}]</span>}
              {showSender && <span className="log-sender">{senderText}:</span>}
              <span className="log-text">{logText}</span>
            </div>
          );
        })}
      </div>

      <form className="dialogue-input-bar" onSubmit={handleSendDialogue}>
        <input
          type="text"
          className="dialogue-input"
          placeholder={t.inputPlaceholder}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button type="submit" className="btn-send-dialogue">
          {t.sendBtn}
        </button>
      </form>
    </CollapsiblePanel>
  );
};
