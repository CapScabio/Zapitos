import React, { useRef, useEffect, useState } from 'react';

interface FlyCatcherProps {
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
  npub: string | null;
}

interface Insect {
  id: number;
  x: number;
  y: number;
  type: 'common' | 'gold' | 'mosquito' | 'wasp';
  emoji: string;
  size: number;
  vx: number;
  vy: number;
  points: number;
  width: number;
  height: number;
  pulse: number;
}

const playSound = (type: 'shoot' | 'eat' | 'hurt' | 'win' | 'gameover') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'shoot') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'eat') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'hurt') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.setValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'win') {
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start();
      osc.stop(now + 0.5);
    } else if (type === 'gameover') {
      const now = ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(130, now + 0.2);
      osc.frequency.setValueAtTime(90, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start();
      osc.stop(now + 0.6);
    }
  } catch (e) {
    console.error(e);
  }
};

export const FlyCatcher: React.FC<FlyCatcherProps> = ({
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

  // Lógica interna del juego
  const insectsRef = useRef<Insect[]>([]);
  const tongueRef = useRef<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    state: 'idle' | 'shooting' | 'retracting';
    length: number;
    speed: number;
    capturedInsect: Insect | null;
  }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    state: 'idle',
    length: 0,
    speed: 15,
    capturedInsect: null,
  });

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  // Sincronizar balance con backend
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
    if (entryFee <= 0 || balance < entryFee) {
      alert('Saldo insuficiente para pagar el pozo inicial.');
      return;
    }

    onBalanceChange(-entryFee);
    await updateBackendBalance(-entryFee);
    setActivePool(entryFee);
    setIsPlaying(true);
    setGameState('playing');
    insectsRef.current = [];
    tongueRef.current.state = 'idle';
    tongueRef.current.capturedInsect = null;
    playSound('shoot');
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || activePool <= 0) return;

    onBalanceChange(activePool);
    await updateBackendBalance(activePool);
    playSound('win');
    alert(`💰 ¡Cobraste con éxito! Recuperaste ${activePool} sats`);
    setGameState('idle');
    setIsPlaying(false);
    setActivePool(0);
  };

  // Loop de Canvas
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let spawnTimer = 0;
    let nextSpawnTime = 60; // Spawn de moscas

    // Posición del sapito en la pantalla (abajo en el centro)
    const frogX = canvas.width / 2;
    const frogY = canvas.height - 40;

    const gameLoop = () => {
      // 1. Limpiar pantalla
      ctx.fillStyle = '#0e1a14'; // Verde oscuro de pantano
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lineas retro
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

      // 2. Dibujar Sapito (Retro style emoji/canvas)
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = tongueRef.current.state !== 'idle' ? 10 : 0;
      ctx.font = '36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐸', frogX, frogY);
      ctx.shadowBlur = 0;

      // 3. Generar Moscas
      spawnTimer++;
      if (spawnTimer >= nextSpawnTime) {
        spawnTimer = 0;
        nextSpawnTime = 40 + Math.random() * 50; // Intervalo aleatorio

        const insectTypes: Array<Insect['type']> = ['common', 'mosquito', 'gold', 'wasp'];
        const weights = [0.5, 0.25, 0.1, 0.15]; // Probabilidades
        
        // Selector aleatorio ponderado
        const rand = Math.random();
        let type: Insect['type'] = 'common';
        let sum = 0;
        for (let i = 0; i < insectTypes.length; i++) {
          sum += weights[i];
          if (rand <= sum) {
            type = insectTypes[i];
            break;
          }
        }

        const side = Math.random() > 0.5 ? 'left' : 'right';
        const startY = 30 + Math.random() * (canvas.height - 150);
        
        let emoji = '🪰';
        let points = 2;
        let vx = (2 + Math.random() * 3) * (side === 'left' ? 1 : -1);
        let vy = (Math.random() - 0.5) * 1.5;

        if (type === 'gold') {
          emoji = '🪲';
          points = 5;
          vx *= 1.4; // Más rápido
        } else if (type === 'mosquito') {
          emoji = '🦟';
          points = 3;
        } else if (type === 'wasp') {
          emoji = '🐝';
          points = -5; // Resta sats
          vy = Math.sin(Date.now() / 200) * 2; // Patrón de vuelo oscilante
        }

        insectsRef.current.push({
          id: Date.now() + Math.random(),
          x: side === 'left' ? -30 : canvas.width + 30,
          y: startY,
          type,
          emoji,
          size: type === 'wasp' ? 24 : 20,
          vx,
          vy,
          points,
          width: 24,
          height: 24,
          pulse: 0,
        });
      }

      // 4. Actualizar y Dibujar Moscas
      insectsRef.current.forEach((insect, index) => {
        // Movimiento de mosca
        if (insect.type === 'wasp') {
          insect.vy = Math.sin(Date.now() / 150) * 1.5;
        }
        insect.x += insect.vx;
        insect.y += insect.vy;
        insect.pulse += 0.2;

        // Dibujar mosca con alas oscilantes
        ctx.save();
        ctx.font = `${insect.size}px Arial`;
        
        // Rotar levemente según velocidad
        const angle = Math.atan2(insect.vy, insect.vx);
        ctx.translate(insect.x, insect.y);
        ctx.rotate(angle + (insect.vx < 0 ? Math.PI : 0));
        
        // Efecto alas (vibración)
        const wingOffset = Math.sin(insect.pulse) * 4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-4, -10 + wingOffset, 4, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(4, -10 - wingOffset, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillText(insect.emoji, 0, 0);
        ctx.restore();

        // Eliminar moscas fuera de rango
        if (insect.x < -50 || insect.x > canvas.width + 50 || insect.y < -50 || insect.y > canvas.height + 50) {
          insectsRef.current.splice(index, 1);
        }
      });

      // 5. Actualizar y Dibujar Lengua
      const tongue = tongueRef.current;
      if (tongue.state !== 'idle') {
        const dx = tongue.targetX - frogX;
        const dy = tongue.targetY - frogY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (tongue.state === 'shooting') {
          tongue.length += tongue.speed;
          
          // Calcular extremo actual de la lengua
          const ratio = Math.min(1, tongue.length / dist);
          tongue.x = frogX + dx * ratio;
          tongue.y = frogY + dy * ratio;

          // Detectar colisiones con moscas
          insectsRef.current.forEach((insect, index) => {
            const idx = Math.abs(tongue.x - insect.x);
            const idy = Math.abs(tongue.y - insect.y);
            const colDist = Math.sqrt(idx * idx + idy * idy);

            if (colDist < insect.size && !tongue.capturedInsect) {
              // ¡Colisión! Captura
              tongue.capturedInsect = insect;
              tongue.state = 'retracting';
              insectsRef.current.splice(index, 1);
            }
          });

          // Si llega al final sin golpear
          if (tongue.length >= dist) {
            tongue.state = 'retracting';
          }

        } else if (tongue.state === 'retracting') {
          tongue.length -= tongue.speed;
          const ratio = Math.max(0, tongue.length / dist);
          tongue.x = frogX + dx * ratio;
          tongue.y = frogY + dy * ratio;

          if (tongue.capturedInsect) {
            // Mover insecto capturado con la lengua
            tongue.capturedInsect.x = tongue.x;
            tongue.capturedInsect.y = tongue.y;
          }

          if (tongue.length <= 0) {
            // Llegó de vuelta
            tongue.state = 'idle';
            if (tongue.capturedInsect) {
              const pts = tongue.capturedInsect.points;
              
              if (pts < 0) {
                // Insecto dañino (Avispa / Abeja)
                setActivePool(prev => {
                  const updated = Math.max(0, prev + pts);
                  playSound('hurt');
                  if (updated <= 0) {
                    setGameState('gameover');
                    setIsPlaying(false);
                    playSound('gameover');
                  }
                  return updated;
                });
              } else {
                // Mosca deliciosa
                setActivePool(prev => prev + pts);
                playSound('eat');
              }
              tongue.capturedInsect = null;
            }
          }
        }

        // Dibujar lengua (línea rosa gruesa 8-bit con punta roja)
        ctx.strokeStyle = '#ff69b4';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(frogX, frogY - 10);
        ctx.lineTo(tongue.x, tongue.y);
        ctx.stroke();

        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(tongue.x, tongue.y, 8, 0, Math.PI * 2);
        ctx.fill();

        if (tongue.capturedInsect) {
          ctx.font = `${tongue.capturedInsect.size}px Arial`;
          ctx.fillText(tongue.capturedInsect.emoji, tongue.x, tongue.y);
        }
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  const handleShootTongue = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const tongue = tongueRef.current;
    
    // Ignorar si ya está disparando
    if (tongue.state !== 'idle') return;

    // Verificar si tiene sats en el pozo local
    if (activePool <= 0) {
      setGameState('gameover');
      setIsPlaying(false);
      playSound('gameover');
      return;
    }

    // Cada disparo resta 1 sat del pozo
    setActivePool(prev => {
      const nextPool = prev - 1;
      if (nextPool <= 0) {
        setGameState('gameover');
        setIsPlaying(false);
        playSound('gameover');
      }
      return nextPool;
    });

    // Iniciar disparo de lengua
    tongue.targetX = clickX;
    tongue.targetY = clickY;
    tongue.x = canvas.width / 2;
    tongue.y = canvas.height - 40;
    tongue.state = 'shooting';
    tongue.length = 0;
    playSound('shoot');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🪰 ATRAPA-MOSCAS</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Caza moscas con la lengua. Cada clic cuesta 1 sat del pozo.
          🪰 = +2, 🦟 = +3, 🪲 = +5. ¡Evita las abejas 🐝 (-5)!
        </p>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap-reverse' }}>
        
        {/* Panel de Controles */}
        <div className="pixel-card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Entrada al Charco:
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
              Pozo en Charco:
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
              🚀 INICIAR ({entryFee} sats)
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleCashOut}
                className="pixel-btn teal blink"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                disabled={activePool <= 0}
              >
                💰 COBRAR POZO
              </button>
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                ¡Haz clic en la pantalla de la laguna para disparar la lengua!
              </div>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="retro-text" style={{ color: 'var(--text-error)', textAlign: 'center', fontSize: '0.65rem' }}>
              💀 GAME OVER (Pozo agotado)
            </div>
          )}
        </div>

        {/* Lienzo del Charco (Laguna Canvas) */}
        <div className="pixel-card" style={{ flex: '2 1 300px', display: 'flex', justifyContent: 'center', background: '#000', padding: '0', overflow: 'hidden' }}>
          {gameState === 'playing' ? (
            <canvas
              ref={canvasRef}
              width={340}
              height={380}
              onClick={handleShootTongue}
              style={{ 
                display: 'block', 
                cursor: 'crosshair',
                width: '100%',
                maxWidth: '340px',
                height: '380px'
              }}
            />
          ) : (
            <div style={{ width: '340px', height: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-swamp)' }}>
              <div style={{ fontSize: '3rem' }}>🐸</div>
              <div className="retro-text" style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textAlign: 'center' }}>
                Paga tu entrada e ingresa al charco para ver volar las moscas.
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
