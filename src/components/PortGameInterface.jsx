import React, { useState, useEffect, useRef } from 'react';
import portBg from '../assets/images/background/Port.png';
import { useGameStore } from '../store/useGameStore';
import { getLocalizedName, getLocalizedDesc } from '../utils/language';
import { TopHUD } from './TopHUD';
import { BottomToolbar } from './BottomToolbar';
import { MovePanel } from './panels/MovePanel';
import { CraftPanel } from './panels/CraftPanel';
import { GatherPanel } from './panels/GatherPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { CreaturesPanel } from './panels/CreaturesPanel';
import { LogPanel } from './panels/LogPanel';

export const PortGameInterface = () => {
  const activeTab = useGameStore((state) => state.activeTab);
  const setActiveTab = useGameStore((state) => state.setActiveTab);
  const syncFromMongo = useGameStore((state) => state.syncFromMongo);
  const viewMode = useGameStore((state) => state.viewMode);
  const player = useGameStore((state) => state.player);
  const locations = useGameStore((state) => state.locations || []);

  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(true);
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const locationRef = useRef(null);

  useEffect(() => {
    syncFromMongo();
  }, [syncFromMongo]);

  // Close location popover on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setLocationPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const language = useGameStore((state) => state.language);

  // Match active location from locations collection
  const currentLocation = locations.find(
    (loc) => loc.locationId === player.location || loc.name === player.location
  ) || locations[0] || {
    name: '翠潯灣港口',
    nameEn: 'Azure Bay Port',
    description: '各種船隻進出，水手們的聚集地。',
    descriptionEn: 'Bustling harbor where ships drop anchor and sailors gather.',
    image: '',
  };

  const currentLocationName = getLocalizedName(currentLocation, language);
  const currentLocationDesc = getLocalizedDesc(currentLocation, language);

  // Determine background image (custom location image or default portBg)
  const currentBg =
    currentLocation && currentLocation.image && currentLocation.image.trim() !== ''
      ? currentLocation.image
      : portBg;

  // Handle toolbar icon click toggling open/closed
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
      case 'inventory':
        return <InventoryPanel />;
      case 'creatures':
        return <CreaturesPanel />;
      case 'log':
        return <LogPanel />;
      default:
        return <MovePanel />;
    }
  };

  return (
    <div className={`game-root-wrapper view-mode-${viewMode}`}>
      {/* Main Game Arena */}
      <div className="game-arena-container">
        {/* Left Sidebars for Desktop (3 Panels) */}
        <aside className="desktop-side-column left-column">
          <div className="sidebar-slot"><MovePanel /></div>
          <div className="sidebar-slot"><CraftPanel /></div>
          <div className="sidebar-slot"><GatherPanel /></div>
        </aside>

        {/* Center Game Viewport (Port View) */}
        <main className="center-viewport-column">
          <div className="port-viewport-frame">
            {/* Top HUD */}
            <TopHUD />

            {/* Static Port Background Image Layer */}
            <div className="static-background-layer">
              <img src={currentBg} alt={currentLocationName} className="port-static-img" />
              <div className="port-overlay-gradient"></div>
            </div>

            {/* Mobile Location Info Trigger Button & Popover (Above Left of Bottom Toolbar) */}
            <div className="mobile-location-wrapper" ref={locationRef}>
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
                    <button
                      type="button"
                      className="btn-close-popover"
                      onClick={() => setLocationPopoverOpen(false)}
                    >
                      ✖
                    </button>
                  </div>
                  <p className="location-popover-desc">{currentLocationDesc}</p>
                </div>
              )}
            </div>

            {/* Mobile / Portrait Sub-Page Content Drawer/Overlay */}
            <div className={`mobile-panel-overlay ${mobileOverlayOpen ? 'open' : 'minimized'}`}>
              <div className="mobile-panel-content">
                {renderActiveMobilePanel()}
              </div>
            </div>

            {/* Bottom Toolbar (Visible on Mobile / Portrait view) */}
            <BottomToolbar onItemClick={handleToolbarItemClick} isOverlayOpen={mobileOverlayOpen} />
          </div>
        </main>

        {/* Right Sidebars for Desktop (3 Panels) */}
        <aside className="desktop-side-column right-column">
          <div className="sidebar-slot"><InventoryPanel /></div>
          <div className="sidebar-slot"><CreaturesPanel /></div>
          <div className="sidebar-slot"><LogPanel /></div>
        </aside>
      </div>
    </div>
  );
};
