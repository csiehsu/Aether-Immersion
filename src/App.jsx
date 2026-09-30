import React, { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { LoginView } from './views/LoginView';
import { CharacterCreationView } from './views/CharacterCreationView';
import { PortGameInterface } from './components/PortGameInterface';
import { DisconnectedView } from './views/DisconnectedView';
import './App.css';

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
      {screenMode === 'game' && <PortGameInterface />}
    </div>
  );
}

export default App;
