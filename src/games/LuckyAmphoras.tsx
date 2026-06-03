import React, { useState } from 'react';

interface LuckyAmphorasProps {
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
  npub: string | null;
}

// Sonidos retro usando Web Audio API (Sin librerías externas)
const playSound = (type: 'jump' | 'crack' | 'cashout' | 'gameover') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'jump') {
      // Tono ascendente rápido
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'crack') {
      // Ruido blanco descendente para simular rotura / caída
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'cashout') {
      // Arpegio victorioso
      const now = ctx.currentTime;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(400, now + 0.08);
      osc.frequency.setValueAtTime(500, now + 0.16);
      osc.frequency.setValueAtTime(600, now + 0.24);
      
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === 'gameover') {
      // Melodía triste descendente
      const now = ctx.currentTime;
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.15);
      osc.frequency.setValueAtTime(140, now + 0.3);
      osc.frequency.setValueAtTime(100, now + 0.45);
      
      osc.start();
      osc.stop(now + 0.6);
    }
  } catch (e) {
    console.error('AudioContext no soportado:', e);
  }
};

const MULTIPLIERS = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0];

export const LuckyAmphoras: React.FC<LuckyAmphorasProps> = ({
  balance,
  onBalanceChange,
  isRealMode,
  npub,
}) => {
  const [bet, setBet] = useState<number>(10);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<number>(0); // 0 = no empezó, 1 a 10 = filas activas
  const [selections, setSelections] = useState<{ [key: number]: number }>({}); // row -> chosenIndex
  const [rowTraps, setRowTraps] = useState<{ [key: number]: number[] }>({}); // row -> indicesOfTraps
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  // Sincronizar saldo con backend
  const updateBackendBalance = async (amount: number) => {
    if (isRealMode && npub) {
      try {
        await fetch(`${BACKEND_URL}/api/balance/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npub, amount }),
        });
      } catch (err) {
        console.error('Error actualizando balance en servidor:', err);
      }
    }
  };

  const handleStartGame = async () => {
    if (bet <= 0 || bet > balance) {
      alert('Apuesta inválida o saldo insuficiente.');
      return;
    }

    // Descontar la apuesta
    onBalanceChange(-bet);
    await updateBackendBalance(-bet);

    // Inicializar trampas para las 10 filas
    const newTraps: { [key: number]: number[] } = {};
    for (let r = 1; r <= 10; r++) {
      if (r <= 5) {
        // Filas 1-5: 2 seguras, 1 trampa
        const trapIndex = Math.floor(Math.random() * 3);
        newTraps[r] = [trapIndex];
      } else {
        // Filas 6-10: 1 segura, 2 trampas
        const safeIndex = Math.floor(Math.random() * 3);
        newTraps[r] = [0, 1, 2].filter(idx => idx !== safeIndex);
      }
    }

    setRowTraps(newTraps);
    setSelections({});
    setCurrentRow(1);
    setIsPlaying(true);
    setGameState('playing');
    playSound('jump');
  };

  const handleSelectAmphora = async (amphoraIndex: number) => {
    if (gameState !== 'playing') return;

    const traps = rowTraps[currentRow];
    const isTrap = traps.includes(amphoraIndex);

    // Guardar selección
    setSelections(prev => ({ ...prev, [currentRow]: amphoraIndex }));

    if (isTrap) {
      // ¡Es trampa! Sapo cae
      setGameState('lost');
      setIsPlaying(false);
      playSound('crack');
      setTimeout(() => playSound('gameover'), 300);
    } else {
      // ¡Seguro! Avanza
      playSound('jump');
      if (currentRow === 10) {
        // Llegó al final (Meta alcanzada, 2.0x completado)
        setGameState('won');
        setIsPlaying(false);
        const winAmount = Math.floor(bet * MULTIPLIERS[10]);
        onBalanceChange(winAmount);
        await updateBackendBalance(winAmount);
        playSound('cashout');
      } else {
        // Siguiente fila
        setCurrentRow(prev => prev + 1);
      }
    }
  };

  const handleCashOut = async () => {
    if (currentRow <= 1 || gameState !== 'playing') return;

    const currentMultiplier = MULTIPLIERS[currentRow - 1];
    const winAmount = Math.floor(bet * currentMultiplier);

    setGameState('won');
    setIsPlaying(false);
    onBalanceChange(winAmount);
    await updateBackendBalance(winAmount);
    playSound('cashout');

    alert(`💰 ¡Cobraste con éxito! Ganaste ${winAmount} sats (${currentMultiplier}x)`);
  };

  const getAmphoraContent = (rowNum: number, idx: number) => {
    const isSelected = selections[rowNum] === idx;
    const isPassed = rowNum < currentRow;
    const isCurrent = rowNum === currentRow;

    if (isPassed || (gameState !== 'playing' && rowNum <= currentRow)) {
      const isTrap = rowTraps[rowNum]?.includes(idx);
      if (isTrap) {
        return isSelected ? '💥' : '💀'; // Trampa rota / descubierta
      }
      return isSelected ? '🐸' : '🏺'; // Sapo parado / vasija entera
    }

    if (isCurrent && isPlaying) {
      return '❓';
    }

    return '🏺';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🏺 ÁNFORAS DE LA SUERTE</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Sube por las 10 filas. F 1-5: 66% de éxito. F 6-10: 33% de éxito. Max 2x pozo.
        </p>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap-reverse' }}>
        
        {/* Panel de Controles */}
        <div className="pixel-card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Apuesta (sats):
            </label>
            <input
              type="number"
              value={bet}
              onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 0))}
              disabled={isPlaying}
              className="pixel-input"
              style={{ textAlign: 'center' }}
            />
          </div>

          <div style={{ padding: '8px', background: 'var(--bg-swamp)', border: '2px dashed var(--bg-card-hover)', borderRadius: '4px', textAlign: 'center' }}>
            <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
              Multiplicador Actual:
            </div>
            <div className="retro-title" style={{ fontSize: '1.2rem', color: 'var(--primary-neon)', margin: '4px 0' }}>
              {isPlaying && currentRow > 1 ? MULTIPLIERS[currentRow - 1] : '1.0'}x
            </div>
            <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--accent-orange)' }}>
              Ganancia: {isPlaying && currentRow > 1 ? Math.floor(bet * MULTIPLIERS[currentRow - 1]) : 0} sats
            </div>
          </div>

          {!isPlaying ? (
            <button
              onClick={handleStartGame}
              className="pixel-btn orange"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={balance < bet}
            >
              🎮 JUGAR ({bet} sats)
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleCashOut}
                className="pixel-btn teal blink"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                disabled={currentRow <= 1}
              >
                💰 COBRAR SATS
              </button>
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Selecciona una vasija de la fila resaltada para saltar.
              </div>
            </div>
          )}

          {gameState === 'won' && (
            <div className="retro-text" style={{ color: 'var(--primary-neon)', textAlign: 'center', fontSize: '0.65rem' }}>
              🏆 ¡GANASTE!
            </div>
          )}
          {gameState === 'lost' && (
            <div className="retro-text" style={{ color: 'var(--text-error)', textAlign: 'center', fontSize: '0.65rem' }}>
              💥 ¡VASICA ROTA! PERDISTE
            </div>
          )}
        </div>

        {/* Tablero de Juego (10 filas vertical) */}
        <div 
          className="pixel-card" 
          style={{ 
            flex: '2 1 300px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            background: 'var(--bg-swamp)',
            maxHeight: '440px',
            overflowY: 'auto',
            padding: '12px'
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => {
            const rowNum = 10 - i; // Renders row 10 at top, row 1 at bottom
            const isActive = rowNum === currentRow && isPlaying;

            return (
              <div 
                key={rowNum} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: isActive ? 'rgba(57,255,20,0.1)' : 'transparent',
                  border: isActive ? '2px solid var(--primary-neon)' : '2px solid transparent',
                  padding: '4px',
                  borderRadius: '4px'
                }}
              >
                {/* Indicador de Fila y Multiplicador */}
                <div 
                  className="retro-text" 
                  style={{ 
                    width: '75px', 
                    fontSize: '0.5rem', 
                    color: rowNum > 5 ? 'var(--text-error)' : 'var(--text-light)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <span>F{rowNum} {rowNum > 5 ? '🔥' : '🍀'}</span>
                  <span style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>{MULTIPLIERS[rowNum]}x</span>
                </div>

                {/* 3 Vasijas/Ánforas */}
                <div style={{ display: 'flex', flex: 1, gap: '8px', justifyContent: 'space-around' }}>
                  {[0, 1, 2].map((idx) => {
                    const content = getAmphoraContent(rowNum, idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => isActive && handleSelectAmphora(idx)}
                        disabled={!isActive}
                        className="pixel-btn"
                        style={{ 
                          flex: 1, 
                          padding: '4px',
                          fontSize: '1.2rem',
                          justifyContent: 'center',
                          borderWidth: '2px',
                          boxShadow: 'none',
                          transform: 'none',
                          background: isActive ? 'var(--bg-card-hover)' : 'var(--bg-dark)',
                          borderColor: isActive ? 'var(--primary-neon)' : 'var(--bg-card)'
                        }}
                      >
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
