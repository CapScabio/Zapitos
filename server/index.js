import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Mock Database for Invoices
const mockInvoices = new Map();
const mockBalances = new Map(); // npub -> balance (sats)

// Helper: Genera un hash aleatorio para simular facturas LN
const generateRandomHash = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// API REST for Lightning Mock
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Crear una factura de depósito (simulada)
app.post('/api/invoice', (req, res) => {
  const { amount, memo, npub } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  const paymentHash = generateRandomHash();
  const paymentInvoice = `lnbc${amount}n1p...mock_invoice_${paymentHash}`;

  const invoiceData = {
    paymentHash,
    paymentInvoice,
    amount: parseInt(amount),
    memo: memo || 'Depósito en Zapitos',
    npub: npub || 'anonimo',
    status: 'unpaid',
    createdAt: Date.now(),
  };

  mockInvoices.set(paymentHash, invoiceData);

  // Auto-pagar en 5 segundos en Modo Demo para simular la red
  setTimeout(() => {
    const inv = mockInvoices.get(paymentHash);
    if (inv && inv.status === 'unpaid') {
      inv.status = 'paid';
      inv.paidAt = Date.now();
      mockInvoices.set(paymentHash, inv);

      // Acreditar saldo
      if (inv.npub !== 'anonimo') {
        const currentBalance = mockBalances.get(inv.npub) || 0;
        mockBalances.set(inv.npub, currentBalance + inv.amount);
      }
      console.log(`[MOCK LN] Factura pagada: ${paymentHash} (+${inv.amount} sats para ${inv.npub})`);
    }
  }, 4000);

  res.json({
    pr: paymentInvoice,
    paymentHash,
  });
});

// Consultar estado de factura
app.get('/api/invoice/:hash', (req, res) => {
  const { hash } = req.params;
  const invoice = mockInvoices.get(hash);
  if (!invoice) {
    return res.status(404).json({ error: 'Factura no encontrada' });
  }
  res.json({
    status: invoice.status,
    paid: invoice.status === 'paid',
  });
});

// Consultar saldo por npub
app.get('/api/balance/:npub', (req, res) => {
  const { npub } = req.params;
  const balance = mockBalances.get(npub) || 0;
  res.json({ balance });
});

// Actualizar saldo directamente (para el demo del juego)
app.post('/api/balance/update', (req, res) => {
  const { npub, amount } = req.body;
  if (!npub) return res.status(400).json({ error: 'Falta npub' });
  
  const currentBalance = mockBalances.get(npub) || 0;
  const newBalance = Math.max(0, currentBalance + parseInt(amount));
  mockBalances.set(npub, newBalance);
  
  res.json({ balance: newBalance });
});

// Pagar un retiro (LNURL-Withdraw / Send Payment)
app.post('/api/withdraw', (req, res) => {
  const { invoice, amount, npub } = req.body;
  if (!invoice || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Datos de retiro inválidos' });
  }

  // Verificar si tiene saldo suficiente
  if (npub) {
    const balance = mockBalances.get(npub) || 0;
    if (balance < amount) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }
    mockBalances.set(npub, balance - amount);
  }

  console.log(`[MOCK LN] Retiro exitoso procesado para ${npub || 'Anónimo'}: ${amount} sats enviados a ${invoice}`);
  res.json({ status: 'ok', preimage: generateRandomHash() });
});

// ----------------------------------------------------
// MULTIPLAYER SOCKETS LOGIC
// ----------------------------------------------------

const gameRooms = new Map(); // roomId -> roomData

io.on('connection', (socket) => {
  console.log(`[SOCKET] Jugador conectado: ${socket.id}`);

  // Entrar a un lobby de juego
  socket.on('join_lobby', ({ gameId, player }) => {
    // Buscar un lobby disponible o crear uno nuevo
    let roomId = null;
    
    for (const [rId, room] of gameRooms.entries()) {
      if (room.gameId === gameId && room.players.length < room.maxPlayers && !room.started) {
        roomId = rId;
        break;
      }
    }

    if (!roomId) {
      roomId = `room_${gameId}_${Date.now()}`;
      gameRooms.set(roomId, {
        id: roomId,
        gameId,
        players: [],
        maxPlayers: gameId === 'fly_feast' ? 4 : 3,
        entryFee: 10, // 10 sats por defecto
        started: false,
        state: {},
      });
    }

    const room = gameRooms.get(roomId);
    
    const playerData = {
      socketId: socket.id,
      npub: player.npub || `anon_${socket.id.substring(0, 5)}`,
      name: player.name || 'Sapo Anónimo',
      avatar: player.avatar || '',
      score: 0,
      x: 10 + room.players.length * 30, // Posición inicial
      y: 80,
      color: ['#39ff14', '#00f5ff', '#ff00ff', '#f7931a'][room.players.length],
    };

    room.players.push(playerData);
    socket.join(roomId);

    console.log(`[SOCKET] Jugador ${playerData.name} se unió a la sala ${roomId}`);

    // Notificar a todos en la sala
    io.to(roomId).emit('room_update', room);

    // Si la sala está llena, iniciar cuenta regresiva para comenzar
    if (room.players.length >= 2 && !room.started) {
      let countdown = 5;
      const interval = setInterval(() => {
        io.to(roomId).emit('game_countdown', { countdown });
        countdown--;
        if (countdown < 0) {
          clearInterval(interval);
          startGame(roomId);
        }
      }, 1000);
    }
  });

  // Evento del juego 3: Charco Rápido (Click a la mosca)
  socket.on('eat_fly', ({ roomId, flyId }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.started) return;

    const gameState = room.state;
    if (gameState.activeFly && gameState.activeFly.id === flyId && !gameState.activeFly.eaten) {
      gameState.activeFly.eaten = true;
      gameState.activeFly.eatenBy = socket.id;

      // Actualizar puntaje del jugador
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.score += 1;
      }

      io.to(roomId).emit('fly_eaten', {
        flyId,
        eatenBy: socket.id,
        playerName: player ? player.name : 'Un sapito',
        players: room.players,
      });

      // Generar la siguiente mosca o terminar
      setTimeout(() => {
        spawnFly(roomId);
      }, 1500);
    }
  });

  // Evento del juego 4: Carrera de Sapitos (Salto exitoso)
  socket.on('frog_jump', ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.started) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (player && !room.state.finished) {
      player.x += 10; // Avanzar 10% en la pista de carrera

      io.to(roomId).emit('race_progress', room.players);

      // Verificar si llegó a la meta (100%)
      if (player.x >= 100) {
        room.state.finished = true;
        room.state.winner = player;
        
        // Pagar el pozo total del juego al ganador
        const totalPrize = room.players.length * room.entryFee;
        const currentBalance = mockBalances.get(player.npub) || 0;
        mockBalances.set(player.npub, currentBalance + totalPrize);

        io.to(roomId).emit('game_over', {
          winner: player,
          prize: totalPrize,
          players: room.players,
        });

        // Eliminar sala después de 10 segundos
        setTimeout(() => {
          gameRooms.delete(roomId);
        }, 10000);
      }
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Jugador desconectado: ${socket.id}`);
    
    // Buscar si estaba en alguna sala
    for (const [roomId, room] of gameRooms.entries()) {
      const pIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (pIndex !== -1) {
        const removedPlayer = room.players[pIndex];
        room.players.splice(pIndex, 1);
        
        console.log(`[SOCKET] Jugador ${removedPlayer.name} abandonó la sala ${roomId}`);

        if (room.players.length === 0) {
          gameRooms.delete(roomId);
          console.log(`[SOCKET] Sala vacía ${roomId} eliminada`);
        } else {
          io.to(roomId).emit('room_update', room);
          
          if (room.started && room.players.length === 1 && !room.state.finished) {
            // El último jugador gana por abandono
            const lastPlayer = room.players[0];
            room.state.finished = true;
            room.state.winner = lastPlayer;

            const totalPrize = (room.players.length + 1) * room.entryFee;
            const currentBalance = mockBalances.get(lastPlayer.npub) || 0;
            mockBalances.set(lastPlayer.npub, currentBalance + totalPrize);

            io.to(roomId).emit('game_over', {
              winner: lastPlayer,
              prize: totalPrize,
              reason: 'Abandono de rivales',
              players: room.players,
            });
            
            setTimeout(() => {
              gameRooms.delete(roomId);
            }, 10000);
          }
        }
        break;
      }
    }
  });
});

// Funciones auxiliares para el inicio de juegos
function startGame(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  room.started = true;
  room.state = {
    startTime: Date.now(),
    finished: false,
    fliesEaten: 0,
    maxFlies: 10,
  };

  io.to(roomId).emit('game_start', room);

  if (room.gameId === 'fly_feast') {
    // Spawn de la primera mosca
    spawnFly(roomId);
  } else if (room.gameId === 'frog_race') {
    // Inicializar posiciones de carrera a 0
    room.players.forEach(p => p.x = 0);
    io.to(roomId).emit('race_progress', room.players);
  }
}

function spawnFly(roomId) {
  const room = gameRooms.get(roomId);
  if (!room || room.state.finished) return;

  const gameState = room.state;

  if (gameState.fliesEaten >= gameState.maxFlies) {
    // Terminar juego, el que tiene más score gana el pozo
    gameState.finished = true;
    
    // Encontrar ganador
    let winner = room.players[0];
    let draw = false;
    for (let i = 1; i < room.players.length; i++) {
      if (room.players[i].score > winner.score) {
        winner = room.players[i];
        draw = false;
      } else if (room.players[i].score === winner.score) {
        draw = true;
      }
    }

    const totalPrize = room.players.length * room.entryFee;
    
    if (!draw && winner) {
      const currentBalance = mockBalances.get(winner.npub) || 0;
      mockBalances.set(winner.npub, currentBalance + totalPrize);
    }

    io.to(roomId).emit('game_over', {
      winner: draw ? null : winner,
      prize: totalPrize,
      draw,
      players: room.players,
    });

    setTimeout(() => {
      gameRooms.delete(roomId);
    }, 10000);
    return;
  }

  gameState.fliesEaten++;
  gameState.activeFly = {
    id: `fly_${gameState.fliesEaten}`,
    x: 10 + Math.random() * 80, // Coordenadas de porcentaje
    y: 20 + Math.random() * 60,
    type: Math.random() > 0.8 ? 'golden' : 'normal',
    eaten: false,
  };

  io.to(roomId).emit('fly_spawn', gameState.activeFly);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[SERVER] Servidor corriendo en http://localhost:${PORT}`);
});
