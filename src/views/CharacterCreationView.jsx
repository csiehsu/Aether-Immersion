import React, { useState } from 'react';
import portBg from '../assets/images/background/Port.png';
import { useGameStore, translations } from '../store/useGameStore';

export const CharacterCreationView = () => {
  const language = useGameStore((state) => state.language);
  const createCharacter = useGameStore((state) => state.createCharacter);

  const [charName, setCharName] = useState('');

  const [strength, setStrength] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [dexerity, setDexerity] = useState(1);

  const TOTAL_POINTS = 30;
  const currentSum = strength + speed + dexerity;
  const remainingPoints = TOTAL_POINTS - currentSum;

  const [errorMsg, setErrorMsg] = useState('');

  const handleStatChange = (stat, delta) => {
    setErrorMsg('');
    if (stat === 'strength') {
      const next = strength + delta;
      if (next < 1) return;
      if (delta > 0 && remainingPoints <= 0) return;
      setStrength(next);
    } else if (stat === 'speed') {
      const next = speed + delta;
      if (next < 1) return;
      if (delta > 0 && remainingPoints <= 0) return;
      setSpeed(next);
    } else if (stat === 'dexerity') {
      const next = dexerity + delta;
      if (next < 1) return;
      if (delta > 0 && remainingPoints <= 0) return;
      setDexerity(next);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!charName.trim()) {
      setErrorMsg(language === 'en' ? 'Please enter a character name!' : '請輸入角色名稱！');
      return;
    }

    if (strength < 1 || speed < 1 || dexerity < 1) {
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

    const success = await createCharacter(charName.trim(), strength, speed, dexerity);
    if (!success) {
      setErrorMsg(language === 'en' ? 'Failed to create character. Please try again.' : '建立角色失敗，請重試！');
    }
  };

  return (
    <div className="char-creation-container">
      <div className="login-bg-layer">
        <img src={portBg} alt="Port Background" className="login-bg-img" />
        <div className="login-bg-overlay"></div>
      </div>

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

          <div className="points-counter-box">
            <span className="points-label">{language === 'en' ? 'Remaining Points:' : '剩餘可分配點數:'}</span>
            <span className={`points-val ${remainingPoints === 0 ? 'valid' : 'invalid'}`}>
              {remainingPoints} / {TOTAL_POINTS}
            </span>
          </div>

          <div className="stats-allocation-grid">
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
                <button type="button" className="btn-step" onClick={() => handleStatChange('strength', -1)} disabled={strength <= 1}>
                  -
                </button>
                <span className="stat-value">{strength}</span>
                <button type="button" className="btn-step" onClick={() => handleStatChange('strength', 1)} disabled={remainingPoints <= 0}>
                  +
                </button>
              </div>
            </div>

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
                <button type="button" className="btn-step" onClick={() => handleStatChange('speed', -1)} disabled={speed <= 1}>
                  -
                </button>
                <span className="stat-value">{speed}</span>
                <button type="button" className="btn-step" onClick={() => handleStatChange('speed', 1)} disabled={remainingPoints <= 0}>
                  +
                </button>
              </div>
            </div>

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
                <button type="button" className="btn-step" onClick={() => handleStatChange('dexerity', -1)} disabled={dexerity <= 1}>
                  -
                </button>
                <span className="stat-value">{dexerity}</span>
                <button type="button" className="btn-step" onClick={() => handleStatChange('dexerity', 1)} disabled={remainingPoints <= 0}>
                  +
                </button>
              </div>
            </div>
          </div>

          {errorMsg && <div className="char-error-alert">{errorMsg}</div>}

          <button
            type="submit"
            className="btn-create-submit"
            disabled={remainingPoints !== 0 || !charName.trim() || strength < 1 || speed < 1 || dexerity < 1}
          >
            {language === 'en' ? 'Start' : '開始'}
          </button>
        </form>
      </div>
    </div>
  );
};
