import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getLocalizedName, getLocalizedDesc } from '../utils/language';
import { TopHUD } from './TopHUD';
import { BottomToolbar } from './BottomToolbar';
import { MovePanel } from './panels/MovePanel';
import { CraftPanel } from './panels/CraftPanel';
import { GatherPanel } from './panels/GatherPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { LocationItemsPanel } from './panels/LocationItemsPanel';
import { LogPanel } from './panels/LogPanel';

export const GameInterface = () => {
  const activeTab = useGameStore((state) => state.activeTab);
  const setActiveTab = useGameStore((state) => state.setActiveTab);
  const syncFromMongo = useGameStore((state) => state.syncFromMongo);
  const viewMode = useGameStore((state) => state.viewMode);
  const player = useGameStore((state) => state.player);
  const locations = useGameStore((state) => state.locations || []);

  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(true);
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);

  useEffect(() => {
    syncFromMongo();
  }, [syncFromMongo]);

  const language = useGameStore((state) => state.language);

  const currentLocation = locations.find(
    (loc) => loc.locationId === player?.location
  ) || locations[0] || {
    name: '',
    nameEn: '',
    description: '',
    descriptionEn: '',
    image: '',
  };

  const currentLocationName = getLocalizedName(currentLocation, language);
  const currentLocationDesc = getLocalizedDesc(currentLocation, language);

  const currentBg = currentLocation?.image || '';

  const handleToolbarItemClick = (itemId) => {
    if (activeTab === itemId) {
      setMobileOverlayOpen(!mobileOverlayOpen);
    } else {
      setActiveTab(itemId);
      setMobileOverlayOpen(true);
    }
  };

  const renderActiveMobilePanel = () => {
    switch (activeTab) {
      case 'move':
        return <MovePanel />;
      case 'craft':
        return <CraftPanel />;
      case 'gather':
        return <GatherPanel />;
      case 'location_items':
        return <LocationItemsPanel />;
      case 'inventory':
        return <InventoryPanel />;
      case 'log':
        return <LogPanel />;
      default:
        return <MovePanel />;
    }
  };

  return (
    <div className={`game-root-wrapper view-mode-${viewMode}`}>
      <div className="game-arena-container">
        <aside className="desktop-side-column left-column">
          <div className="sidebar-slot"><MovePanel /></div>
          <div className="sidebar-slot"><CraftPanel /></div>
          <div className="sidebar-slot"><GatherPanel /></div>
        </aside>

        <main className="center-viewport-column">
          <div className="port-viewport-frame">
            <TopHUD />

            <div className="static-background-layer">
              <img src={currentBg} alt={currentLocationName} className="port-static-img" />
            </div>

            <div className="mobile-location-wrapper">
              <button
                type="button"
                className={`btn-mobile-location-trigger ${locationPopoverOpen ? 'active' : ''}`}
                onClick={() => setLocationPopoverOpen(!locationPopoverOpen)}
                title={`檢視地點說明：${currentLocationName}`}
              >
                📍
              </button>

              {locationPopoverOpen && (
                <div className="mobile-location-popover">
                  <div className="location-popover-header">
                    <h3 className="location-popover-title">📍 {currentLocationName}</h3>
                  </div>
                  <p className="location-popover-desc">{currentLocationDesc}</p>
                </div>
              )}
            </div>

            <div className={`mobile-panel-overlay ${mobileOverlayOpen ? 'open' : 'minimized'}`}>
              <div className="mobile-panel-content">
                {renderActiveMobilePanel()}
              </div>
            </div>

            <BottomToolbar onItemClick={handleToolbarItemClick} isOverlayOpen={mobileOverlayOpen} />
          </div>
        </main>

        <aside className="desktop-side-column right-column">
          <div className="sidebar-slot"><LocationItemsPanel /></div>
          <div className="sidebar-slot"><InventoryPanel /></div>
          <div className="sidebar-slot"><LogPanel /></div>
        </aside>
      </div>
    </div>
  );
};
