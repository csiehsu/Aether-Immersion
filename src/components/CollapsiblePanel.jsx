import React, { useState } from 'react';

export const CollapsiblePanel = ({
  title,
  children,
  className = '',
  defaultOpen = true,
  headerExtra = null,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`panel-container ${className} ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <div
        className="panel-header clickable-header"
        onClick={() => setIsOpen(!isOpen)}
        title="點擊切換開合"
      >
        <h3 className="panel-title">
          <span>{title}</span>
          <span className="collapse-arrow">{isOpen ? '▼' : '►'}</span>
        </h3>
        {headerExtra}
      </div>
      {isOpen && children}
    </div>
  );
};
