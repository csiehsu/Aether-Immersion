import React, { useState } from 'react';
import { useGameStore, translations } from '../../store/useGameStore';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { getLocalizedText } from '../../utils/language';

export const LogPanel = () => {
  const logs = useGameStore((state) => state.logs);
  const addLog = useGameStore((state) => state.addLog);
  const language = useGameStore((state) => state.language);
  const t = translations[language] || translations['zh-TW'];

  const [filter, setFilter] = useState('all');
  const [inputText, setInputText] = useState('');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  const handleSendDialogue = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    addLog('玩家對話', 'Player', inputText.trim(), inputText.trim(), 'dialogue');
    setInputText('');
  };

  return (
    <CollapsiblePanel title={t.logTitle} className="log-panel">
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

          return (
            <div key={log.id} className={`log-row type-${log.type}`}>
              <span className="log-time">[{log.time}]</span>
              <span className="log-sender">{senderText}:</span>
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
