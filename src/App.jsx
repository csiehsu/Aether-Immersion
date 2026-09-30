import React, { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { LoginView } from './views/LoginView';
import { CharacterCreationView } from './views/CharacterCreationView';
import { PortGameInterface } from './components/PortGameInterface';
import './App.css';

function App() {
  const screenMode = useGameStore((state) => state.screenMode);
  const syncFromMongo = useGameStore((state) => state.syncFromMongo);

  useEffect(() => {
    // Initial sync check with database on app load
    syncFromMongo();
  }, [syncFromMongo]);

  return (
    <div className="app-container">
      {screenMode === 'login' && <LoginView />}
      {screenMode === 'character_creation' && <CharacterCreationView />}
      {screenMode === 'game' && <PortGameInterface />}
    </div>
  );
}

export default App;
