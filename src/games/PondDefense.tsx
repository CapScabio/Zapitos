import React, { useRef, useEffect, useState } from 'react';

interface PondDefenseProps {
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
  npub: string | null;
}

interface SnakeEnemy {
  id: number;
  x: number;
  y: number;
  speed: number;
  width: number;
  height: number;
  wiggleAngle: number;
  isStomped: boolean;
  stompTimer: number;
}

interface GameParticle {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  vy: number;
  alpha: number;
  life: number;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  width: number;
}

const playSound = (type: 'jump' | 'stomp' | 'hurt' | 'win' | 'gameover') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'jump') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'stomp') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'hurt') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'win') {
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.08);
      osc.frequency.setValueAtTime(783, now + 0.16);
      osc.frequency.setValueAtTime(1046, now + 0.24);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === 'gameover') {
      const now = ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(150, now + 0.2);
      osc.frequency.setValueAtTime(100, now + 0.4);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start();
      osc.stop(now + 0.6);
    }
  } catch (e) {}
};

export const PondDefense: React.FC<PondDefenseProps> = ({
  balance,
  onBalanceChange,
  isRealMode,
  npub,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [entryFee, setEntryFee] = useState<number>(10);
  const [activePool, setActivePool] = useState<number>(0);
  const [health, setHealth] = useState<number>(100);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');

  // Lógica interna
  const snakesRef = useRef<SnakeEnemy[]>([]);
  const particlesRef = useRef<GameParticle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const comboRef = useRef<number>(1);
  const frogRef = useRef({
    x: 80,
    y: 0, // se actualiza dinámicamente según altura del canvas
    vy: 0,
    isJumping: false,
    width: 32,
    height: 32,
  });

  const eagleRef = useRef({
    x: 20,
    y: -50,
    targetY: 40,
    swooping: false,
    speed: 2,
    emoji: '🦅',
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
        console.error(err);
      }
    }
  };

  const handleStartGame = async () => {
    if (entryFee <= 0 || balance < entryFee) {
      alert('Saldo insuficiente para iniciar.');
      return;
    }

    onBalanceChange(-entryFee);
    await updateBackendBalance(-entryFee);
    setActivePool(entryFee);
    setHealth(100);
    setGameState('playing');
    setIsPlaying(true);
    
    snakesRef.current = [];
    particlesRef.current = [];
    cloudsRef.current = [];
    comboRef.current = 1;
    eagleRef.current.y = -50;
    eagleRef.current.swooping = false;
    
    frogRef.current.isJumping = false;
    frogRef.current.vy = 0;
    playSound('jump');
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing' || activePool <= 0) return;

    onBalanceChange(activePool);
    await updateBackendBalance(activePool);
    playSound('win');
    alert(`💰 ¡Cobraste! Recuperaste ${activePool} sats. ¡El estanque sigue siendo nuestro!`);
    setGameState('idle');
    setIsPlaying(false);
    setActivePool(0);
  };

  // Loop de juego
  useEffect(() => {
    if (gameState !== 'playing' && gameState !== 'gameover') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let spawnTimer = 0;
    let nextSpawnTime = 80;

    const groundY = canvas.height - 40;
    
    // Posición del sapito en el suelo al iniciar
    if (!frogRef.current.isJumping) {
      frogRef.current.y = groundY - frogRef.current.height;
    }

    const gameLoop = () => {
      // 1. Limpieza
      ctx.fillStyle = '#0a1017'; // Fondo consola oscuro
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lineas de fondo
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

      // 1.5. Nubes de fondo (Parallax)
      if (cloudsRef.current.length === 0) {
        cloudsRef.current = [
          { x: 50, y: 50, speed: 0.08, width: 40 },
          { x: 180, y: 80, speed: 0.12, width: 60 },
          { x: 300, y: 35, speed: 0.05, width: 30 },
        ];
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      cloudsRef.current.forEach((cloud) => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.width < 0) {
          cloud.x = canvas.width;
        }
        ctx.fillRect(cloud.x, cloud.y, cloud.width, 8);
        ctx.fillRect(cloud.x + 5, cloud.y - 4, cloud.width - 10, 4);
        ctx.fillRect(cloud.x + 10, cloud.y + 8, cloud.width - 20, 3);
      });

      // 2. Dibujar Estanque (Agua a la izquierda, x: 0 a 65)
      ctx.fillStyle = 'rgba(0, 245, 255, 0.15)';
      ctx.fillRect(0, groundY - 80, 65, 80);
      ctx.strokeStyle = 'var(--accent-teal)';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, groundY - 80, 65, 80);

      // Ondas del estanque
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.25)';
      ctx.lineWidth = 1;
      const waveShift1 = Math.sin(Date.now() / 250) * 2;
      const waveShift2 = Math.sin(Date.now() / 250 + Math.PI) * 2;
      
      ctx.beginPath();
      ctx.moveTo(2, groundY - 50 + waveShift1);
      ctx.lineTo(63, groundY - 50 + waveShift1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(2, groundY - 20 + waveShift2);
      ctx.lineTo(63, groundY - 20 + waveShift2);
      ctx.stroke();
      
      // Letrero del estanque
      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = 'var(--accent-teal)';
      ctx.textAlign = 'center';
      ctx.fillText('ESTANQUE', 32, groundY - 90);
      ctx.fillText('PATRIA', 32, groundY - 100);

      // Juncos / totoras en el borde del estanque (x: 65)
      ctx.strokeStyle = '#2d5a27';
      ctx.lineWidth = 2;
      // Junco 1
      ctx.beginPath();
      ctx.moveTo(64, groundY);
      ctx.quadraticCurveTo(61, groundY - 12, 63, groundY - 24);
      ctx.stroke();
      ctx.fillStyle = '#5c4033'; // Flor marrón
      ctx.fillRect(61, groundY - 28, 4, 6);

      // Junco 2
      ctx.beginPath();
      ctx.moveTo(67, groundY);
      ctx.quadraticCurveTo(71, groundY - 8, 69, groundY - 16);
      ctx.stroke();
      ctx.fillStyle = '#5c4033'; // Flor marrón
      ctx.fillRect(67, groundY - 19, 4, 4);

      // 3. Suelo
      ctx.fillStyle = '#14241d';
      ctx.fillRect(0, groundY, canvas.width, 40);
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(canvas.width, groundY);
      ctx.stroke();

      // 4. Barra de vida del estanque
      const barWidth = 100;
      const barX = 10;
      const barY = 20;
      ctx.fillStyle = '#555';
      ctx.fillRect(barX, barY, barWidth, 10);
      
      // Cambiar color de vida según nivel
      if (health > 50) ctx.fillStyle = 'var(--primary-neon)';
      else if (health > 20) ctx.fillStyle = 'var(--accent-orange)';
      else ctx.fillStyle = 'var(--text-error)';
      
      ctx.fillRect(barX, barY, (health / 100) * barWidth, 10);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, 10);
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = '#fff';
      ctx.fillText('SALUD ESTANQUE', barX + 50, barY - 5);

      // 5. Dibujar Águila (Enemigo supremo al acecho)
      if (gameState === 'gameover' && health <= 0) {
        eagleRef.current.swooping = true;
      }

      if (eagleRef.current.swooping) {
        if (eagleRef.current.y < groundY - 60) {
          eagleRef.current.y += eagleRef.current.speed * 2.5;
        }
      } else {
        eagleRef.current.y = 45 + Math.sin(Date.now() / 250) * 4;
      }
      
      ctx.save();
      ctx.translate(eagleRef.current.x, eagleRef.current.y);
      const eagleTilt = eagleRef.current.swooping ? 0.2 : Math.sin(Date.now() / 300) * 0.12;
      ctx.rotate(eagleTilt);
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(eagleRef.current.emoji, 0, 0);
      ctx.restore();

      if (eagleRef.current.swooping && eagleRef.current.y >= groundY - 70) {
        ctx.fillStyle = 'var(--text-error)';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('¡VENDIDO!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText('EE.UU. 🇺🇸', canvas.width / 2, canvas.height / 2);
      }

      // 6. Generar Serpientes Libertarias (Amarillas y Negras)
      if (gameState === 'playing') {
        spawnTimer++;
        if (spawnTimer >= nextSpawnTime) {
          spawnTimer = 0;
          nextSpawnTime = 60 + Math.random() * 80;

          snakesRef.current.push({
            id: Date.now() + Math.random(),
            x: canvas.width + 10,
            y: groundY - 20,
            speed: 1.2 + Math.random() * 1.5,
            width: 28,
            height: 16,
            wiggleAngle: 0,
            isStomped: false,
            stompTimer: 0,
          });
        }
      }

      // 7. Actualizar y dibujar Serpientes
      snakesRef.current.forEach((snake, index) => {
        if (snake.isStomped) {
          // Animación de aplastado (poof / humo)
          snake.stompTimer++;
          ctx.font = '12px "Press Start 2P"';
          ctx.fillStyle = 'var(--primary-neon)';
          ctx.fillText('💨', snake.x, snake.y);
          if (snake.stompTimer > 15) {
            snakesRef.current.splice(index, 1);
          }
          return;
        }

        // Mover serpiente hacia la izquierda
        snake.x -= snake.speed;
        snake.wiggleAngle += 0.25;

        const snakeWidth = snake.width;
        const snakeHeight = snake.height;

        // Dibujar serpiente a rayas amarillas y negras (Libertaria)
        ctx.save();
        ctx.translate(snake.x, snake.y);
        
        const wiggleY = Math.sin(snake.wiggleAngle) * 3;
        
        const segments = 4;
        const segWidth = snakeWidth / segments;
        for (let i = 0; i < segments; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#ffea00' : '#000000'; // Amarillo / Negro
          ctx.fillRect(-snakeWidth / 2 + i * segWidth, -snakeHeight / 2 + (i % 2 === 0 ? wiggleY : -wiggleY), segWidth, snakeHeight);
        }

        // Cabeza con lengua
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(-snakeWidth / 2 - 4, -snakeHeight / 2 - 2 + wiggleY, 4, snakeHeight - 4);
        ctx.fillStyle = '#ff0000'; // Lengua bífida roja
        ctx.fillRect(-snakeWidth / 2 - 7, -snakeHeight / 2 + 2 + wiggleY, 3, 2);

        ctx.restore();

        // Dibujar indicador de advertencia si la serpiente está fuera de pantalla
        if (snake.x > canvas.width - 25 && !snake.isStomped) {
          ctx.font = '8px "Press Start 2P"';
          ctx.fillStyle = 'var(--text-error)';
          if (Math.floor(Date.now() / 150) % 2 === 0) {
            ctx.textAlign = 'center';
            ctx.fillText('⚠', canvas.width - 15, snake.y);
          }
        }

        // Si la serpiente entra al estanque (extremo izquierdo)
        if (snake.x <= 75) {
          snakesRef.current.splice(index, 1);
          if (gameState === 'playing') {
            setHealth(prev => {
              const nextHealth = Math.max(0, prev - 20);
              playSound('hurt');
              if (nextHealth <= 0) {
                setGameState('gameover');
                setIsPlaying(false);
                playSound('gameover');
              }
              return nextHealth;
            });
          }
        }
      });

      // 8. Actualizar y dibujar Sapo
      const frog = frogRef.current;
      if (gameState === 'playing') {
        if (frog.isJumping) {
          // Aplicar gravedad
          frog.vy += 0.45; // fuerza gravedad
          frog.y += frog.vy;

          // Colisión con el suelo
          if (frog.y >= groundY - frog.height) {
            frog.y = groundY - frog.height;
            frog.vy = 0;
            frog.isJumping = false;
            comboRef.current = 1; // Resetea combo al tocar tierra
          }

          // Detectar pisada (Stomp) mientras cae
          if (frog.vy > 0) {
            snakesRef.current.forEach((snake) => {
              if (snake.isStomped) return;

              const distY = Math.abs((frog.y + frog.height / 2) - snake.y);
              const distX = Math.abs(frog.x - snake.x);

              if (distX < 24 && distY < 20) {
                // ¡PISÓ LA SERPIENTE!
                snake.isStomped = true;
                
                const currentCombo = comboRef.current;
                const reward = 3 * currentCombo;
                setActivePool(prev => prev + reward);
                playSound('stomp');

                // Partícula de texto "+X SATS"
                particlesRef.current.push({
                  id: Date.now() + Math.random(),
                  x: snake.x,
                  y: snake.y - 10,
                  text: `+${reward} SATS`,
                  color: currentCombo > 1 ? '#f7931a' : '#39ff14', // Naranja Bitcoin para combo, verde para normal
                  vy: -1.0,
                  alpha: 1,
                  life: 40
                });

                // Si hay combo, mostrar el cartel de combo
                if (currentCombo > 1) {
                  particlesRef.current.push({
                    id: Date.now() + Math.random(),
                    x: snake.x,
                    y: snake.y - 22,
                    text: `COMBO x${currentCombo}!`,
                    color: '#00f5ff', // Cian
                    vy: -1.4,
                    alpha: 1,
                    life: 45
                  });
                }
                
                // Efecto de rebote del sapo
                frog.vy = -6.5; // Salta hacia arriba nuevamente
                
                // Incrementar combo
                comboRef.current += 1;
              }
            });
          }
        }
      }

      // Dibujar sapito
      ctx.font = '30px Arial';
      ctx.fillText('🐸', frog.x, frog.y + 12); // Ajuste vertical

      // 9. Actualizar y dibujar Partículas
      particlesRef.current.forEach((p, index) => {
        p.y += p.vy;
        p.life--;
        p.alpha = Math.max(0, p.life / 40);
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();

        if (p.life <= 0) {
          particlesRef.current.splice(index, 1);
        }
      });

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, health]);

  const handleJump = () => {
    if (gameState !== 'playing') return;
    
    const frog = frogRef.current;
    if (!frog.isJumping) {
      frog.isJumping = true;
      frog.vy = -8.5; // Fuerza inicial del salto
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
        <h2 className="retro-title" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>🐍 ¡EL ESTANQUE NO SE VENDE!</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Presiona ESPACIO o haz clic en la laguna para saltar. 
          ¡Pisa las serpientes libertarias 🐍 antes de que vendan el estanque al águila 🦅!
          Por serpiente pisada: +3 sats.
        </p>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap-reverse' }}>
        
        {/* Panel de Controles */}
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
              Pozo Asegurado:
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
              🎮 DEFENDER ({entryFee} sats)
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleCashOut}
                className="pixel-btn teal blink"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                disabled={activePool <= 0}
              >
                💰 COBRAR SATS
              </button>
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                ¡Presiona ESPACIO o haz clic en la pantalla de juego para saltar!
              </div>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="retro-text" style={{ color: 'var(--text-error)', textAlign: 'center', fontSize: '0.55rem', lineHeight: '1.4' }}>
              💀 GAME OVER<br/>
              ¡El estanque fue vendido a EE.UU.! 🇺🇸
            </div>
          )}
        </div>

        {/* Lienzo del Charco (Canvas) */}
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
              <div style={{ fontSize: '3rem' }}>🦅 🐍 🐸</div>
              <div className="retro-text" style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textAlign: 'center', lineHeight: '1.6' }}>
                El estanque corre peligro. Los jinetes del mercado quieren privatizar el pantano. ¡Salva a tu patria!
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
