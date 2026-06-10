import React, { useRef, useEffect, useState } from 'react';

interface SapoRunProps {
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
  npub: string | null;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  emoji: string;
}

interface Fly {
  x: number;
  y: number;
  width: number;
  height: number;
  emoji: string;
  isEaten: boolean;
}

const playSound = (type: 'jump' | 'eat' | 'hurt' | 'win' | 'gameover') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'jump') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'eat') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'hurt') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'win') {
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.08);
      osc.frequency.setValueAtTime(659, now + 0.16);
      osc.frequency.setValueAtTime(880, now + 0.24);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start();
      osc.stop(now + 0.35);
    } else if (type === 'gameover') {
      const now = ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(130, now + 0.15);
      osc.frequency.setValueAtTime(90, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start();
      osc.stop(now + 0.5);
    }
  } catch (e) {}
};

export const SapoRun: React.FC<SapoRunProps> = ({
  balance,
  onBalanceChange,
  isRealMode,
  npub,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [entryFee, setEntryFee] = useState<number>(10);
  const [activePool, setActivePool] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');

  // Lógica de juego con refs
  const frogRef = useRef({
    x: 80,
    y: 200,
    vy: 0,
    isJumping: false,
    width: 30,
    height: 30,
    jumpCount: 0,
  });

  const platformsRef = useRef<Platform[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const fliesRef = useRef<Fly[]>([]);
  const speedRef = useRef<number>(2.5);

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
    setDistance(0);
    setGameState('playing');
    setIsPlaying(true);

    speedRef.current = 2.5;

    // Inicializar plataformas (suelo firme al principio)
    platformsRef.current = [
      { x: 0, y: 300, width: 200, height: 40 },
      { x: 250, y: 280, width: 150, height: 40 },
      { x: 450, y: 300, width: 150, height: 40 },
    ];
    obstaclesRef.current = [];
    fliesRef.current = [];

    frogRef.current.x = 80;
    frogRef.current.y = 200;
    frogRef.current.vy = 0;
    frogRef.current.isJumping = true;

    playSound('jump');
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || activePool <= 0) return;

    onBalanceChange(activePool);
    await updateBackendBalance(activePool);
    playSound('win');
    alert(`💰 ¡Cobraste! Recuperaste ${activePool} sats despues de recorrer ${Math.floor(distance)}m.`);
    setGameState('idle');
    setIsPlaying(false);
    setActivePool(0);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let frameCount = 0;

    const gameLoop = () => {
      frameCount++;
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

      // Dibujar Agua en el fondo inferior
      ctx.fillStyle = 'rgba(0, 245, 255, 0.08)';
      ctx.fillRect(0, 310, canvas.width, canvas.height - 310);

      // Incrementar velocidad gradualmente
      if (frameCount % 600 === 0) {
        speedRef.current = Math.min(6, speedRef.current + 0.3);
      }

      // Incrementar distancia
      setDistance(prev => prev + 0.05);

      // 1. Spawning
      // Spawn Plataformas
      const lastPlatform = platformsRef.current[platformsRef.current.length - 1];
      if (lastPlatform && lastPlatform.x + lastPlatform.width < canvas.width + 150) {
        const nextWidth = 80 + Math.random() * 120;
        const nextGap = 60 + Math.random() * 90;
        const nextY = 240 + Math.random() * 70; // Altura variable
        
        platformsRef.current.push({
          x: lastPlatform.x + lastPlatform.width + nextGap,
          y: nextY,
          width: nextWidth,
          height: 40,
        });

        // Spawn Mosca
        if (Math.random() < 0.6) {
          fliesRef.current.push({
            x: lastPlatform.x + lastPlatform.width + nextGap + nextWidth / 2,
            y: nextY - 40 - Math.random() * 50,
            width: 16,
            height: 16,
            emoji: Math.random() < 0.2 ? '🪲' : '🪰', // Emojis de moscas
            isEaten: false,
          });
        }

        // Spawn Obstáculo
        if (Math.random() < 0.45) {
          obstaclesRef.current.push({
            x: lastPlatform.x + lastPlatform.width + nextGap + nextWidth / 2 + (Math.random() * 20 - 10),
            y: nextY - 20,
            width: 20,
            height: 20,
            emoji: Math.random() < 0.5 ? '🐍' : '🦞',
          });
        }
      }

      // 2. Dibujar y Actualizar Plataformas
      ctx.fillStyle = '#14241d';
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      platformsRef.current.forEach((plat, idx) => {
        plat.x -= speedRef.current;
        // Dibujar nenúfar rectangular pixelado
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);

        // Remover si sale de pantalla
        if (plat.x + plat.width < -50) {
          platformsRef.current.splice(idx, 1);
        }
      });

      // 3. Dibujar y Actualizar Moscas
      fliesRef.current.forEach((fly, idx) => {
        fly.x -= speedRef.current;
        if (!fly.isEaten) {
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(fly.emoji, fly.x, fly.y);

          // Colisión con sapo
          const frog = frogRef.current;
          const distX = Math.abs(frog.x + frog.width / 2 - fly.x);
          const distY = Math.abs(frog.y + frog.height / 2 - fly.y);
          if (distX < 20 && distY < 20) {
            fly.isEaten = true;
            const reward = fly.emoji === '🪲' ? 3 : 1;
            setActivePool(prev => prev + reward);
            playSound('eat');
          }
        }
        if (fly.x < -30) {
          fliesRef.current.splice(idx, 1);
        }
      });

      // 4. Dibujar y Actualizar Obstáculos
      obstaclesRef.current.forEach((obs, idx) => {
        obs.x -= speedRef.current;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(obs.emoji, obs.x, obs.y + 10);

        // Colisión letal
        const frog = frogRef.current;
        const distX = Math.abs(frog.x + frog.width / 2 - obs.x);
        const distY = Math.abs(frog.y + frog.height / 2 - obs.y);
        if (distX < 18 && distY < 18) {
          setGameState('gameover');
          setIsPlaying(false);
          playSound('gameover');
        }

        if (obs.x < -30) {
          obstaclesRef.current.splice(idx, 1);
        }
      });

      // 5. Actualizar Sapo
      const frog = frogRef.current;
      frog.vy += 0.4; // Gravedad
      frog.y += frog.vy;

      // Buscar colisión con plataformas (aterrizar)
      platformsRef.current.forEach((plat) => {
        if (
          frog.x + frog.width > plat.x &&
          frog.x < plat.x + plat.width &&
          frog.y + frog.height >= plat.y &&
          frog.y + frog.height - frog.vy <= plat.y + 10 &&
          frog.vy >= 0
        ) {
          frog.y = plat.y - frog.height;
          frog.vy = 0;
          frog.isJumping = false;
          frog.jumpCount = 0;
        }
      });

      // Si cae al agua (límite inferior)
      if (frog.y > canvas.height + 10) {
        setGameState('gameover');
        setIsPlaying(false);
        playSound('gameover');
      }

      // Dibujar Sapito
      ctx.font = '26px Arial';
      ctx.textAlign = 'center';
      // Si está cayendo o saltando, cambiar inclinación o pose si fuera posible, si no solo centrar
      ctx.fillText('🐸', frog.x + frog.width / 2, frog.y + frog.height - 2);

      if (gameState === 'playing') {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  const handleJump = () => {
    const frog = frogRef.current;
    if (frog.jumpCount < 2) {
      frog.isJumping = true;
      frog.vy = -7.5; // Fuerza salto
      frog.jumpCount += 1;
      playSound('jump');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPlaying) {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>🏃‍♂️ SAPO RUN</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Salta sobre los nenúfares y esquiva culebras y cangrejos. 
          Come moscas (🪰=+1, 🪲=+3) y haz Cash Out antes de caer al agua.
        </p>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap-reverse' }}>
        {/* Controles */}
        <div className="pixel-card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Apuesta inicial (Sats):
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
                Distancia: {Math.floor(distance)}m
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
              🎮 CORRER ({entryFee} sats)
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleCashOut}
                className="pixel-btn teal"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                disabled={activePool <= 0}
              >
                💰 COBRAR SATS
              </button>
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Pulsa ESPACIO o toca la pantalla de juego para saltar.
              </div>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="retro-text" style={{ color: 'var(--text-error)', textAlign: 'center', fontSize: '0.55rem', lineHeight: '1.4' }}>
              💀 GAME OVER<br/>
              ¡Te caíste o chocaste!
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="pixel-card" style={{ flex: '2 1 300px', display: 'flex', justifyContent: 'center', background: '#000', padding: '0', overflow: 'hidden' }}>
          {isPlaying || gameState === 'gameover' ? (
            <canvas
              ref={canvasRef}
              width={340}
              height={380}
              onClick={handleJump}
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
              <div style={{ fontSize: '3rem' }}>🏃‍♂️ 🪰 🐸</div>
              <div className="retro-text" style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textAlign: 'center', lineHeight: '1.6' }}>
                El pantano es infinito. Salta sobre los nenúfares flotantes y acumula satoshis.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
