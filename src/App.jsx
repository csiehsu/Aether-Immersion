import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { LoginView } from './views/LoginView';
import { CharacterCreationView } from './views/CharacterCreationView';
import { GameInterface } from './components/GameInterface';
import { DisconnectedView } from './views/DisconnectedView';
import './App.css';

/**
 * 應用程式根元件。
 * 負責根據狀態（離線、登入、創角、遊戲主要畫面）分發渲染頂層視圖。
 * @returns {JSX.Element}
 */
function App() {
  const screenMode = useGameStore((state) => state.screenMode);
  const mongoStatus = useGameStore((state) => state.mongoStatus);
  const isDisconnected = useGameStore((state) => state.isDisconnected);
  const syncFromMongo = useGameStore((state) => state.syncFromMongo);

  useEffect(() => {
    // Initial sync check with database on app load
    syncFromMongo();
  }, [syncFromMongo]);

  if (mongoStatus === 'offline' || isDisconnected) {
    return (
      <div className="app-container">
        <DisconnectedView />
      </div>
    );
  }

  return (
    <div className="app-container">
      {screenMode === 'login' && <LoginView />}
      {screenMode === 'character_creation' && <CharacterCreationView />}
      {screenMode === 'game' && <GameInterface />}
    </div>
  );
}

export default App;
