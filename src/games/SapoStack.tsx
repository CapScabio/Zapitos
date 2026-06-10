import React, { useRef, useEffect, useState } from 'react';

interface SapoStackProps {
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
  npub: string | null;
}

interface StackBlock {
  y: number;
  x: number;
  width: number;
  height: number;
}

const playSound = (type: 'place' | 'perfect' | 'hurt' | 'win' | 'gameover') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'place') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(450, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'perfect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.06);
      osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'hurt') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'win') {
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.08);
      osc.frequency.setValueAtTime(783, now + 0.16);
      osc.frequency.setValueAtTime(1046, now + 0.24);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === 'gameover') {
      const now = ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(100, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start();
      osc.stop(now + 0.5);
    }
  } catch (e) {}
};

const MULTIPLIERS = [1.0, 1.15, 1.35, 1.6, 1.95, 2.4, 3.0, 3.8, 4.8, 6.0, 8.0];

export const SapoStack: React.FC<SapoStackProps> = ({
  balance,
  onBalanceChange,
  isRealMode,
  npub,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [entryFee, setEntryFee] = useState<number>(10);
  const [activePool, setActivePool] = useState<number>(0);
  const [currentRow, setCurrentRow] = useState<number>(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover' | 'win'>('idle');

  // Lógica de juego con refs
  const blocksRef = useRef<StackBlock[]>([]);
  const currentBlockRef = useRef({
    x: 0,
    y: 0,
    width: 140,
    height: 24,
    vx: 3, // Velocidad de oscilación
  });

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
    setCurrentRow(0);
    setGameState('playing');
    setIsPlaying(true);

    // Inicializar bloques: base en el fondo
    const baseWidth = 140;
    blocksRef.current = [
      { x: (340 - baseWidth) / 2, y: 340, width: baseWidth, height: 24 }
    ];

    // Configurar primer bloque móvil
    currentBlockRef.current = {
      x: 0,
      y: 340 - 24,
      width: baseWidth,
      height: 24,
      vx: 3,
    };

    playSound('place');
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || activePool <= 0) return;

    onBalanceChange(activePool);
    await updateBackendBalance(activePool);
    playSound('win');
    alert(`💰 ¡Cobraste! Ganaste ${activePool} sats en el piso ${currentRow}.`);
    setGameState('idle');
    setIsPlaying(false);
    setActivePool(0);
  };

  // Acción de presionar/apilar
  const handlePlaceBlock = () => {
    if (gameState !== 'playing') return;

    const blocks = blocksRef.current;
    const prevBlock = blocks[blocks.length - 1];
    const currentBlock = currentBlockRef.current;

    // Calcular overlap
    const leftBound = Math.max(prevBlock.x, currentBlock.x);
    const rightBound = Math.min(prevBlock.x + prevBlock.width, currentBlock.x + currentBlock.width);
    const overlapWidth = rightBound - leftBound;

    if (overlapWidth <= 0) {
      // Game Over: falló completamente
      setGameState('gameover');
      setIsPlaying(false);
      playSound('gameover');
      return;
    }

    // Comprobar si fue perfecto (muy cercano a la alineación exacta)
    const offset = Math.abs(currentBlock.x - prevBlock.x);
    const isPerfect = offset < 4;

    // Colocar el bloque estabilizado en el stack
    blocks.push({
      x: leftBound,
      y: currentBlock.y,
      width: overlapWidth,
      height: currentBlock.height,
    });

    const nextRow = currentRow + 1;
    setCurrentRow(nextRow);

    // Actualizar pozo según multiplicador
    const currentMult = MULTIPLIERS[Math.min(nextRow, MULTIPLIERS.length - 1)];
    setActivePool(Math.floor(entryFee * currentMult));

    if (isPerfect) {
      playSound('perfect');
    } else {
      playSound('place');
    }

    // Ganar si llega a la cima (Row 10)
    if (nextRow >= 10) {
      setGameState('win');
      setIsPlaying(false);
      // El pozo final es de MULTIPLIERS[10] = 8x
      const finalPool = Math.floor(entryFee * MULTIPLIERS[10]);
      setActivePool(finalPool);
      onBalanceChange(finalPool);
      updateBackendBalance(finalPool);
      playSound('win');
      alert(`🏆 ¡PANTANO CORONADO! Apilaste 10 pisos perfectamente y multiplicaste tu apuesta por 8x. Ganaste ${finalPool} SATS.`);
      setActivePool(0);
      return;
    }

    // Configurar siguiente bloque móvil
    // Desplazar cámara virtual hacia abajo si subimos más de 5 bloques
    const cameraShiftY = nextRow > 4 ? (nextRow - 4) * 24 : 0;
    
    // Incrementar velocidad levemente con la altura
    const baseSpeed = 3.0 + nextRow * 0.45;

    currentBlockRef.current = {
      x: Math.random() < 0.5 ? 0 : 340 - overlapWidth,
      y: 340 - (nextRow + 1) * 24 + cameraShiftY,
      width: overlapWidth,
      height: 24,
      vx: Math.random() < 0.5 ? baseSpeed : -baseSpeed,
    };

    // Ajustar y de los bloques apilados para emular la cámara que sube
    if (nextRow > 4) {
      blocks.forEach((b, idx) => {
        b.y = 244 + (nextRow - idx) * 24;
      });
    }
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      ctx.fillStyle = '#0a1017';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lineas
      ctx.strokeStyle = 'rgba(18, 30, 24, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Dibujar bloques apilados
      ctx.fillStyle = '#14241d';
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      blocksRef.current.forEach((block, idx) => {
        ctx.fillRect(block.x, block.y, block.width, block.height);
        ctx.strokeRect(block.x, block.y, block.width, block.height);

        // Decorar con una ramita o flor si está apilado para dar vibra 8-bit
        if (idx > 0) {
          ctx.fillStyle = '#00f5ff';
          ctx.fillRect(block.x + block.width / 2 - 2, block.y + 4, 4, 4);
        }
      });

      // Actualizar y dibujar bloque oscilante
      const currentBlock = currentBlockRef.current;
      currentBlock.x += currentBlock.vx;

      // Rebotar en bordes
      if (currentBlock.x <= 0) {
        currentBlock.x = 0;
        currentBlock.vx = -currentBlock.vx;
      } else if (currentBlock.x + currentBlock.width >= canvas.width) {
        currentBlock.x = canvas.width - currentBlock.width;
        currentBlock.vx = -currentBlock.vx;
      }

      ctx.fillStyle = 'var(--accent-orange)';
      ctx.strokeStyle = '#fff';
      ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, currentBlock.height);
      ctx.strokeRect(currentBlock.x, currentBlock.y, currentBlock.width, currentBlock.height);

      // Dibujar sapito saltando de alegría en la cima o abajo
      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      const topBlock = blocksRef.current[blocksRef.current.length - 1];
      if (topBlock) {
        ctx.fillText('🐸', topBlock.x + topBlock.width / 2, topBlock.y - 4);
      }

      if (gameState === 'playing') {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, currentRow]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPlaying) {
        e.preventDefault();
        handlePlaceBlock();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentRow]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>🧱 SAPO STACK</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Detén el bloque en movimiento de modo que coincida con el anterior. 
          Cada acierto aumenta el piso. ¡Cobra en caliente antes de errarle y caer!
        </p>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap-reverse' }}>
        {/* Controles */}
        <div className="pixel-card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Apuesta inicial:
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
              Ganancia Estimada:
            </div>
            <div className="retro-title" style={{ fontSize: '1.4rem', color: 'var(--accent-orange)', margin: '4px 0' }}>
              {activePool} SATS
            </div>
            {isPlaying && (
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--primary-neon)' }}>
                Multiplicador: {MULTIPLIERS[Math.min(currentRow, MULTIPLIERS.length - 1)].toFixed(2)}x (Piso {currentRow})
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
              🎮 APILAR ({entryFee} sats)
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handlePlaceBlock}
                className="pixel-btn orange"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                📥 APILAR (ESPACIO)
              </button>
              <button
                onClick={handleCashOut}
                className="pixel-btn teal"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                disabled={currentRow === 0}
              >
                💰 COBRAR SATS
              </button>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="retro-text" style={{ color: 'var(--text-error)', textAlign: 'center', fontSize: '0.55rem', lineHeight: '1.4' }}>
              💀 GAME OVER<br/>
              ¡El bloque cayó al vacío!
            </div>
          )}

          {gameState === 'win' && (
            <div className="retro-text" style={{ color: 'var(--primary-neon)', textAlign: 'center', fontSize: '0.55rem', lineHeight: '1.4' }}>
              🏆 ¡VICTORIA TOTAL!<br/>
              ¡Completaste la cima!
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="pixel-card" style={{ flex: '2 1 300px', display: 'flex', justifyContent: 'center', background: '#000', padding: '0', overflow: 'hidden' }}>
          {isPlaying || gameState === 'gameover' || gameState === 'win' ? (
            <canvas
              ref={canvasRef}
              width={340}
              height={380}
              onClick={handlePlaceBlock}
              style={{ 
                display: 'block', 
                cursor: 'pointer',
                width: '100%',
                maxWidth: '340px',
                height: '380px'
              }}
            />
          ) : (
            <div style={{ width: '340px', height: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-swamp)', padding: '20px' }}>
              <div style={{ fontSize: '3rem' }}>🪵 🧱 🐸</div>
              <div className="retro-text" style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textAlign: 'center', lineHeight: '1.6' }}>
                ¡Construye la torre de nenúfares más alta! Haz clic en la pantalla de juego para detener la plataforma oscilante.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
