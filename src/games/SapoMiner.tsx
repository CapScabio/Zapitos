import React, { useState } from 'react';

interface SapoMinerProps {
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
  npub: string | null;
}

interface TileState {
  index: number;
  isRevealed: boolean;
  type: 'worm' | 'snake' | null;
}

const playSound = (type: 'reveal' | 'snake' | 'win' | 'cashout') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'reveal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'snake') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'win') {
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.06);
      osc.frequency.setValueAtTime(783, now + 0.12);
      osc.frequency.setValueAtTime(1046, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start();
      osc.stop(now + 0.3);
    } else if (type === 'cashout') {
      const now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(900, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start();
      osc.stop(now + 0.2);
    }
  } catch (e) {}
};

// Multiplicadores progresivos para 3 serpientes en 25 casillas
const MINER_MULTIPLIERS = [
  1.0, 1.12, 1.28, 1.48, 1.72, 2.02, 2.40, 2.88, 3.48, 4.25, 
  5.25, 6.55, 8.30, 10.60, 13.80, 18.25, 24.80, 34.50, 49.50, 74.00, 
  116.00, 195.00, 375.00
];

export const SapoMiner: React.FC<SapoMinerProps> = ({
  balance,
  onBalanceChange,
  isRealMode,
  npub,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [entryFee, setEntryFee] = useState<number>(10);
  const [activePool, setActivePool] = useState<number>(0);
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover' | 'cashout'>('idle');
  const [grid, setGrid] = useState<TileState[]>([]);
  const [snakeIndices, setSnakeIndices] = useState<number[]>([]);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  const updateBackendBalance = async (amount: number) => {
    if (isRealMode && npub) {
      try {
        await fetch(`${BACKEND_URL}/api/balance/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npub, amount }),
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStartGame = async () => {
    if (entryFee <= 0 || balance < entryFee) {
      alert('Saldo insuficiente.');
      return;
    }

    onBalanceChange(-entryFee);
    await updateBackendBalance(-entryFee);
    setActivePool(entryFee);
    setRevealedCount(0);
    setGameState('playing');
    setIsPlaying(true);

    // Generar 3 serpientes en posiciones únicas aleatorias
    const indices: number[] = [];
    while (indices.length < 3) {
      const idx = Math.floor(Math.random() * 25);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    setSnakeIndices(indices);

    // Inicializar cuadrícula 5x5
    const initialGrid: TileState[] = Array.from({ length: 25 }, (_, i) => ({
      index: i,
      isRevealed: false,
      type: null,
    }));
    setGrid(initialGrid);
    playSound('reveal');
  };

  const handleTileClick = (index: number) => {
    if (gameState !== 'playing' || grid[index].isRevealed) return;

    const nextGrid = [...grid];
    const isSnake = snakeIndices.includes(index);

    if (isSnake) {
      // Game Over! Revelar todo
      nextGrid.forEach((tile) => {
        tile.isRevealed = true;
        tile.type = snakeIndices.includes(tile.index) ? 'snake' : 'worm';
      });
      setGrid(nextGrid);
      setGameState('gameover');
      setIsPlaying(false);
      playSound('snake');
    } else {
      // Acertaste lombriz
      nextGrid[index].isRevealed = true;
      nextGrid[index].type = 'worm';
      setGrid(nextGrid);

      const nextCount = revealedCount + 1;
      setRevealedCount(nextCount);

      // Calcular multiplicador
      const mult = MINER_MULTIPLIERS[Math.min(nextCount, MINER_MULTIPLIERS.length - 1)];
      const currentPayout = Math.floor(entryFee * mult);
      setActivePool(currentPayout);

      playSound('reveal');

      // Si encuentra todas las lombrices (22)
      if (nextCount >= 22) {
        setGameState('cashout');
        setIsPlaying(false);
        onBalanceChange(currentPayout);
        updateBackendBalance(currentPayout);
        playSound('win');
        alert(`🏆 ¡PANTANO LIMPIO! Desenterraste todas las lombrices sin tocar ninguna culebra. ¡Ganaste ${currentPayout} Sats!`);
        setActivePool(0);
      }
    }
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || activePool <= 0) return;

    onBalanceChange(activePool);
    await updateBackendBalance(activePool);
    playSound('cashout');
    alert(`💰 ¡Cobraste! Desenterraste ${revealedCount} lombrices y ganaste ${activePool} sats.`);
    
    // Revelar el resto del tablero de forma ilustrativa
    const nextGrid = [...grid];
    nextGrid.forEach((tile) => {
      tile.isRevealed = true;
      tile.type = snakeIndices.includes(tile.index) ? 'snake' : 'worm';
    });
    setGrid(nextGrid);

    setGameState('cashout');
    setIsPlaying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>💣 SAPO MINER</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Excava en el barro de 5x5. Encuentra lombrices (🪱) para subir el multiplicador. 
          ¡Cuidado con las 3 culebras ocultas (🐍)! Cobra cuando gustes.
        </p>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap-reverse' }}>
        {/* Panel lateral */}
        <div className="pixel-card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Apuesta Sats:
            </label>
            <input
              type="number"
              value={entryFee}
              onChange={(e) => setEntryFee(Math.max(1, parseInt(e.target.value) || 0))}
              disabled={isPlaying}
              className="pixel-input"
              style={{ textAlign: 'center' }}
            />
          </div>

          <div style={{ padding: '8px', background: 'var(--bg-swamp)', border: '2px dashed var(--bg-card-hover)', borderRadius: '4px', textAlign: 'center' }}>
            <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
              Pozo Acumulado:
            </div>
            <div className="retro-title" style={{ fontSize: '1.4rem', color: 'var(--accent-orange)', margin: '4px 0' }}>
              {activePool} SATS
            </div>
            {isPlaying && (
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--primary-neon)' }}>
                Multiplicador: {MINER_MULTIPLIERS[Math.min(revealedCount, MINER_MULTIPLIERS.length - 1)].toFixed(2)}x ({revealedCount} 🪱)
              </div>
            )}
          </div>

          {!isPlaying ? (
            <button
              onClick={handleStartGame}
              className="pixel-btn orange"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={balance < entryFee}
            >
              🎮 EXCAVAR ({entryFee} sats)
            </button>
          ) : (
            <button
              onClick={handleCashOut}
              className="pixel-btn teal blink"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={revealedCount === 0}
            >
              💰 COBRAR SATS
            </button>
          )}

          {gameState === 'gameover' && (
            <div className="retro-text" style={{ color: 'var(--text-error)', textAlign: 'center', fontSize: '0.55rem', lineHeight: '1.4' }}>
              💀 GAME OVER<br/>
              ¡Mordido por una culebra!
            </div>
          )}

          {gameState === 'cashout' && (
            <div className="retro-text" style={{ color: 'var(--primary-neon)', textAlign: 'center', fontSize: '0.55rem', lineHeight: '1.4' }}>
              💰 COBRADO<br/>
              ¡Ganancias aseguradas!
            </div>
          )}
        </div>

        {/* Grilla */}
        <div className="pixel-card" style={{ flex: '2 1 300px', display: 'flex', justifyContent: 'center', background: '#000', padding: '12px' }}>
          {grid.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              width: '100%',
              maxWidth: '300px',
              aspectRatio: '1'
            }}>
              {grid.map((tile) => (
                <button
                  key={tile.index}
                  onClick={() => handleTileClick(tile.index)}
                  disabled={gameState !== 'playing' || tile.isRevealed}
                  style={{
                    aspectRatio: '1',
                    background: tile.isRevealed 
                      ? (tile.type === 'snake' ? 'rgba(255, 0, 0, 0.25)' : 'rgba(57, 255, 20, 0.15)')
                      : 'var(--bg-swamp)',
                    border: tile.isRevealed
                      ? (tile.type === 'snake' ? '2px solid var(--text-error)' : '2px solid var(--primary-neon)')
                      : '2px solid var(--bg-card-hover)',
                    borderRadius: '4px',
                    cursor: (gameState === 'playing' && !tile.isRevealed) ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    transition: 'all 0.15s ease'
                  }}
                  className={(!tile.isRevealed && gameState === 'playing') ? 'tile-active' : ''}
                >
                  {tile.isRevealed && tile.type === 'worm' && '🪱'}
                  {tile.isRevealed && tile.type === 'snake' && '🐍'}
                  {!tile.isRevealed && ''}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ width: '300px', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{ fontSize: '3rem' }}>🪱 ⛏️ 🐸</div>
              <div className="retro-text" style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textAlign: 'center', lineHeight: '1.6' }}>
                ¡El lodo guarda tesoros! Excavá con cuidado y escapá de los depredadores.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
