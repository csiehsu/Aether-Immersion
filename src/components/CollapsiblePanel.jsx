import { useState } from 'react';

/**
 * 可折疊展開的通用面板容器元件。
 * @param {Object} props - 元件屬性。
 * @param {string|React.ReactNode} props.title - 面板標題內容。
 * @param {React.ReactNode} props.children - 面板展開時顯示的子內容。
 * @param {string} [props.className=''] - 額外 CSS 類別名。
 * @param {boolean} [props.defaultOpen=true] - 初始是否預設展開。
 * @param {React.ReactNode} [props.headerExtra=null] - 標頭右側額外擴充元素（如按鈕、標籤等）。
 * @returns {JSX.Element}
 */
export const CollapsiblePanel = ({
  title,
  children,
  className = '',
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
  headerExtra = null,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleHeaderClick = () => {
    const nextOpen = !isOpen;
    if (onToggle) onToggle(nextOpen);
    if (controlledIsOpen === undefined) {
      setInternalOpen(nextOpen);
    }
  };

  return (
    <div className={`panel-container ${className} ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <div
        className="panel-header clickable-header"
        onClick={handleHeaderClick}
        title="切換開合"
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
