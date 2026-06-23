require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const store = require('./redis/store');
const {
  startGame,
  playCard,
  drawCard,
  passTurn,
  declareUno,
  reportNoUno,
  advanceTurn,
  acceptChallenge,
  executeChallenge
} = require('./gameLogic/turnManager');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve static client assets in production
app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', time: new Date() });
});

// Fallback all other client GET requests to index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Fun Name Generator Lists
const adjectives = ['Brave', 'Swift', 'Happy', 'Silly', 'Sleepy', 'Golden', 'Clever', 'Jolly', 'Chill', 'Mystic', 'Neon', 'Frosty', 'Cosmic', 'Wild', 'Shadow'];
const animals = ['Panda', 'Falcon', 'Otter', 'Koala', 'Fox', 'Owl', 'Badger', 'Dolphin', 'Sloth', 'Tiger', 'Llama', 'Penguin', 'Squirrel', 'Gecko', 'Raven'];

function generateGuestName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10 to 99
  return `${adj}${animal}${num}`;
}

const botNames = [
  'RoboPanda 🤖', 'CyberFalcon 🤖', 'MetalOtter 🤖', 'ByteKoala 🤖', 
  'C3PO_Llama 🤖', 'AlphaGecko 🤖', 'T800_Tiger 🤖', 'HAL_Penguin 🤖',
  'RoboSloth 🤖', 'CyberGecko 🤖', 'VectorFox 🤖', 'PixelOtter 🤖'
];

function generateBotName(existingPlayers) {
  const available = botNames.filter(name => !existingPlayers.some(p => p.name === name));
  if (available.length === 0) {
    return `RoboGuest${Math.floor(Math.random() * 90) + 10} 🤖`;
  }
  return available[Math.floor(Math.random() * available.length)];
}

// Stores timeouts for disconnected players (roomCode -> userId -> timeoutRef)
const disconnectTimeouts = new Map();

// Helper to sanitize room state for clients (never send full hands of other players)
function sanitizeRoomState(roomState, targetPlayerId) {
  if (!roomState) return null;

  return {
    roomCode: roomState.roomCode,
    hostId: roomState.hostId,
    gameStatus: roomState.gameStatus,
    topCard: roomState.topCard,
    currentColor: roomState.currentColor,
    currentTurn: roomState.currentTurn,
    direction: roomState.direction,
    penaltyAccumulator: roomState.penaltyAccumulator,
    penaltyCardType: roomState.penaltyCardType,
    challenge: roomState.challenge,
    challengeSuccess: roomState.challengeSuccess,
    lastChallengeResult: roomState.lastChallengeResult,
    winner: roomState.winner ? { id: roomState.winner.id, name: roomState.winner.name } : null,
    players: roomState.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.cards.length,
      unoDeclared: p.unoDeclared,
      disconnected: p.disconnected,
      isBot: p.isBot,
      // Only include hand if it's the requesting player
      cards: p.id === targetPlayerId ? p.cards : undefined
    })),
    deckCount: roomState.deck.length,
    discardCount: roomState.discardPile.length
  };
}

// Broadcast room state to everyone individually so they only see their own hands
async function broadcastRoomUpdate(roomCode) {
  const room = await store.getRoom(roomCode);
  if (!room) return;

  const socketsInRoom = await io.in(`room:${roomCode}`).fetchSockets();
  for (const socket of socketsInRoom) {
    const user = await store.getUser(socket.id);
    if (user) {
      socket.emit('roomUpdated', sanitizeRoomState(room, user.id));
    }
  }
}

// System chat helper
async function sendSystemMessage(roomCode, text) {
  io.to(`room:${roomCode}`).emit('newMessage', {
    senderId: 'system',
    senderName: 'System 🤖',
    text,
    timestamp: Date.now()
  });
}

const botMoveTimers = new Map();

async function triggerBotMoveIfActive(roomCode) {
  const room = await store.getRoom(roomCode);
  if (!room || room.gameStatus !== 'playing') return;

  const currentPlayer = room.players.find(p => p.id === room.currentTurn);
  if (!currentPlayer || !currentPlayer.isBot) return;

  console.log(`Bot's turn: ${currentPlayer.name} (id: ${currentPlayer.id}) in room ${roomCode}`);

  if (botMoveTimers.has(roomCode)) {
    clearTimeout(botMoveTimers.get(roomCode));
  }

  const timer = setTimeout(async () => {
    let currentRoom = await store.getRoom(roomCode);
    if (!currentRoom || currentRoom.gameStatus !== 'playing' || currentRoom.currentTurn !== currentPlayer.id) {
      return;
    }

    const botAI = require('./gameLogic/botAI');

    try {
      const decision = botAI.makeBotMove(currentRoom, currentPlayer.id);
      currentRoom = decision.roomState;

      if (decision.action === 'play') {
        const cardName = `${decision.cardPlayed.color === 'Wild' ? '' : decision.cardPlayed.color} ${decision.cardPlayed.value}`;
        
        io.to(`room:${roomCode}`).emit('cardPlayed', {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          card: decision.cardPlayed
        });

        sendSystemMessage(roomCode, `${currentPlayer.name} played ${cardName}.`);

        if (decision.unoDeclared) {
          io.to(`room:${roomCode}`).emit('unoDeclaredEvent', { playerId: currentPlayer.id, name: currentPlayer.name });
          sendSystemMessage(roomCode, `📣 ${currentPlayer.name} declared UNO!`);
        } else {
          const updatedBot = currentRoom.players.find(p => p.id === currentPlayer.id);
          if (updatedBot && updatedBot.cards.length === 1) {
            sendSystemMessage(roomCode, `🤫 ${currentPlayer.name} forgot to call UNO!`);
          }
        }
      } else if (decision.action === 'draw_play') {
        const cardName = `${decision.cardPlayed.color === 'Wild' ? '' : decision.cardPlayed.color} ${decision.cardPlayed.value}`;
        
        sendSystemMessage(roomCode, `${currentPlayer.name} has no matching cards and draws a card.`);
        
        io.to(`room:${roomCode}`).emit('cardPlayed', {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          card: decision.cardPlayed
        });

        sendSystemMessage(roomCode, `${currentPlayer.name} played the drawn ${cardName}.`);

        if (decision.unoDeclared) {
          io.to(`room:${roomCode}`).emit('unoDeclaredEvent', { playerId: currentPlayer.id, name: currentPlayer.name });
          sendSystemMessage(roomCode, `📣 ${currentPlayer.name} declared UNO!`);
        }
      } else if (decision.action === 'draw_pass') {
        sendSystemMessage(roomCode, `${currentPlayer.name} has no matching cards and draws a card.`);
      } else if (decision.action === 'challenge_accept') {
        sendSystemMessage(roomCode, `${currentPlayer.name} accepted the +4 Draw and drew 4 cards.`);
      } else if (decision.action === 'challenge_execute') {
        const result = currentRoom.lastChallengeResult;
        if (result.success) {
          sendSystemMessage(roomCode, `🔍 CHALLENGE SUCCESSFUL! ${result.targetName} had a card matching the previous color! ${result.targetName} draws 4 cards as penalty.`);
        } else {
          sendSystemMessage(roomCode, `🔍 CHALLENGE FAILED! ${result.targetName} did not have a matching color card. ${currentPlayer.name} draws 6 cards and loses their turn.`);
        }
      }

      if (currentRoom.gameStatus === 'finished') {
        sendSystemMessage(roomCode, `🎉 ${currentRoom.winner.name} WINS the game!`);
      }

      await store.setRoom(roomCode, currentRoom);
      await broadcastRoomUpdate(roomCode);

      if (currentRoom.gameStatus === 'playing') {
        triggerBotMoveIfActive(roomCode);
      }
    } catch (err) {
      console.error(`Error executing bot turn in room ${roomCode}:`, err);
    }
  }, 1500);

  botMoveTimers.set(roomCode, timer);
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle Guest registration
  socket.on('registerGuest', async ({ guestId, name }) => {
    let finalGuestId = guestId;
    let finalName = name;

    // Check if guestId already exists in socket mappings (e.g. reconnecting)
    if (!finalGuestId) {
      finalGuestId = require('crypto').randomUUID();
    }
    
    if (!finalName) {
      finalName = generateGuestName();
    }

    const userData = { id: finalGuestId, name: finalName };
    await store.addUser(socket.id, userData);
    socket.emit('guestRegistered', userData);

    // Look if user was in a room and disconnected
    // Scan all rooms to see if this user is a player and marked disconnected
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      // In-Memory Scan
      for (const [roomCode, room] of store.rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === finalGuestId);
        if (playerIndex !== -1) {
          await handlePlayerReconnection(socket, roomCode, finalGuestId, room);
          break;
        }
      }
    } else {
      // Redis Scan: Since keys scanning can be slower in node-redis,
      // in production we could store user -> room associations.
      // Let's check user's previous room from a mapping if available.
      try {
        const roomCode = await store.redisClient.get(`user_room:${finalGuestId}`);
        if (roomCode) {
          const room = await store.getRoom(roomCode);
          if (room) {
            await handlePlayerReconnection(socket, roomCode, finalGuestId, room);
          }
        }
      } catch (err) {
        console.error('Redis scan reconnection error:', err);
      }
    }
  });

  async function handlePlayerReconnection(socket, roomCode, userId, room) {
    console.log(`Player ${userId} reconnecting to room ${roomCode}`);
    
    // Join room channel
    socket.join(`room:${roomCode}`);
    
    // Clear disconnect timeout if exists
    if (disconnectTimeouts.has(roomCode) && disconnectTimeouts.get(roomCode)[userId]) {
      clearTimeout(disconnectTimeouts.get(roomCode)[userId]);
      delete disconnectTimeouts.get(roomCode)[userId];
      if (Object.keys(disconnectTimeouts.get(roomCode)).length === 0) {
        disconnectTimeouts.delete(roomCode);
      }
    }

    // Set player back to active
    const player = room.players.find(p => p.id === userId);
    if (player) {
      player.disconnected = false;
      await store.setRoom(roomCode, room);
    }

    // Map user_room for Redis reconnection
    if (process.env.REDIS_URL) {
      await store.redisClient.setEx(`user_room:${userId}`, 7200, roomCode);
    }

    // Sync guest mapping
    await store.mapUserIdToSocket(userId, socket.id);

    sendSystemMessage(roomCode, `${player ? player.name : 'A player'} has reconnected!`);
    await broadcastRoomUpdate(roomCode);
  }

  // Create Room
  socket.on('createRoom', async () => {
    const user = await store.getUser(socket.id);
    if (!user) return socket.emit('error', 'Guest registration needed');

    // Generate room code (alphanumeric, 6 chars)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomCode = '';
    for (let i = 0; i < 6; i++) {
      roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check collision (very rare, but check)
    let collision = await store.getRoom(roomCode);
    while (collision) {
      roomCode = '';
      for (let i = 0; i < 6; i++) {
        roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      collision = await store.getRoom(roomCode);
    }

    const roomState = {
      roomCode,
      hostId: user.id,
      players: [{
        id: user.id,
        name: user.name,
        cards: [],
        unoDeclared: false,
        disconnected: false
      }],
      deck: [],
      discardPile: [],
      topCard: null,
      currentColor: null,
      currentTurn: null,
      direction: 1,
      penaltyAccumulator: 0,
      penaltyCardType: null,
      gameStatus: 'waiting',
      winner: null
    };

    await store.setRoom(roomCode, roomState);
    if (process.env.REDIS_URL) {
      await store.redisClient.setEx(`user_room:${user.id}`, 7200, roomCode);
    }

    socket.join(`room:${roomCode}`);
    console.log(`Room created: ${roomCode} by host: ${user.name}`);
    await broadcastRoomUpdate(roomCode);
  });

  // Join Room
  socket.on('joinRoom', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return socket.emit('error', 'Guest registration needed');

    const code = roomCode.toUpperCase();
    const room = await store.getRoom(code);
    if (!room) return socket.emit('error', 'Room not found');

    // If player is already in room (for some reason they joined twice, or reconnect)
    const exists = room.players.find(p => p.id === user.id);
    if (exists) {
      socket.join(`room:${code}`);
      exists.disconnected = false;
      await store.setRoom(code, room);
      await broadcastRoomUpdate(code);
      return;
    }

    if (room.gameStatus !== 'waiting') {
      return socket.emit('error', 'Game in progress');
    }

    if (room.players.length >= 5) {
      return socket.emit('error', 'Room is full (max 5 players)');
    }

    room.players.push({
      id: user.id,
      name: user.name,
      cards: [],
      unoDeclared: false,
      disconnected: false
    });

    await store.setRoom(code, room);
    if (process.env.REDIS_URL) {
      await store.redisClient.setEx(`user_room:${user.id}`, 7200, code);
    }

    socket.join(`room:${code}`);
    console.log(`Player ${user.name} joined room ${code}`);

    sendSystemMessage(code, `${user.name} joined the room!`);
    await broadcastRoomUpdate(code);
  });

  // Leave Room
  socket.on('leaveRoom', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    const code = roomCode.toUpperCase();
    const room = await store.getRoom(code);
    if (!room) return;

    const index = room.players.findIndex(p => p.id === user.id);
    if (index !== -1) {
      room.players.splice(index, 1);

      if (process.env.REDIS_URL) {
        await store.redisClient.del(`user_room:${user.id}`);
      }

      socket.leave(`room:${code}`);
      console.log(`Player ${user.name} left room ${code}`);
      
      sendSystemMessage(code, `${user.name} left the room.`);

      if (room.players.length === 0) {
        await store.deleteRoom(code);
        console.log(`Room ${code} deleted because it is empty`);
      } else {
        // Transfer host if necessary
        if (room.hostId === user.id) {
          room.hostId = room.players[0].id;
          sendSystemMessage(code, `${room.players[0].name} is now the host.`);
        }

        // Advance turn if game in progress and it was their turn
        if (room.gameStatus === 'playing' && room.currentTurn === user.id) {
          if (room.players.length < 2) {
            room.gameStatus = 'finished';
            room.winner = room.players[0];
            sendSystemMessage(code, `Game ended. Not enough players. ${room.winner.name} wins by default!`);
          } else {
            advanceTurn(room);
          }
        }

        await store.setRoom(code, room);
        await broadcastRoomUpdate(code);
        triggerBotMoveIfActive(code);
      }
    }

    socket.emit('leftRoom');
  });

  // Add AI Bot Player
  socket.on('addBot', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    const code = roomCode.toUpperCase();
    const room = await store.getRoom(code);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.hostId !== user.id) return socket.emit('error', 'Only host can add bots');
    if (room.gameStatus !== 'waiting') return socket.emit('error', 'Cannot add bots during active game');
    if (room.players.length >= 5) return socket.emit('error', 'Room is full (max 5 players)');

    const botId = `bot-${require('crypto').randomUUID()}`;
    const botName = generateBotName(room.players);

    room.players.push({
      id: botId,
      name: botName,
      cards: [],
      unoDeclared: false,
      disconnected: false,
      isBot: true
    });

    await store.setRoom(code, room);
    sendSystemMessage(code, `${botName} was added to the room.`);
    await broadcastRoomUpdate(code);
  });

  // Remove AI Bot Player
  socket.on('removeBot', async ({ roomCode, botId }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    const code = roomCode.toUpperCase();
    const room = await store.getRoom(code);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.hostId !== user.id) return socket.emit('error', 'Only host can remove bots');
    if (room.gameStatus !== 'waiting') return socket.emit('error', 'Cannot remove bots during active game');

    const botIndex = room.players.findIndex(p => p.id === botId && p.isBot);
    if (botIndex !== -1) {
      const botName = room.players[botIndex].name;
      room.players.splice(botIndex, 1);
      await store.setRoom(code, room);
      sendSystemMessage(code, `${botName} was removed from the room.`);
      await broadcastRoomUpdate(code);
    }
  });

  // Start Game
  socket.on('startGame', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return socket.emit('error', 'Unauthenticated');

    const room = await store.getRoom(roomCode);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.hostId !== user.id) return socket.emit('error', 'Only host can start the game');
    if (room.players.length < 2) return socket.emit('error', 'Need at least 2 players to start');

    try {
      const initializedState = startGame(room.players);
      initializedState.roomCode = room.roomCode;
      initializedState.hostId = room.hostId;
      
      await store.setRoom(roomCode, initializedState);
      io.to(`room:${roomCode}`).emit('gameStarted');
      sendSystemMessage(roomCode, 'The game has started! Good luck!');
      await broadcastRoomUpdate(roomCode);
      triggerBotMoveIfActive(roomCode);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Play Card
  socket.on('playCard', async ({ roomCode, cardId, chosenColor }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    let room = await store.getRoom(roomCode);
    if (!room) return;

    try {
      const player = room.players.find(p => p.id === user.id);
      const card = player.cards.find(c => c.id === cardId);
      const cardName = card ? `${card.color === 'Wild' ? '' : card.color} ${card.value}` : 'a card';

      room = playCard(room, user.id, cardId, chosenColor);
      await store.setRoom(roomCode, room);

      // Emit played event for animations
      io.to(`room:${roomCode}`).emit('cardPlayed', {
        playerId: user.id,
        playerName: user.name,
        card
      });

      sendSystemMessage(roomCode, `${user.name} played ${cardName}.`);

      if (room.gameStatus === 'finished') {
        sendSystemMessage(roomCode, `🎉 ${room.winner.name} WINS the game!`);
      } else {
        // If player has exactly 1 card left, and they declared UNO prior to playing, announce it
        if (player.cards.length === 1 && player.unoDeclared) {
          io.to(`room:${roomCode}`).emit('unoAnnounced', { playerId: user.id, name: user.name });
          sendSystemMessage(roomCode, `📣 ${user.name} declared UNO!`);
        }
      }

      await broadcastRoomUpdate(roomCode);
      triggerBotMoveIfActive(roomCode);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Draw Card
  socket.on('drawCard', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    let room = await store.getRoom(roomCode);
    if (!room) return;

    try {
      const result = drawCard(room, user.id);
      room = result.roomState;
      await store.setRoom(roomCode, room);

      if (result.drawn.length > 0) {
        socket.emit('cardDrawnPrivate', { card: result.drawn[0], canPlayDrawn: result.canPlayDrawn });
        
        const count = result.drawn.length;
        sendSystemMessage(roomCode, `${user.name} drew ${count} card${count > 1 ? 's' : ''}.`);
      }

      await broadcastRoomUpdate(roomCode);
      triggerBotMoveIfActive(roomCode);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Pass Turn (after drawing playable card but choosing not to play)
  socket.on('passTurn', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    let room = await store.getRoom(roomCode);
    if (!room) return;

    try {
      room = passTurn(room, user.id);
      await store.setRoom(roomCode, room);
      sendSystemMessage(roomCode, `${user.name} passed.`);
      await broadcastRoomUpdate(roomCode);
      triggerBotMoveIfActive(roomCode);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Declare UNO
  socket.on('declareUno', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    let room = await store.getRoom(roomCode);
    if (!room) return;

    try {
      room = declareUno(room, user.id);
      await store.setRoom(roomCode, room);
      
      // Notify everyone
      io.to(`room:${roomCode}`).emit('unoDeclaredEvent', { playerId: user.id, name: user.name });
      sendSystemMessage(roomCode, `📣 ${user.name} pre-declared UNO!`);
      
      await broadcastRoomUpdate(roomCode);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Report No UNO
  socket.on('reportNoUno', async ({ roomCode, targetPlayerId }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    let room = await store.getRoom(roomCode);
    if (!room) return;

    try {
      const result = reportNoUno(room, user.id, targetPlayerId);
      room = result.roomState;
      await store.setRoom(roomCode, room);

      if (result.success) {
        sendSystemMessage(roomCode, `🚨 ${user.name} caught ${result.target.name} with 1 card and no UNO call! ${result.target.name} draws 2 cards!`);
        await broadcastRoomUpdate(roomCode);
      } else {
        socket.emit('error', 'That player cannot be reported.');
      }
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Accept Draw Four Challenge
  socket.on('acceptChallenge', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    let room = await store.getRoom(roomCode);
    if (!room) return;

    try {
      room = acceptChallenge(room, user.id);
      await store.setRoom(roomCode, room);

      sendSystemMessage(roomCode, `${user.name} accepted the +4 Draw and drew 4 cards.`);
      await broadcastRoomUpdate(roomCode);
      triggerBotMoveIfActive(roomCode);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Execute Draw Four Challenge
  socket.on('executeChallenge', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    let room = await store.getRoom(roomCode);
    if (!room) return;

    try {
      const challengerName = user.name;
      const targetPlayer = room.players.find(p => p.id === room.challenge.targetId);
      const targetName = targetPlayer ? targetPlayer.name : 'Target';

      room = executeChallenge(room, user.id);
      await store.setRoom(roomCode, room);

      const result = room.lastChallengeResult;
      if (result.success) {
        sendSystemMessage(roomCode, `🔍 CHALLENGE SUCCESSFUL! ${targetName} had a card matching the previous color! ${targetName} draws 4 cards as penalty.`);
      } else {
        sendSystemMessage(roomCode, `🔍 CHALLENGE FAILED! ${targetName} did not have a matching color card. ${challengerName} draws 6 cards and loses their turn.`);
      }

      await broadcastRoomUpdate(roomCode);
      triggerBotMoveIfActive(roomCode);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Chat message
  socket.on('sendMessage', async ({ roomCode, text }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    io.to(`room:${roomCode}`).emit('newMessage', {
      senderId: user.id,
      senderName: user.name,
      text,
      timestamp: Date.now()
    });
  });

  // Emoji Reactions (displays floating animations over cards)
  socket.on('sendReaction', async ({ roomCode, emoji }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    io.to(`room:${roomCode}`).emit('newReaction', {
      senderId: user.id,
      senderName: user.name,
      emoji,
      timestamp: Date.now()
    });
  });

  // Reset Room (to play again / end game)
  socket.on('resetRoom', async ({ roomCode }) => {
    const user = await store.getUser(socket.id);
    if (!user) return;

    const room = await store.getRoom(roomCode);
    if (!room) return;

    // Check if user is the host
    if (room.hostId !== user.id) {
      return socket.emit('error', 'Only the host can reset the room or end the game');
    }

    // Reset room state
    room.gameStatus = 'waiting';
    room.deck = [];
    room.discardPile = [];
    room.topCard = null;
    room.currentColor = null;
    room.currentTurn = null;
    room.direction = 1;
    room.penaltyAccumulator = 0;
    room.penaltyCardType = null;
    room.winner = null;
    
    // Clear hands
    room.players.forEach(p => {
      p.cards = [];
      p.unoDeclared = false;
    });

    await store.setRoom(roomCode, room);
    sendSystemMessage(roomCode, 'Room reset by host. Ready for next game!');
    await broadcastRoomUpdate(roomCode);
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const user = await store.getUser(socket.id);
    if (!user) return;

    // Scan rooms to check if user was in a room
    // Find room the user is in
    let userRoomCode = null;
    let room = null;

    if (process.env.REDIS_URL) {
      try {
        userRoomCode = await store.redisClient.get(`user_room:${user.id}`);
        if (userRoomCode) {
          room = await store.getRoom(userRoomCode);
        }
      } catch (err) {
        console.error('Redis scan on disconnect error:', err);
      }
    } else {
      for (const [code, r] of store.rooms.entries()) {
        if (r.players.some(p => p.id === user.id)) {
          userRoomCode = code;
          room = r;
          break;
        }
      }
    }

    if (room && userRoomCode) {
      const player = room.players.find(p => p.id === user.id);
      if (player) {
        // Mark player disconnected
        player.disconnected = true;
        await store.setRoom(userRoomCode, room);

        sendSystemMessage(userRoomCode, `${user.name} disconnected. 60s grace period to reconnect...`);
        await broadcastRoomUpdate(userRoomCode);

        // Start 60-second grace period timer
        if (!disconnectTimeouts.has(userRoomCode)) {
          disconnectTimeouts.set(userRoomCode, {});
        }

        disconnectTimeouts.get(userRoomCode)[user.id] = setTimeout(async () => {
          // Check if player still disconnected
          const currentRoom = await store.getRoom(userRoomCode);
          if (currentRoom) {
            const index = currentRoom.players.findIndex(p => p.id === user.id);
            if (index !== -1 && currentRoom.players[index].disconnected) {
              // Remove them from room
              currentRoom.players.splice(index, 1);
              
              sendSystemMessage(userRoomCode, `${user.name} has been removed due to inactivity.`);

              // If room is empty, delete it
              if (currentRoom.players.length === 0) {
                await store.deleteRoom(userRoomCode);
                console.log(`Room ${userRoomCode} deleted because it was left empty`);
              } else {
                // If Host disconnected, transfer host
                if (currentRoom.hostId === user.id) {
                  currentRoom.hostId = currentRoom.players[0].id;
                  sendSystemMessage(userRoomCode, `${currentRoom.players[0].name} is now the host.`);
                }

                // If game was playing and it was their turn, advance turn
                if (currentRoom.gameStatus === 'playing' && currentRoom.currentTurn === user.id) {
                  if (currentRoom.players.length < 2) {
                    currentRoom.gameStatus = 'finished';
                    currentRoom.winner = currentRoom.players[0];
                    sendSystemMessage(userRoomCode, `Game ended. Not enough players. ${currentRoom.winner.name} wins by default!`);
                  } else {
                    advanceTurn(currentRoom);
                  }
                }

                await store.setRoom(userRoomCode, currentRoom);
                await broadcastRoomUpdate(userRoomCode);
                triggerBotMoveIfActive(userRoomCode);
              }
            }
          }

          // Clean up reference
          if (disconnectTimeouts.has(userRoomCode)) {
            delete disconnectTimeouts.get(userRoomCode)[user.id];
            if (Object.keys(disconnectTimeouts.get(userRoomCode)).length === 0) {
              disconnectTimeouts.delete(userRoomCode);
            }
          }
        }, 60000);
      }
    }

    // Remove socket mapping
    await store.removeUser(socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
  await store.connect();
  console.log(`UNO Server listening on port ${PORT}`);
});
