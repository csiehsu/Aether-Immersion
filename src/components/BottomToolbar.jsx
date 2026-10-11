import { useGameStore } from '../store/useGameStore';

const toolbarItems = [
  { id: 'move', label: '移動', icon: '🧭' },
  { id: 'craft', label: '製作', icon: '🔨' },
  { id: 'gather', label: '區域資源', icon: '🌿' },
  { id: 'location_items', label: '現場物品', icon: '📍' },
  { id: 'inventory', label: '背包', icon: '🎒' },
  { id: 'log', label: '對話紀錄', icon: '📜' },
];

/**
 * 行動版底部導覽工具列元件。
 * @param {Object} props - 元件屬性。
 * @param {(itemId: string) => void} props.onItemClick - 點擊功能項目時的回呼函式。
 * @param {boolean} props.isOverlayOpen - 浮層面板目前是否開啟。
 * @returns {JSX.Element}
 */
export const BottomToolbar = ({ onItemClick, isOverlayOpen }) => {
  const activeTab = useGameStore((state) => state.activeTab);

  /**
   * 處理工具列按鈕點擊事件。
   * @param {string} itemId - 項目識別碼。
   */
  const handleClick = (itemId) => {
    if (onItemClick) {
      onItemClick(itemId);
    }
  };

  return (
    <nav className="bottom-toolbar">
      {toolbarItems.map((item) => {
        const isActive = activeTab === item.id && isOverlayOpen;
        return (
          <button
            key={item.id}
            type="button"
            className={`toolbar-btn ${isActive ? 'active' : ''}`}
            onClick={() => handleClick(item.id)}
            title={item.label}
          >
            <span className="icon-symbol">{item.icon}</span>
          </button>
        );
      })}
    </nav>
  );
};
