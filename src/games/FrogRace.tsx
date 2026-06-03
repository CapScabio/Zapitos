import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';
import type { NostrProfile } from '../components/NostrLogin';

interface FrogRaceProps {
  profile: NostrProfile | null;
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
}

interface PlayerInRace {
  socketId: string;
  npub: string;
  name: string;
  avatar: string;
  x: number; // 0 a 100% de la pista
  y: number;
  color: string;
}

interface RoomRaceData {
  id: string;
  players: PlayerInRace[];
  entryFee: number;
  started: boolean;
  maxPlayers: number;
}

const playSound = (type: 'beep' | 'success' | 'fail' | 'win' | 'lost') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'fail') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
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
    } else if (type === 'lost') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.setValueAtTime(100, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {}
};

export const FrogRace: React.FC<FrogRaceProps> = ({
  profile,
  balance,
  onBalanceChange,
  isRealMode,
}) => {
  const [useBotsMode, setUseBotsMode] = useState<boolean>(false);
  const [isInLobby, setIsInLobby] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [room, setRoom] = useState<RoomRaceData | null>(null);
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; prize: number; isMe: boolean } | null>(null);

  // Estados del juego de ritmo
  const [needlePos, setNeedlePos] = useState<number>(0); // 0 a 100% de la barra
  const [feedbackText, setFeedbackText] = useState<string>('¡PREPARATE!');
  const [feedbackColor, setFeedbackColor] = useState<string>('var(--text-muted)');

  const socket = getSocket();
  const socketConnectedRef = useRef(false);
  const needleDirectionRef = useRef<1 | -1>(1);
  const animationFrameId = useRef<number | null>(null);

  // Parámetros de la zona de acierto (Ritmo)
  const targetMin = 40; // Rango mínimo
  const targetMax = 60; // Rango máximo

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  // Sincronizar balance con backend
  const updateBackendBalance = async (amount: number) => {
    if (isRealMode && profile) {
      try {
        await fetch(`${BACKEND_URL}/api/balance/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npub: profile.npub, amount }),
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Oscilar la aguja de ritmo
  useEffect(() => {
    if (!room?.started || winnerInfo) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      return;
    }

    const updateNeedle = () => {
      setNeedlePos((prev) => {
        let next = prev + 3 * needleDirectionRef.current; // Velocidad de la aguja
        if (next >= 100) {
          next = 100;
          needleDirectionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          needleDirectionRef.current = 1;
        }
        return next;
      });
      animationFrameId.current = requestAnimationFrame(updateNeedle);
    };

    animationFrameId.current = requestAnimationFrame(updateNeedle);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [room?.started, winnerInfo]);

  // Conectar WebSockets y registrar listeners
  useEffect(() => {
    if (useBotsMode) return;

    socket.connect();

    socket.on('connect', () => {
      console.log('Conectado a WebSocket para FrogRace');
      socketConnectedRef.current = true;
    });

    socket.on('room_update', (roomData: RoomRaceData) => {
      setRoom(roomData);
    });

    socket.on('game_countdown', ({ countdown }: { countdown: number }) => {
      setCountdown(countdown);
      playSound('beep');
    });

    socket.on('game_start', (roomData: RoomRaceData) => {
      setCountdown(null);
      setRoom(roomData);
      setWinnerInfo(null);
      setFeedbackText('¡CARRERA INICIADA! 🏁');
      setFeedbackColor('var(--primary-neon)');
      playSound('success');
    });

    socket.on('race_progress', (players: PlayerInRace[]) => {
      setRoom(prev => prev ? { ...prev, players } : null);
    });

    socket.on('game_over', ({ winner, prize, players }: { winner: PlayerInRace; prize: number; _reason?: string; players: PlayerInRace[] }) => {
      setRoom(prev => prev ? { ...prev, players } : null);
      
      const isMe = winner.socketId === socket.id;
      setWinnerInfo({
        name: winner.name,
        prize,
        isMe,
      });

      if (isMe) {
        onBalanceChange(prize);
        updateBackendBalance(prize);
        playSound('win');
      } else {
        playSound('lost');
      }

      setTimeout(() => {
        setIsInLobby(false);
        setRoom(null);
        setWinnerInfo(null);
      }, 6000);
    });

    return () => {
      socket.off('room_update');
      socket.off('game_countdown');
      socket.off('game_start');
      socket.off('race_progress');
      socket.off('game_over');
      socket.disconnect();
    };
  }, [useBotsMode]);

  // ----------------------------------------------------
  // LOGICA DEL MODO DE BOTS (OFFLINE SANDBOX)
  // ----------------------------------------------------
  const botRaceIntervals = useRef<any[]>([]);

  const startBotsRace = () => {
    if (balance < 10) {
      alert('Saldo insuficiente.');
      return;
    }

    onBalanceChange(-10);
    setIsInLobby(true);
    setCountdown(3);
    playSound('beep');

    const mockPlayers: PlayerInRace[] = [
      {
        socketId: 'me',
        npub: profile?.npub || 'me',
        name: profile?.name || 'Mi Sapo',
        avatar: profile?.avatar || '🐸',
        x: 0,
        y: 0,
        color: '#39ff14',
      },
      {
        socketId: 'bot1',
        npub: 'bot1',
        name: 'Sapo Veloz 🤖',
        avatar: '🚀',
        x: 0,
        y: 0,
        color: '#00f5ff',
      },
      {
        socketId: 'bot2',
        npub: 'bot2',
        name: 'Sapo Saltón 🤖',
        avatar: '👾',
        x: 0,
        y: 0,
        color: '#f7931a',
      },
    ];

    setRoom({
      id: 'room_race_bots',
      players: mockPlayers,
      entryFee: 10,
      started: false,
      maxPlayers: 3,
    });

    let count = 3;
    const countInt = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        playSound('beep');
      } else {
        clearInterval(countInt);
        setCountdown(null);
        setRoom(prev => prev ? { ...prev, started: true } : null);
        playSound('success');
        setFeedbackText('¡SALTA EN VERDE! 🟢');
        setFeedbackColor('var(--primary-neon)');
        startSimulatedBots();
      }
    }, 1000);
  };

  const startSimulatedBots = () => {
    botRaceIntervals.current.forEach(clearInterval);
    botRaceIntervals.current = [];

    // Simular saltos de los dos bots
    const createBotLoop = (botId: string, speedMs: number, accuracy: number) => {
      const interval = setInterval(() => {
        setRoom(prevRoom => {
          if (!prevRoom || !prevRoom.started || winnerInfo) {
            clearInterval(interval);
            return prevRoom;
          }

          const updatedPlayers = prevRoom.players.map(p => {
            if (p.socketId === botId && p.x < 100) {
              const perfectJump = Math.random() < accuracy;
              const step = perfectJump ? 10 : 0; // Si acierta avanza 10%
              const nextX = p.x + step;

              // Verificar si el bot ganó
              if (nextX >= 100) {
                clearInterval(interval);
                handleBotRaceEnd(p);
              }

              return { ...p, x: Math.min(100, nextX) };
            }
            return p;
          });

          return { ...prevRoom, players: updatedPlayers };
        });
      }, speedMs);

      botRaceIntervals.current.push(interval);
    };

    // Bot 1: Rápido pero comete más errores
    createBotLoop('bot1', 1200, 0.4);
    // Bot 2: Lento pero constante
    createBotLoop('bot2', 1700, 0.6);
  };

  const handleBotRaceEnd = (winner: PlayerInRace) => {
    botRaceIntervals.current.forEach(clearInterval);
    
    const isMe = winner.socketId === 'me';
    setWinnerInfo({
      name: winner.name,
      prize: 30, // Pozo de 3 jugadores
      isMe,
    });

    if (isMe) {
      onBalanceChange(30);
      playSound('win');
    } else {
      playSound('lost');
    }

    setTimeout(() => {
      setIsInLobby(false);
      setRoom(null);
      setWinnerInfo(null);
    }, 6000);
  };

  const handleJoinLobby = async () => {
    if (balance < 10) {
      alert('Saldo insuficiente para la entrada (10 sats).');
      return;
    }

    onBalanceChange(-10);
    await updateBackendBalance(-10);

    setIsInLobby(true);
    setWinnerInfo(null);

    if (useBotsMode) {
      startBotsRace();
    } else {
      socket.emit('join_lobby', {
        gameId: 'frog_race',
        player: {
          name: profile?.name || 'Sapo Anónimo',
          avatar: profile?.avatar || '🐸',
          npub: profile?.npub || 'anonimo',
        },
      });
      playSound('beep');
    }
  };

  // Función para procesar salto (Rhythm Tapping)
  const handleJumpPress = () => {
    if (!room?.started || winnerInfo) return;

    // Calcular si la aguja está en la zona verde
    const isHit = needlePos >= targetMin && needlePos <= targetMax;

    if (isHit) {
      // Éxito: Avanzar sapo
      setFeedbackText('🎯 ¡PERFECTO!');
      setFeedbackColor('var(--primary-neon)');
      playSound('success');

      if (useBotsMode) {
        // Actualizar localmente en modo bots
        setRoom(prevRoom => {
          if (!prevRoom) return prevRoom;
          const updatedPlayers = prevRoom.players.map(p => {
            if (p.socketId === 'me') {
              const nextX = p.x + 10;
              if (nextX >= 100) {
                handleBotRaceEnd(p);
              }
              return { ...p, x: Math.min(100, nextX) };
            }
            return p;
          });
          return { ...prevRoom, players: updatedPlayers };
        });
      } else {
        // Enviar evento WebSocket
        socket.emit('frog_jump', { roomId: room.id });
      }
    } else {
      // Error
      setFeedbackText('💨 ¡FALLASTE!');
      setFeedbackColor('var(--text-error)');
      playSound('fail');
    }
  };

  useEffect(() => {
    // Tecla Espacio para saltar también
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isInLobby && room?.started && !winnerInfo) {
        e.preventDefault();
        handleJumpPress();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      botRaceIntervals.current.forEach(clearInterval);
    };
  }, [isInLobby, room?.started, needlePos, winnerInfo]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🏁 CARRERA DE SAPITOS</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Presiona ESPACIO o clica ¡SALTAR! cuando la aguja esté en la zona verde (🎯).
          Entrada: 10 sats. Distribución pozo al ganador.
        </p>
      </div>

      {/* Selector de Conectividad */}
      {!isInLobby && (
        <div className="pixel-card" style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="retro-text" style={{ fontSize: '0.6rem' }}>Servidor Multijugador:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setUseBotsMode(false)}
              className={`pixel-btn ${!useBotsMode ? 'teal' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.55rem' }}
            >
              Conectado (WebSockets)
            </button>
            <button
              onClick={() => setUseBotsMode(true)}
              className={`pixel-btn ${useBotsMode ? 'orange' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.55rem' }}
            >
              Sandbox (VS Bots 🤖)
            </button>
          </div>
        </div>
      )}

      {!isInLobby ? (
        <div className="pixel-card" style={{ width: '100%', textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏁</div>
          <button
            onClick={handleJoinLobby}
            className="pixel-btn orange"
            style={{ fontSize: '0.9rem', padding: '16px 24px' }}
            disabled={balance < 10}
          >
            INGRESAR A CARRERA (10 sats)
          </button>
          {balance < 10 && (
            <div className="retro-text" style={{ color: 'var(--text-error)', marginTop: '12px', fontSize: '0.55rem' }}>
              Necesitas mínimo 10 sats en tu billetera.
            </div>
          )}
        </div>
      ) : (
        /* Pantalla activa de carrera */
        <div style={{ display: 'flex', width: '100%', gap: '16px', flexDirection: 'column' }}>
          
          {/* LOBBY / PISTA DE CARRERAS */}
          <div className="pixel-card" style={{ background: 'var(--bg-swamp)', width: '100%', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {countdown !== null && (
              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <div className="retro-text" style={{ color: 'var(--accent-orange)' }}>SEÑAL DE SALIDA EN:</div>
                <div className="retro-title" style={{ fontSize: '2rem', color: 'var(--accent-orange)' }}>{countdown}</div>
              </div>
            )}

            {winnerInfo && (
              <div className="pixel-card" style={{ background: 'rgba(7,12,16,0.95)', padding: '16px', textAlign: 'center', zIndex: 10 }}>
                <div style={{ fontSize: '2rem' }}>🏆</div>
                <div className="retro-title" style={{ fontSize: '1rem', color: 'var(--accent-orange)' }}>🏁 FIN DE LA CARRERA 🏁</div>
                <div className="retro-text" style={{ marginTop: '8px' }}>
                  Ganador: <span style={{ color: 'var(--primary-neon)' }}>{winnerInfo.name}</span> (+{winnerInfo.prize} sats)
                </div>
              </div>
            )}

            {/* Render de los carriles (Pista de carreras) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {room?.players.map((p, _idx) => (
                <div 
                  key={p.socketId}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    background: 'var(--bg-dark)',
                    border: '2px solid var(--bg-card)',
                    padding: '8px 12px',
                    position: 'relative',
                    height: '56px',
                    borderRadius: '4px'
                  }}
                >
                  {/* Nombre y avatar */}
                  <div style={{ width: '100px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2 }}>
                    <span style={{ fontSize: '1.2rem' }}>{p.avatar}</span>
                    <span className="retro-text" style={{ fontSize: '0.45rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: p.color }}>
                      {p.name.substring(0, 8)}
                    </span>
                  </div>

                  {/* Carril de agua y progreso del sapito */}
                  <div style={{ flex: 1, height: '10px', background: 'rgba(0, 245, 255, 0.1)', borderBottom: '2px solid var(--accent-teal)', position: 'relative', margin: '0 20px' }}>
                    
                    {/* El sapito avanzando */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        left: `${p.x}%`, 
                        top: '-15px', 
                        transition: 'left 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                        fontSize: '1.6rem',
                        transform: 'translateX(-50%)',
                        zIndex: 3
                      }}
                    >
                      🐸
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="retro-text" style={{ fontSize: '0.5rem', color: p.x >= 100 ? 'var(--primary-neon)' : 'var(--text-muted)', borderLeft: '2px dashed #fff', paddingLeft: '8px', zIndex: 2 }}>
                    {p.x >= 100 ? '🏁 FIN' : `${p.x}%`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RHYTHM TAPPING PANEL */}
          {room?.started && !winnerInfo && (
            <div className="pixel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px' }}>
              
              {/* Retro Feedback Text */}
              <div 
                className="retro-title" 
                style={{ 
                  fontSize: '0.85rem', 
                  color: feedbackColor, 
                  textAlign: 'center', 
                  height: '24px' 
                }}
              >
                {feedbackText}
              </div>

              {/* Slider de Ritmo */}
              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: '300px', 
                  height: '30px', 
                  background: 'var(--bg-dark)', 
                  border: 'var(--border-pixel)', 
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Zona Verde de Acierto (Target Zone) */}
                <div 
                  style={{ 
                    position: 'absolute',
                    left: `${targetMin}%`,
                    width: `${targetMax - targetMin}%`,
                    top: 0,
                    bottom: 0,
                    background: 'rgba(57, 255, 20, 0.4)',
                    borderLeft: '2px dashed var(--primary-neon)',
                    borderRight: '2px dashed var(--primary-neon)'
                  }}
                />

                {/* Aguja Oscilante */}
                <div 
                  style={{ 
                    position: 'absolute',
                    left: `${needlePos}%`,
                    top: 0,
                    bottom: 0,
                    width: '6px',
                    background: '#ff0000',
                    boxShadow: '0 0 5px #ff0000',
                    transform: 'translateX(-50%)'
                  }}
                />
              </div>

              {/* Botón de Salto */}
              <button
                onClick={handleJumpPress}
                className="pixel-btn orange blink"
                style={{ 
                  width: '100%', 
                  maxWidth: '220px', 
                  justifyContent: 'center', 
                  fontSize: '1rem', 
                  padding: '16px' 
                }}
              >
                🚀 ¡SALTAR!
              </button>
              
              <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                (Presiona la barra ESPACIADORA o haz clic en el botón rojo en la zona verde central).
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
