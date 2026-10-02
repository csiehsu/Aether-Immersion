import React from 'react';
import { useGameStore } from '../store/useGameStore';

export const toolbarItems = [
  { id: 'move', label: '移動', icon: '🧭' },
  { id: 'craft', label: '製作', icon: '🔨' },
  { id: 'gather', label: '區域資源', icon: '🌿' },
  { id: 'inventory', label: '背包', icon: '🎒' },
  { id: 'log', label: '對話紀錄', icon: '📜' },
];

export const BottomToolbar = ({ onItemClick, isOverlayOpen }) => {
  const activeTab = useGameStore((state) => state.activeTab);

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
