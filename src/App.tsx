import { useState, useEffect } from 'react';
import { NostrLogin } from './components/NostrLogin';
import type { NostrProfile } from './components/NostrLogin';
import { WalletPanel } from './components/WalletPanel';
import { Leaderboard } from './components/Leaderboard';
import { Dashboard } from './components/Dashboard';

// Games
import { LuckyAmphoras } from './games/LuckyAmphoras';
import { FlyCatcher } from './games/FlyCatcher';
import { FlyFeast } from './games/FlyFeast';
import { FrogRace } from './games/FrogRace';
import { PondDefense } from './games/PondDefense';
import { SapoRun } from './games/SapoRun';
import { SapoStack } from './games/SapoStack';
import { SapoMiner } from './games/SapoMiner';
import { SwampInvaders } from './games/SwampInvaders';

function App() {
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [isRealMode, setIsRealMode] = useState<boolean>(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);

  // Cargar perfil guardado localmente si existe
  useEffect(() => {
    const savedProfile = localStorage.getItem('zapitos_profile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {
        localStorage.removeItem('zapitos_profile');
      }
    }

    const savedBalance = localStorage.getItem('zapitos_balance');
    if (savedBalance) {
      setBalance(parseInt(savedBalance) || 0);
    }
  }, []);

  const handleLogin = (newProfile: NostrProfile) => {
    setProfile(newProfile);
    localStorage.setItem('zapitos_profile', JSON.stringify(newProfile));
  };

  const handleLogout = () => {
    setProfile(null);
    localStorage.removeItem('zapitos_profile');
    setActiveGame(null);
    setBalance(0);
  };

  const handleToggleMode = (real: boolean) => {
    setIsRealMode(real);
    // Resetear balance temporalmente al cambiar de modo para simular billeteras separadas
    setBalance(0);
  };

  const handleBalanceChange = (amount: number) => {
    setBalance(prev => {
      const next = Math.max(0, prev + amount);
      localStorage.setItem('zapitos_balance', next.toString());
      return next;
    });
  };

  return (
    <div className="crt-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Header Retro */}
      <header className="header-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {activeGame ? (
            <button 
              onClick={() => setActiveGame(null)} 
              className="pixel-btn" 
              style={{ padding: '8px 12px', fontSize: '0.65rem' }}
            >
              ◀ MENU
            </button>
          ) : (
            <span style={{ fontSize: '2rem' }}>🐸</span>
          )}
          <span className="retro-title" style={{ fontSize: '1.2rem', margin: 0, textShadow: '2px 2px 0px #000' }}>
            ZAPITOS
          </span>
        </div>

        {/* Info Rápida de Billetera en Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="retro-text" style={{ color: isRealMode ? 'var(--accent-orange)' : 'var(--accent-teal)', fontSize: '0.55rem' }}>
            {balance} Sats {isRealMode ? '⚡' : '🎮'}
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row', 
        gap: '24px', 
        padding: '24px', 
        maxWidth: '1200px', 
        width: '100%', 
        margin: '0 auto',
        flexWrap: 'wrap' 
      }}>
        
        {/* Columna Izquierda: Dashboard o Juego Activo */}
        <section style={{ flex: '3 1 600px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeGame === null && (
            <Dashboard onSelectGame={(gameId) => setActiveGame(gameId)} />
          )}

          {activeGame === 'lucky_amphoras' && (
            <LuckyAmphoras 
              balance={balance} 
              onBalanceChange={handleBalanceChange} 
              isRealMode={isRealMode}
              npub={profile?.npub || null}
            />
          )}

          {activeGame === 'fly_catcher' && (
            <FlyCatcher 
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
              npub={profile?.npub || null}
            />
          )}

          {activeGame === 'fly_feast' && (
            <FlyFeast 
              profile={profile}
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
            />
          )}

          {activeGame === 'frog_race' && (
            <FrogRace 
              profile={profile}
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
            />
          )}

          {activeGame === 'pond_defense' && (
            <PondDefense 
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
              npub={profile?.npub || null}
            />
          )}

          {activeGame === 'sapo_run' && (
            <SapoRun 
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
              npub={profile?.npub || null}
            />
          )}

          {activeGame === 'sapo_stack' && (
            <SapoStack 
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
              npub={profile?.npub || null}
            />
          )}

          {activeGame === 'sapo_miner' && (
            <SapoMiner 
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
              npub={profile?.npub || null}
            />
          )}

          {activeGame === 'swamp_invaders' && (
            <SwampInvaders 
              balance={balance} 
              onBalanceChange={handleBalanceChange}
              isRealMode={isRealMode}
              npub={profile?.npub || null}
            />
          )}
        </section>

        {/* Columna Derecha: Sidebar (Nostr, Wallet, Leaderboard) */}
        <aside style={{ flex: '1 1 300px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 1. Nostr Account Panel */}
          <NostrLogin 
            currentProfile={profile} 
            onLogin={handleLogin} 
            onLogout={handleLogout} 
          />

          {/* 2. Wallet panel */}
          <WalletPanel 
            npub={profile?.npub || null}
            balance={balance}
            isRealMode={isRealMode}
            onToggleMode={handleToggleMode}
            onBalanceChange={handleBalanceChange}
          />

          {/* 3. Leaderboard */}
          <Leaderboard currentNpub={profile?.npub || null} />

        </aside>

      </main>

      {/* Footer */}
      <footer style={{ borderTop: 'var(--border-pixel)', padding: '16px', background: 'var(--bg-swamp)', textAlign: 'center' }}>
        <p className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>
          🎮 HACKATÓN #04 (GAMING) LA CRYPTA · Creado por el Capitán del Scabio, ¡salud y libertad! 🍻⚡
        </p>
      </footer>

    </div>
  );
}

export default App;
