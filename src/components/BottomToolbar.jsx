import { useGameStore } from '../store/useGameStore';
import {
  calculateCurrentWeight,
  calculateMaxWeight,
  isPlayerOverburdened,
  getWeightColor,
} from '../utils/gameHelpers';

const toolbarItems = [
  { id: 'move', label: '移動', labelEn: 'Move', icon: '🧭' },
  { id: 'craft', label: '製作', labelEn: 'Craft', icon: '🔨' },
  { id: 'gather', label: '資源', labelEn: 'Resources', icon: '🌿' },
  { id: 'location_items', label: '物資', labelEn: 'Supplies', icon: '📍' },
  { id: 'inventory', label: '背包', labelEn: 'Bag', icon: '🎒' },
  { id: 'log', label: '紀錄', labelEn: 'Logs', icon: '📜' },
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
  const language = useGameStore((state) => state.language);
  const inventory = useGameStore((state) => state.inventory || []);
  const player = useGameStore((state) => state.player || {});
  const items = useGameStore((state) => state.items || []);

  const currentWeight = calculateCurrentWeight(inventory, items);
  const maxWeight = calculateMaxWeight(player);
  const isOverburdened = isPlayerOverburdened(player, inventory, items);
  const weightPercent = maxWeight > 0 ? Math.min(100, Math.max(0, (currentWeight / maxWeight) * 100)) : 0;

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
        const isInventory = item.id === 'inventory';
        const buttonTitle = isInventory
          ? `${language === 'en' ? item.labelEn : item.label} (${currentWeight} / ${maxWeight} kg)`
          : (language === 'en' ? item.labelEn : item.label);

        return (
          <button
            key={item.id}
            type="button"
            className={`toolbar-btn ${isActive ? 'active' : ''}`}
            onClick={() => handleClick(item.id)}
            title={buttonTitle}
          >
            {isInventory && (
              <span
                className="toolbar-weight-text"
                style={{
                  color: getWeightColor(weightPercent, isOverburdened),
                }}
              >
                {currentWeight}/{maxWeight}
              </span>
            )}
            <span className="icon-symbol">{item.icon}</span>
            {isInventory && (
              <div className="toolbar-weight-bar-bg" aria-hidden="true">
                <div
                  className="toolbar-weight-bar-fill"
                  style={{
                    width: `${weightPercent}%`,
                    background: getWeightColor(weightPercent, isOverburdened),
                  }}
                />
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );
};
