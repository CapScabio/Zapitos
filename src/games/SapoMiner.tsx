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
  isFlagged: boolean;
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

// Multiplicadores progresivos para 5 serpientes en 25 casillas (20 lombrices seguras máximo)
const MINER_MULTIPLIERS = [
  1.0, 1.15, 1.35, 1.60, 1.90, 2.30, 2.80, 3.45, 4.30, 5.40, 
  6.85, 8.80, 11.50, 15.30, 20.80, 29.00, 41.50, 61.50, 95.00, 155.00, 
  270.00
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
  const [isFlagMode, setIsFlagMode] = useState<boolean>(false);
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
    setIsFlagMode(false);
    setGameState('playing');
    setIsPlaying(true);

    // Generar exactamente 1 serpiente por fila (5 en total)
    const indices: number[] = [];
    for (let r = 0; r < 5; r++) {
      const randomCol = Math.floor(Math.random() * 5);
      indices.push(r * 5 + randomCol);
    }
    setSnakeIndices(indices);

    // Inicializar cuadrícula 5x5
    const initialGrid: TileState[] = Array.from({ length: 25 }, (_, i) => ({
      index: i,
      isRevealed: false,
      type: null,
      isFlagged: false,
    }));
    setGrid(initialGrid);
    playSound('reveal');
  };

  const checkWinCondition = (currentGrid: TileState[], currentCount: number) => {
    // Condición de victoria:
    // 1. Haber revelado las 20 lombrices (currentCount === 20)
    // 2. Las 5 serpientes están marcadas correctamente, y ninguna bandera errónea.
    const correctFlags = snakeIndices.every(idx => currentGrid[idx].isFlagged);
    const totalFlags = currentGrid.filter(tile => tile.isFlagged).length;

    if (currentCount === 20 && correctFlags && totalFlags === 5) {
      const mult = MINER_MULTIPLIERS[20];
      const finalPayout = Math.floor(entryFee * mult);
      setActivePool(finalPayout);
      setGameState('cashout');
      setIsPlaying(false);
      onBalanceChange(finalPayout);
      updateBackendBalance(finalPayout);
      playSound('win');
      alert(`🏆 ¡PANTANO COMPLETADO! Marcaste las 5 culebras correctamente y desenterraste las 20 lombrices. ¡Ganaste ${finalPayout} Sats!`);
      setActivePool(0);
    }
  };

  const handleTileClick = (index: number) => {
    if (gameState !== 'playing' || grid[index].isRevealed) return;

    const nextGrid = [...grid];

    if (isFlagMode) {
      // Toggle flag
      nextGrid[index].isFlagged = !nextGrid[index].isFlagged;
      setGrid(nextGrid);
      playSound('reveal');
      checkWinCondition(nextGrid, revealedCount);
      return;
    }

    if (nextGrid[index].isFlagged) {
      // Evitar excavar celdas marcadas para prevenir errores
      return;
    }

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
      checkWinCondition(nextGrid, nextCount);
    }
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || activePool <= 0) return;

    onBalanceChange(activePool);
    await updateBackendBalance(activePool);
    playSound('cashout');
    alert(`💰 ¡Cobraste! Desenterraste ${revealedCount} lombrices y ganaste ${activePool} sats.`);
    
    // Revelar el resto del tablero
    const nextGrid = [...grid];
    nextGrid.forEach((tile) => {
      tile.isRevealed = true;
      tile.type = snakeIndices.includes(tile.index) ? 'snake' : 'worm';
    });
    setGrid(nextGrid);

    setGameState('cashout');
    setIsPlaying(false);
  };

  const flaggedCount = grid.filter(tile => tile.isFlagged).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>💣 SAPO MINER</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Grilla de 5x5. ¡Hay exactamente 1 culebra (🐍) por fila!
          Para ganar, desentierra las 20 lombrices (🪱) y marca las 5 culebras (🚩).
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

          {isPlaying && (
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                onClick={() => setIsFlagMode(false)}
                className={`pixel-btn ${!isFlagMode ? 'orange' : ''}`}
                style={{ flex: 1, justifyContent: 'center', padding: '8px 0', fontSize: '0.55rem' }}
              >
                ⛏️ EXCAVAR
              </button>
              <button
                onClick={() => setIsFlagMode(true)}
                className={`pixel-btn ${isFlagMode ? 'orange' : ''}`}
                style={{ flex: 1, justifyContent: 'center', padding: '8px 0', fontSize: '0.55rem' }}
              >
                🚩 MARCAR
              </button>
            </div>
          )}

          <div style={{ padding: '8px', background: 'var(--bg-swamp)', border: '2px dashed var(--bg-card-hover)', borderRadius: '4px', textAlign: 'center' }}>
            <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
              Pozo Acumulado:
            </div>
            <div className="retro-title" style={{ fontSize: '1.4rem', color: 'var(--accent-orange)', margin: '4px 0' }}>
              {activePool} SATS
            </div>
            {isPlaying && (
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--primary-neon)' }}>
                Multiplicador: {MINER_MULTIPLIERS[Math.min(revealedCount, MINER_MULTIPLIERS.length - 1)].toFixed(2)}x
                <br/>
                🪱 {revealedCount}/20 | 🚩 {flaggedCount}/5
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
              🎮 JUGAR ({entryFee} sats)
            </button>
          ) : (
            <button
              onClick={handleCashOut}
              className="pixel-btn teal"
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
                  disabled={gameState !== 'playing' || (tile.isRevealed && !isFlagMode)}
                  style={{
                    aspectRatio: '1',
                    background: tile.isRevealed 
                      ? (tile.type === 'snake' ? 'rgba(255, 0, 0, 0.25)' : 'rgba(57, 255, 20, 0.15)')
                      : (tile.isFlagged ? 'rgba(247, 147, 26, 0.15)' : 'var(--bg-swamp)'),
                    border: tile.isRevealed
                      ? (tile.type === 'snake' ? '2px solid var(--text-error)' : '2px solid var(--primary-neon)')
                      : (tile.isFlagged ? '2px solid var(--accent-orange)' : '2px solid var(--bg-card-hover)'),
                    borderRadius: '4px',
                    cursor: (gameState === 'playing') ? 'pointer' : 'default',
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
                  {!tile.isRevealed && tile.isFlagged && '🚩'}
                  {!tile.isRevealed && !tile.isFlagged && ''}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ width: '300px', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{ fontSize: '3rem' }}>🪱 ⛏️ 🐸</div>
              <div className="retro-text" style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textAlign: 'center', lineHeight: '1.6' }}>
                ¡El lodo guarda tesoros! Excavá con cuidado y marca las serpientes.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
