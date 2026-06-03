import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';
import type { NostrProfile } from '../components/NostrLogin';

interface FlyFeastProps {
  profile: NostrProfile | null;
  balance: number;
  onBalanceChange: (amount: number) => void;
  isRealMode: boolean;
}

interface PlayerInRoom {
  socketId: string;
  npub: string;
  name: string;
  avatar: string;
  score: number;
  x: number;
  y: number;
  color: string;
}

interface RoomData {
  id: string;
  players: PlayerInRoom[];
  entryFee: number;
  started: boolean;
  maxPlayers: number;
}

interface ServerFly {
  id: string;
  x: number;
  y: number;
  type: 'normal' | 'golden';
  eaten: boolean;
}

const playSound = (type: 'countdown' | 'start' | 'shoot' | 'eat' | 'win' | 'lost') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'countdown') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'shoot') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'eat') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(900, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'win') {
      const now = ctx.currentTime;
      osc.type = 'square';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.1);
      osc.frequency.setValueAtTime(783, now + 0.2);
      osc.frequency.setValueAtTime(1046, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start();
      osc.stop(now + 0.5);
    } else if (type === 'lost') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.setValueAtTime(90, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {}
};

export const FlyFeast: React.FC<FlyFeastProps> = ({
  profile,
  balance,
  onBalanceChange,
  isRealMode,
}) => {
  const [useBotsMode, setUseBotsMode] = useState<boolean>(false);
  const [isInLobby, setIsInLobby] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [activeFly, setActiveFly] = useState<ServerFly | null>(null);
  const [eatenNotice, setEatenNotice] = useState<string | null>(null);
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; prize: number; isMe: boolean } | null>(null);

  const socket = getSocket();
  const socketConnectedRef = useRef(false);
  const gameAreaRef = useRef<HTMLDivElement | null>(null);
  const tongueTargetRef = useRef<{ x: number; y: number; socketId: string } | null>(null);

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

  // Conectar WebSockets y registrar listeners
  useEffect(() => {
    if (useBotsMode) return;

    socket.connect();

    socket.on('connect', () => {
      console.log('Conectado a WebSocket para FlyFeast');
      socketConnectedRef.current = true;
    });

    socket.on('room_update', (roomData: RoomData) => {
      setRoom(roomData);
    });

    socket.on('game_countdown', ({ countdown }: { countdown: number }) => {
      setCountdown(countdown);
      playSound('countdown');
    });

    socket.on('game_start', (roomData: RoomData) => {
      setCountdown(null);
      setRoom(roomData);
      setWinnerInfo(null);
      playSound('start');
    });

    socket.on('fly_spawn', (fly: ServerFly) => {
      setActiveFly(fly);
      setEatenNotice(null);
    });

    socket.on('fly_eaten', ({ eatenBy, playerName, players }: { flyId: string; eatenBy: string; playerName: string; players: PlayerInRoom[] }) => {
      // Disparar animación de la lengua del oponente/mi lengua
      const eatingPlayer = players.find(p => p.socketId === eatenBy);
      if (eatingPlayer && activeFly) {
        tongueTargetRef.current = {
          x: activeFly.x,
          y: activeFly.y,
          socketId: eatenBy,
        };
        setTimeout(() => {
          tongueTargetRef.current = null;
        }, 300);
      }

      setEatenNotice(`👅 ¡${playerName} atrapó la mosca!`);
      playSound('eat');
      
      // Actualizar scores en el lobby local
      setRoom(prev => prev ? { ...prev, players } : null);
      
      // Esconder mosca
      setActiveFly(null);
    });

    socket.on('game_over', ({ winner, prize, draw, players }: { winner: PlayerInRoom | null; prize: number; draw: boolean; players: PlayerInRoom[] }) => {
      setActiveFly(null);
      setRoom(prev => prev ? { ...prev, players } : null);
      
      if (draw) {
        setWinnerInfo({ name: 'Empate', prize: 0, isMe: false });
        playSound('lost');
      } else if (winner) {
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
      }
      
      setTimeout(() => {
        setIsInLobby(false);
        setRoom(null);
        setWinnerInfo(null);
      }, 5000);
    });

    socket.on('disconnect', () => {
      socketConnectedRef.current = false;
    });

    return () => {
      socket.off('room_update');
      socket.off('game_countdown');
      socket.off('game_start');
      socket.off('fly_spawn');
      socket.off('fly_eaten');
      socket.off('game_over');
      socket.disconnect();
    };
  }, [useBotsMode]);

  // ----------------------------------------------------
  // LOGICA DEL MODO DE BOTS (OFFLINE SANDBOX)
  // ----------------------------------------------------
  const botIntervalRef = useRef<any>(null);

  const startBotsGame = () => {
    if (balance < 10) {
      alert('Saldo insuficiente (mínimo 10 sats).');
      return;
    }

    onBalanceChange(-10);
    setIsInLobby(true);
    setCountdown(3);
    playSound('countdown');

    const mockPlayers: PlayerInRoom[] = [
      {
        socketId: 'me',
        npub: profile?.npub || 'me',
        name: profile?.name || 'Mi Sapo',
        avatar: profile?.avatar || '🐸',
        score: 0,
        x: 20,
        y: 80,
        color: '#39ff14',
      },
      {
        socketId: 'bot1',
        npub: 'bot1',
        name: 'Sapo Bot Alfa 🤖',
        avatar: '🦎',
        score: 0,
        x: 50,
        y: 80,
        color: '#00f5ff',
      },
      {
        socketId: 'bot2',
        npub: 'bot2',
        name: 'Sapo Bot Beta 🤖',
        avatar: '🐢',
        score: 0,
        x: 80,
        y: 80,
        color: '#f7931a',
      },
    ];

    setRoom({
      id: 'room_bots',
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
        playSound('countdown');
      } else {
        clearInterval(countInt);
        setCountdown(null);
        setRoom(prev => prev ? { ...prev, started: true } : null);
        playSound('start');
        spawnBotFly(1, mockPlayers);
      }
    }, 1000);
  };

  const spawnBotFly = (flyNum: number, currentPlayers: PlayerInRoom[]) => {
    if (flyNum > 10) {
      // Fin del juego con bots
      let winner = currentPlayers[0];
      let draw = false;
      for (let i = 1; i < currentPlayers.length; i++) {
        if (currentPlayers[i].score > winner.score) {
          winner = currentPlayers[i];
          draw = false;
        } else if (currentPlayers[i].score === winner.score) {
          draw = true;
        }
      }

      const isMe = winner.socketId === 'me' && !draw;
      setWinnerInfo({
        name: draw ? 'Empate' : winner.name,
        prize: 30,
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
      }, 5000);
      return;
    }

    const fly: ServerFly = {
      id: `bot_fly_${flyNum}`,
      x: 15 + Math.random() * 70,
      y: 20 + Math.random() * 40,
      type: 'normal',
      eaten: false,
    };

    setActiveFly(fly);
    setEatenNotice(null);

    // Los bots reaccionan con delay aleatorio para atrapar la mosca
    const botDelay = 1200 + Math.random() * 1600; // ms
    const chosenBotIdx = Math.random() > 0.5 ? 1 : 2; // bot1 o bot2

    botIntervalRef.current = setTimeout(() => {
      // Si el jugador no se la comió antes
      setActiveFly(prev => {
        if (prev && prev.id === fly.id && !prev.eaten) {
          // El bot se la come
          const updatedPlayers = currentPlayers.map(p => {
            if (p.socketId === mockPlayersRef.current[chosenBotIdx].socketId) {
              return { ...p, score: p.score + 1 };
            }
            return p;
          });
          mockPlayersRef.current = updatedPlayers;

          setRoom(prevRoom => prevRoom ? { ...prevRoom, players: updatedPlayers } : null);
          setEatenNotice(`👅 ¡${updatedPlayers[chosenBotIdx].name} atrapó la mosca!`);
          playSound('eat');

          setTimeout(() => {
            spawnBotFly(flyNum + 1, updatedPlayers);
          }, 1500);
        }
        return null;
      });
    }, botDelay);
  };

  const mockPlayersRef = useRef<PlayerInRoom[]>([]);
  useEffect(() => {
    if (room) mockPlayersRef.current = room.players;
  }, [room]);

  const handleJoinLobby = async () => {
    if (balance < 10) {
      alert('Saldo insuficiente para la entrada (10 sats).');
      return;
    }

    // Descontar entrada
    onBalanceChange(-10);
    await updateBackendBalance(-10);

    setIsInLobby(true);
    setWinnerInfo(null);

    if (useBotsMode) {
      startBotsGame();
    } else {
      socket.emit('join_lobby', {
        gameId: 'fly_feast',
        player: {
          name: profile?.name || 'Sapo Anónimo',
          avatar: profile?.avatar || '🐸',
          npub: profile?.npub || 'anonimo',
        },
      });
      playSound('shoot');
    }
  };

  const handleEatFlyClient = (flyId: string) => {
    if (!activeFly || activeFly.id !== flyId) return;

    if (useBotsMode) {
      // Modo offline bots
      if (botIntervalRef.current) clearTimeout(botIntervalRef.current);
      
      const updatedPlayers = mockPlayersRef.current.map(p => {
        if (p.socketId === 'me') {
          return { ...p, score: p.score + 1 };
        }
        return p;
      });
      mockPlayersRef.current = updatedPlayers;

      setRoom(prev => prev ? { ...prev, players: updatedPlayers } : null);
      setEatenNotice('👅 ¡Atrapaste la mosca! +1 punto');
      playSound('eat');
      setActiveFly(null);

      // Siguiente mosca
      const currentFlyNum = parseInt(flyId.replace('bot_fly_', ''));
      setTimeout(() => {
        spawnBotFly(currentFlyNum + 1, updatedPlayers);
      }, 1500);

    } else {
      // Emitir al server WebSockets
      if (room) {
        socket.emit('eat_fly', { roomId: room.id, flyId });
      }
    }
  };

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (botIntervalRef.current) clearTimeout(botIntervalRef.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px' }}>
      
      <div className="pixel-card" style={{ width: '100%', textAlign: 'center' }}>
        <h2 className="retro-title" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🎮 CHARCO RÁPIDO (Feast)</h2>
        <p className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
          Multijugador en tiempo real. 2-4 jugadores. Entrada: 10 sats.
          ¡El ganador se lleva el pozo de todos! 🏆
        </p>
      </div>

      {/* Selector de Modo (WebSocket Real vs Bots Sandbox) */}
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
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👥</div>
          <button
            onClick={handleJoinLobby}
            className="pixel-btn orange"
            style={{ fontSize: '0.9rem', padding: '16px 24px' }}
            disabled={balance < 10}
          >
            INGRESAR A LOBBY (10 sats)
          </button>
          {balance < 10 && (
            <div className="retro-text" style={{ color: 'var(--text-error)', marginTop: '12px', fontSize: '0.55rem' }}>
              Necesitas mínimo 10 sats en tu billetera.
            </div>
          )}
        </div>
      ) : (
        /* Pantalla de juego activa */
        <div style={{ display: 'flex', width: '100%', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* LOBBY / SCORES */}
          <div className="pixel-card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="retro-text" style={{ fontSize: '0.65rem', color: 'var(--accent-teal)' }}>
              {room?.started ? '📊 PUNTAJES (10 moscas)' : '⌛ BUSCANDO PARTIDA...'}
            </h3>
            
            {countdown !== null && (
              <div style={{ textAlign: 'center', padding: '8px' }}>
                <div className="retro-text" style={{ color: 'var(--accent-orange)' }}>EMPIEZA EN:</div>
                <div className="retro-title" style={{ fontSize: '2rem', color: 'var(--accent-orange)' }}>{countdown}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {room?.players.map((p, _idx) => (
                <div 
                  key={p.socketId} 
                  className="pixel-card" 
                  style={{ 
                    padding: '8px',
                    borderColor: p.socketId === 'me' || p.socketId === socket.id ? 'var(--primary-neon)' : 'var(--bg-card)',
                    background: 'var(--bg-swamp)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{p.avatar}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="retro-text" style={{ fontSize: '0.5rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                  </div>
                  <div className="retro-title" style={{ fontSize: '0.8rem', color: 'var(--primary-neon)' }}>
                    {p.score}
                  </div>
                </div>
              ))}
            </div>

            {room && !room.started && (
              <div className="retro-text blink" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
                Esperando a que se unan más sapitos... ({room.players.length}/{room.maxPlayers})
              </div>
            )}
          </div>

          {/* ARENA DE JUEGO */}
          <div 
            ref={gameAreaRef}
            className="pixel-card" 
            style={{ 
              flex: '2 1 300px', 
              height: '380px', 
              background: 'var(--bg-swamp)', 
              position: 'relative',
              overflow: 'hidden',
              border: '4px solid var(--bg-card)'
            }}
          >
            {winnerInfo ? (
              /* Ganador final */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', background: 'rgba(7,12,16,0.95)', zIndex: 10 }}>
                <div style={{ fontSize: '3rem' }}>🏆</div>
                <div className="retro-title" style={{ fontSize: '1.1rem' }}>
                  {winnerInfo.name === 'Empate' ? '¡EMPATE!' : '¡GANADOR!'}
                </div>
                {winnerInfo.name !== 'Empate' && (
                  <>
                    <div className="retro-text" style={{ color: 'var(--accent-teal)' }}>{winnerInfo.name}</div>
                    <div className="retro-title" style={{ fontSize: '1.3rem', color: 'var(--accent-orange)' }}>
                      +{winnerInfo.prize} SATS
                    </div>
                  </>
                )}
                <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                  Volviendo al charco principal...
                </div>
              </div>
            ) : room?.started ? (
              /* Arena de juego activa */
              <div style={{ width: '100%', height: '100%' }}>
                
                {/* Mosca volando */}
                {activeFly ? (
                  <button
                    onClick={() => handleEatFlyClient(activeFly.id)}
                    className="pulse"
                    style={{
                      position: 'absolute',
                      left: `${activeFly.x}%`,
                      top: `${activeFly.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: '1.8rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      zIndex: 5,
                      outline: 'none',
                    }}
                  >
                    🪰
                  </button>
                ) : (
                  eatenNotice && (
                    <div 
                      className="retro-text blink" 
                      style={{ 
                        position: 'absolute', 
                        top: '40%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)', 
                        color: 'var(--primary-neon)',
                        fontSize: '0.6rem',
                        textAlign: 'center',
                        width: '90%'
                      }}
                    >
                      {eatenNotice}
                    </div>
                  )
                )}

                {/* Sapitos en el fondo */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    bottom: '20px', 
                    left: 0, 
                    right: 0, 
                    display: 'flex', 
                    justifyContent: 'space-around',
                    padding: '0 20px'
                  }}
                >
                  {room.players.map((p) => {
                    const isCurrent = p.socketId === 'me' || p.socketId === socket.id;
                    return (
                      <div 
                        key={p.socketId} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center',
                          border: isCurrent ? '2px dashed var(--primary-neon)' : 'none',
                          padding: '4px',
                          borderRadius: '4px'
                        }}
                      >
                        <div style={{ fontSize: '2.2rem' }}>🐸</div>
                        <div className="retro-text" style={{ fontSize: '0.45rem', color: p.color }}>
                          {p.name.substring(0, 8)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Pantalla cargando / esperando */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                <div style={{ fontSize: '2.5rem' }} className="blink">🐸 🎮 🐸</div>
                <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center', width: '80%', lineHeight: '1.4' }}>
                  {useBotsMode ? 'Inicializando simulador...' : 'Conectando con el charco... Preparando sapitos.'}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
