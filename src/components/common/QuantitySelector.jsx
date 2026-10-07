import React from 'react';

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
  const clamp = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = min;
    if (num < min) num = min;
    if (num > max) num = max;
    return num;
  };

  const handleAdjust = (delta) => {
    if (disabled) return;
    const currentNum = parseInt(value, 10);
    const num = isNaN(currentNum) ? min : currentNum;
    const nextVal = clamp(num + delta);
    if (onChange) onChange(nextVal);
  };

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
