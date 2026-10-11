
/**
 * 數量增減調節選擇器元件（支援 +1/-1、+10/-10 與手動輸入數值）。
 * @param {Object} props - 元件屬性。
 * @param {number|string} [props.value=1] - 目前數值。
 * @param {(val: number|string) => void} props.onChange - 數值變更回呼函式。
 * @param {number} [props.min=1] - 最小值限制。
 * @param {number} [props.max=Infinity] - 最大值限制。
 * @param {number} [props.stepSmall=1] - 小步進增減量。
 * @param {number} [props.stepLarge=10] - 大步進增減量。
 * @param {boolean} [props.disabled=false] - 是否禁用。
 * @param {string} [props.className=''] - 額外 CSS 類別名。
 * @returns {JSX.Element}
 */
export const QuantitySelector = ({
  value = 1,
  onChange,
  min = 1,
  max = Infinity,
  stepSmall = 1,
  stepLarge = 10,
  disabled = false,
  className = '',
}) => {
  /**
   * 限制數值在 [min, max] 區間之內的輔助函式。
   * @param {number|string} val - 輸入數值。
   * @returns {number} 限制範圍後的數值。
   */
  const clamp = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = min;
    if (num < min) num = min;
    if (num > max) num = max;
    return num;
  };

  /**
   * 處理按鈕增減調整數值。
   * @param {number} delta - 調整增減量。
   */
  const handleAdjust = (delta) => {
    if (disabled) return;
    const currentNum = parseInt(value, 10);
    const num = isNaN(currentNum) ? min : currentNum;
    const nextVal = clamp(num + delta);
    if (onChange) onChange(nextVal);
  };

  /**
   * 處理手動輸入框內容變更。
   * @param {React.ChangeEvent<HTMLInputElement>} e - 輸入變更事件。
   */
  const handleInputChange = (e) => {
    if (disabled) return;
    const rawVal = e.target.value;
    if (rawVal === '') {
      if (onChange) onChange('');
      return;
    }
    const num = parseInt(rawVal, 10);
    if (!isNaN(num)) {
      if (onChange) onChange(num);
    }
  };

  /**
   * 處理輸入框失焦時的邊界校準。
   */
  const handleBlur = () => {
    if (disabled) return;
    const nextVal = clamp(value);
    if (onChange) onChange(nextVal);
  };

  const numValue = parseInt(value, 10);
  const current = isNaN(numValue) ? min : numValue;

  return (
    <div className={`quantity-selector-container ${className}`}>
      <button
        type="button"
        className="btn-qty-step step-large"
        onClick={() => handleAdjust(-stepLarge)}
        disabled={disabled || (current - stepLarge) < min}
        title={`-${stepLarge}`}
      >
        -{stepLarge}
      </button>
      <button
        type="button"
        className="btn-qty-step step-small"
        onClick={() => handleAdjust(-stepSmall)}
        disabled={disabled || (current - stepSmall) < min}
        title={`-${stepSmall}`}
      >
        -{stepSmall}
      </button>
      <input
        type="number"
        className="input-qty-number"
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        min={min}
        max={max !== Infinity ? max : undefined}
        disabled={disabled}
      />
      <button
        type="button"
        className="btn-qty-step step-small"
        onClick={() => handleAdjust(stepSmall)}
        disabled={disabled || (current + stepSmall) > max}
        title={`+${stepSmall}`}
      >
        +{stepSmall}
      </button>
      <button
        type="button"
        className="btn-qty-step step-large"
        onClick={() => handleAdjust(stepLarge)}
        disabled={disabled || (current + stepLarge) > max}
        title={`+${stepLarge}`}
      >
        +{stepLarge}
      </button>
    </div>
  );
};
