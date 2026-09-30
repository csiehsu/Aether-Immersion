import React, { useState } from 'react';
import portBg from '../assets/images/background/Port.png';
import { useGameStore, translations } from '../store/useGameStore';

export const CharacterCreationView = () => {
  const language = useGameStore((state) => state.language);
  const createCharacter = useGameStore((state) => state.createCharacter);

  // Requirement #1: 角色名稱留空，不要有預設文字
  const [charName, setCharName] = useState('');

  // Requirement #5: 所有能力值預設值從 10 改為 1
  const [str, setStr] = useState(1);
  const [spd, setSpd] = useState(1);
  const [dex, setDex] = useState(1);

  const TOTAL_POINTS = 30;
  const currentSum = str + spd + dex;
  const remainingPoints = TOTAL_POINTS - currentSum;

  const [errorMsg, setErrorMsg] = useState('');

  const handleStatChange = (stat, delta) => {
    setErrorMsg('');
    if (stat === 'str') {
      const next = str + delta;
      if (next < 1) return;
      if (delta > 0 && remainingPoints <= 0) return;
      setStr(next);
    } else if (stat === 'spd') {
      const next = spd + delta;
      if (next < 1) return;
      if (delta > 0 && remainingPoints <= 0) return;
      setSpd(next);
    } else if (stat === 'dex') {
      const next = dex + delta;
      if (next < 1) return;
      if (delta > 0 && remainingPoints <= 0) return;
      setDex(next);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!charName.trim()) {
      setErrorMsg(language === 'en' ? 'Please enter a character name!' : '請輸入角色名稱！');
      return;
    }

    if (str < 1 || spd < 1 || dex < 1) {
      setErrorMsg(language === 'en' ? 'Minimum value for each attribute is 1!' : '每項能力值最低必須為 1！');
      return;
    }

    if (currentSum !== TOTAL_POINTS) {
      setErrorMsg(
        language === 'en'
          ? `Total attribute points must sum exactly to ${TOTAL_POINTS}! (Current: ${currentSum})`
          : `能力值總計必須精確等於 ${TOTAL_POINTS}！(目前加總: ${currentSum})`
      );
      return;
    }

    const success = await createCharacter(charName.trim(), str, spd, dex);
    if (!success) {
      setErrorMsg(language === 'en' ? 'Failed to create character. Please try again.' : '建立角色失敗，請重試！');
    }
  };

  return (
    <div className="char-creation-container">
      {/* Background image */}
      <div className="login-bg-layer">
        <img src={portBg} alt="Port Background" className="login-bg-img" />
        <div className="login-bg-overlay"></div>
      </div>

      {/* Creation Card */}
      <div className="char-creation-card">
        <div className="char-header">
          <h2 className="char-title">{language === 'en' ? 'Create Character' : '創立角色'}</h2>
          <p className="char-subtitle">
            {language === 'en'
              ? 'Enter character name and allocate 30 attribute points (Min 1 per stat).'
              : '請輸入角色名稱，並分配 30 點初始能力值（每項最低值為 1）。'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="char-form">
          {/* Character Name Input */}
          <div className="form-group">
            <label className="form-label">{language === 'en' ? 'Character Name' : '角色名稱'}</label>
            <input
              type="text"
              className="char-name-input"
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
              placeholder={language === 'en' ? 'Enter character name...' : '請輸入角色名稱...'}
              maxLength={20}
              required
            />
          </div>

          {/* Remaining Points Display */}
          <div className="points-counter-box">
            <span className="points-label">{language === 'en' ? 'Remaining Points:' : '剩餘可分配點數:'}</span>
            <span className={`points-val ${remainingPoints === 0 ? 'valid' : 'invalid'}`}>
              {remainingPoints} / {TOTAL_POINTS}
            </span>
          </div>

          {/* Stat Allocation Controls */}
          <div className="stats-allocation-grid">
            {/* Requirement #2: 力量的說明: 影響物理攻擊力、勞力型工作速度 */}
            <div className="stat-control-row">
              <div className="stat-info">
                <span className="stat-icon">💪</span>
                <div className="stat-text">
                  <span className="stat-name">{language === 'en' ? 'Strength' : '力量'}</span>
                  <span className="stat-desc">
                    {language === 'en' ? 'Affects physical attack power and labor work speed' : '影響物理攻擊力、勞力型工作速度'}
                  </span>
                </div>
              </div>
              <div className="stepper-wrap">
                <button type="button" className="btn-step" onClick={() => handleStatChange('str', -1)} disabled={str <= 1}>
                  -
                </button>
                <span className="stat-value">{str}</span>
                <button type="button" className="btn-step" onClick={() => handleStatChange('str', 1)} disabled={remainingPoints <= 0}>
                  +
                </button>
              </div>
            </div>

            {/* Requirement #3: 速度的說明: 影響戰鬥的行動順序、移動速度 */}
            <div className="stat-control-row">
              <div className="stat-info">
                <span className="stat-icon">⚡</span>
                <div className="stat-text">
                  <span className="stat-name">{language === 'en' ? 'Speed' : '速度'}</span>
                  <span className="stat-desc">
                    {language === 'en' ? 'Affects combat turn order and movement speed' : '影響戰鬥的行動順序、移動速度'}
                  </span>
                </div>
              </div>
              <div className="stepper-wrap">
                <button type="button" className="btn-step" onClick={() => handleStatChange('spd', -1)} disabled={spd <= 1}>
                  -
                </button>
                <span className="stat-value">{spd}</span>
                <button type="button" className="btn-step" onClick={() => handleStatChange('spd', 1)} disabled={remainingPoints <= 0}>
                  +
                </button>
              </div>
            </div>

            {/* Requirement #4: 精巧的說明: 影響間接戰鬥行為（如陷阱等）成功率、技術型工作速度 */}
            <div className="stat-control-row">
              <div className="stat-info">
                <span className="stat-icon">🎯</span>
                <div className="stat-text">
                  <span className="stat-name">{language === 'en' ? 'Dexterity' : '精巧'}</span>
                  <span className="stat-desc">
                    {language === 'en'
                      ? 'Affects indirect combat actions (traps, etc.) success rate and technical work speed'
                      : '影響間接戰鬥行為（如陷阱等）成功率、技術型工作速度'}
                  </span>
                </div>
              </div>
              <div className="stepper-wrap">
                <button type="button" className="btn-step" onClick={() => handleStatChange('dex', -1)} disabled={dex <= 1}>
                  -
                </button>
                <span className="stat-value">{dex}</span>
                <button type="button" className="btn-step" onClick={() => handleStatChange('dex', 1)} disabled={remainingPoints <= 0}>
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Validation Error Message */}
          {errorMsg && <div className="char-error-alert">{errorMsg}</div>}

          {/* Requirement #6: 送出按鈕文字改為簡單的開始 */}
          <button
            type="submit"
            className="btn-create-submit"
            disabled={remainingPoints !== 0 || !charName.trim() || str < 1 || spd < 1 || dex < 1}
          >
            {language === 'en' ? 'Start' : '開始'}
          </button>
        </form>
      </div>
    </div>
  );
};
