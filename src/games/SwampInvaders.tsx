import React, { useRef, useEffect, useState } from 'react';

interface SwampInvadersProps {
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
  npub: string | null;
}

interface Invader {
  id: number;
  x: number;
  y: number;
  type: 'drone' | 'wasp' | 'boss';
  emoji: string;
  width: number;
  height: number;
  hp: number;
  points: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vy: number;
}

const playSound = (type: 'shoot' | 'hit' | 'kill' | 'hurt' | 'win' | 'gameover') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'shoot') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'hit') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'kill') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'win') {
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.08);
      osc.frequency.setValueAtTime(659, now + 0.16);
      osc.frequency.setValueAtTime(880, now + 0.24);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === 'gameover') {
      const now = ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start();
      osc.stop(now + 0.5);
    }
  } catch (e) {}
};

export const SwampInvaders: React.FC<SwampInvadersProps> = ({
  balance,
  onBalanceChange,
  isRealMode,
  npub,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [entryFee, setEntryFee] = useState<number>(10);
  const [activePool, setActivePool] = useState<number>(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');

  // Lógica de juego con refs
  const frogXRef = useRef<number>(150); // Posición horizontal del sapo
  const bulletsRef = useRef<Bullet[]>([]);
  const invadersRef = useRef<Invader[]>([]);
  
  const invaderDirRef = useRef<number>(1); // 1 = derecha, -1 = izquierda
  const invaderSpeedRef = useRef<number>(0.5); // Reducido de 0.8 a 0.5 para dar más tiempo
  const moveStateRef = useRef<'idle' | 'left' | 'right'>('idle');

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const groundY = 450; // Línea de tierra en canvas de 480 de altura

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
    setGameState('playing');
    setIsPlaying(true);

    frogXRef.current = 155; // Centrado en el canvas de 340
    bulletsRef.current = [];
    invaderDirRef.current = 1;
    invaderSpeedRef.current = 0.5; // Velocidad base más lenta
    
    // Generar cuadrícula inicial de invasores (3 filas x 5 columnas)
    const initialInvaders: Invader[] = [];
    const rows = 3;
    const cols = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = r === 0 ? 'wasp' : 'drone';
        initialInvaders.push({
          id: r * cols + c + Date.now(),
          x: 40 + c * 50,
          y: 60 + r * 35,
          type,
          emoji: type === 'wasp' ? '🐝' : '🤖',
          width: 20,
          height: 20,
          hp: type === 'wasp' ? 2 : 1,
          points: type === 'wasp' ? 4 : 2,
        });
      }
    }
    invadersRef.current = initialInvaders;
    playSound('shoot');
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || activePool <= 0) return;

    onBalanceChange(activePool);
    await updateBackendBalance(activePool);
    playSound('win');
    alert(`💰 ¡Cobraste! Recuperaste ${activePool} sats defendiendo la laguna.`);
    setGameState('idle');
    setIsPlaying(false);
    setActivePool(0);
  };

  const handleShoot = () => {
    if (gameState !== 'playing') return;

    if (activePool <= 0) {
      setGameState('gameover');
      setIsPlaying(false);
      playSound('gameover');
      return;
    }

    // Cada disparo cuesta 1 sat
    setActivePool(prev => {
      const next = prev - 1;
      if (next <= 0) {
        setGameState('gameover');
        setIsPlaying(false);
        playSound('gameover');
      }
      return next;
    });

    // Spawn lengua/bala desde la posición del sapo
    bulletsRef.current.push({
      id: Date.now() + Math.random(),
      x: frogXRef.current + 15, // Centrado sobre el sapito
      y: groundY - 20, // y = 430
      vy: -6,
    });

    playSound('shoot');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let spawnTimer = 0;

    const gameLoop = () => {
      spawnTimer++;
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

      // Suelo
      ctx.fillStyle = '#14241d';
      ctx.fillRect(0, groundY, canvas.width, 30);
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(canvas.width, groundY);
      ctx.stroke();

      // 1. Mover Sapo
      if (moveStateRef.current === 'left') {
        frogXRef.current = Math.max(10, frogXRef.current - 4);
      } else if (moveStateRef.current === 'right') {
        frogXRef.current = Math.min(canvas.width - 40, frogXRef.current + 4);
      }

      // Dibujar Sapo
      ctx.font = '30px Arial';
      ctx.fillText('🐸', frogXRef.current, groundY - 5);

      // 2. Mover e Spawn Invasores
      let hitEdge = false;
      invadersRef.current.forEach((inv) => {
        inv.x += invaderDirRef.current * invaderSpeedRef.current;
        if (inv.x <= 10 || inv.x >= canvas.width - 30) {
          hitEdge = true;
        }
      });

      // Si toca el borde, bajar una fila e invertir dirección
      if (hitEdge) {
        invaderDirRef.current = -invaderDirRef.current;
        invadersRef.current.forEach((inv) => {
          inv.y += 18;
          // Si llega a la altura del sapo
          if (inv.y >= groundY - 20) {
            setGameState('gameover');
            setIsPlaying(false);
            playSound('gameover');
          }
        });
        invaderSpeedRef.current = Math.min(2.5, invaderSpeedRef.current + 0.04); // Acelerar más suavemente
      }

      // Spawning de Boss esporádico
      if (spawnTimer % 700 === 0 && !invadersRef.current.some(inv => inv.type === 'boss')) {
        invadersRef.current.push({
          id: Date.now(),
          x: -30,
          y: 40,
          type: 'boss',
          emoji: '🛸',
          width: 24,
          height: 24,
          hp: 3,
          points: 15,
        });
      }

      // Dibujar Invasores
      invadersRef.current.forEach((inv, idx) => {
        if (inv.type === 'boss') {
          inv.x += 1.2;
          if (inv.x > canvas.width + 30) {
            invadersRef.current.splice(idx, 1);
            return;
          }
        }

        ctx.font = inv.type === 'boss' ? '22px Arial' : '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(inv.emoji, inv.x + 10, inv.y + 10);

        // Barra de vida para wasp y boss
        if (inv.hp > 1) {
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(inv.x, inv.y - 6, 20, 3);
          ctx.fillStyle = '#00ff00';
          const maxHp = inv.type === 'boss' ? 3 : 2;
          ctx.fillRect(inv.x, inv.y - 6, (inv.hp / maxHp) * 20, 3);
        }
      });

      // 3. Mover y Dibujar Balas (Lenguas de fuego)
      bulletsRef.current.forEach((bullet, bIdx) => {
        bullet.y += bullet.vy;
        
        ctx.strokeStyle = '#ff69b4';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y + 10);
        ctx.lineTo(bullet.x, bullet.y);
        ctx.stroke();
        
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Colisión con Invasores
        invadersRef.current.forEach((inv, iIdx) => {
          const distX = Math.abs(bullet.x - (inv.x + 10));
          const distY = Math.abs(bullet.y - (inv.y + 10));

          if (distX < 15 && distY < 15) {
            inv.hp -= 1;
            bulletsRef.current.splice(bIdx, 1);
            
            if (inv.hp <= 0) {
              setActivePool(prev => prev + inv.points);
              invadersRef.current.splice(iIdx, 1);
              playSound('kill');
            } else {
              playSound('hit');
            }
          }
        });

        if (bullet.y < 0) {
          bulletsRef.current.splice(bIdx, 1);
        }
      });

      // Si se destruyen todos los invasores, re-spawning
      const normalInvaders = invadersRef.current.filter(inv => inv.type !== 'boss');
      if (normalInvaders.length === 0) {
        const nextSpeed = invaderSpeedRef.current + 0.15;
        const initialInvaders: Invader[] = [];
        const rows = 3;
        const cols = 5;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const type = r === 0 ? 'wasp' : 'drone';
            initialInvaders.push({
              id: r * cols + c + Date.now(),
              x: 40 + c * 50,
              y: 60 + r * 35,
              type,
              emoji: type === 'wasp' ? '🐝' : '🤖',
              width: 20,
              height: 20,
              hp: type === 'wasp' ? 2 : 1,
              points: type === 'wasp' ? 4 : 2,
            });
          }
        }
        invadersRef.current = initialInvaders;
        invaderSpeedRef.current = nextSpeed;
        playSound('win');
      }

      if (gameState === 'playing') {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        moveStateRef.current = 'left';
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        moveStateRef.current = 'right';
      } else if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleShoot();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        moveStateRef.current = 'idle';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, activePool]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.05rem', marginBottom: '8px' }}>🛸 SWAMP INVADERS</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Muévete con los botones o A/D. Haz clic en el canvas para disparar.
          Pantalla extendida y velocidad calibrada. 🤖=+2, 🐝=+4, 🛸=+15.
        </p>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap-reverse' }}>
        {/* Controles */}
        <div className="pixel-card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Entrada de Defensa:
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
          </div>

          {!isPlaying ? (
            <button
              onClick={handleStartGame}
              className="pixel-btn orange"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={balance < entryFee}
            >
              🎮 INICIAR ({entryFee} sats)
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleShoot}
                className="pixel-btn orange"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                🔥 DISPARAR (-1 sat)
              </button>
              
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  onMouseDown={() => moveStateRef.current = 'left'}
                  onMouseUp={() => moveStateRef.current = 'idle'}
                  onTouchStart={() => moveStateRef.current = 'left'}
                  onTouchEnd={() => moveStateRef.current = 'idle'}
                  className="pixel-btn"
                  style={{ flex: 1, justifyContent: 'center', padding: '12px 0' }}
                >
                  ◀
                </button>
                <button
                  onMouseDown={() => moveStateRef.current = 'right'}
                  onMouseUp={() => moveStateRef.current = 'idle'}
                  onTouchStart={() => moveStateRef.current = 'right'}
                  onTouchEnd={() => moveStateRef.current = 'idle'}
                  className="pixel-btn"
                  style={{ flex: 1, justifyContent: 'center', padding: '12px 0' }}
                >
                  ▶
                </button>
              </div>

              <button
                onClick={handleCashOut}
                className="pixel-btn teal"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                disabled={activePool <= 0}
              >
                💰 COBRAR SATS
              </button>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="retro-text" style={{ color: 'var(--text-error)', textAlign: 'center', fontSize: '0.55rem', lineHeight: '1.4' }}>
              💀 GAME OVER<br/>
              ¡El pantano fue invadido!
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="pixel-card" style={{ flex: '2 1 300px', display: 'flex', justifyContent: 'center', background: '#000', padding: '0', overflow: 'hidden' }}>
          {isPlaying || gameState === 'gameover' ? (
            <canvas
              ref={canvasRef}
              width={340}
              height={480}
              onClick={handleShoot}
              style={{ 
                display: 'block', 
                cursor: 'crosshair',
                width: '100%',
                maxWidth: '340px',
                height: '480px'
              }}
            />
          ) : (
            <div style={{ width: '340px', height: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-swamp)', padding: '20px' }}>
              <div style={{ fontSize: '3rem' }}>🛸 👾 🐸</div>
              <div className="retro-text" style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textAlign: 'center', lineHeight: '1.6' }}>
                Defiende el pantano contra la invasión. Muévete y dispara tu lengua para derribar a los invasores.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
