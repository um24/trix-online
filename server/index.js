const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const contracts = ['Queens', 'King of Hearts', 'Diamonds', 'Slaps', 'Trix'];
const rooms = {};

io.on('connection', (socket) => {
  socket.on('create-room', ({ nickname }) => {
    const roomID = generateRoomID();
    rooms[roomID] = {
      owner: socket.id,
      players: [{ id: socket.id, nickname }],
      hands: {},
      scores: { [socket.id]: 0 },
      contractIndex: 0,
      currentContract: null,
      currentTurn: null,
      playedCards: [],
      tricks: [],
      doubles: {},
      contractOrder: [],
      currentKingdom: 0,
    };
    socket.join(roomID);
    socket.emit('room-created', roomID);
    io.to(roomID).emit('update-players', rooms[roomID].players);
  });

  socket.on('join-room', ({ roomID, nickname }) => {
    const room = rooms[roomID];
    if (room && room.players.length < 4) {
      room.players.push({ id: socket.id, nickname });
      room.scores[socket.id] = 0;
      socket.join(roomID);
      socket.emit('joined-room', roomID);
      io.to(roomID).emit('update-players', room.players);
    } else {
      socket.emit('room-not-found');
    }
  });

  socket.on('start-game', (roomID) => {
    const room = rooms[roomID];
    if (!room || socket.id !== room.owner || room.players.length !== 4) return;
    room.currentKingdom = 0;
    room.contractOrder = room.players.map(p => p.id);
    askContractChoice(roomID);
  });

  socket.on('choose-contract', ({ roomID, contract, doubles }) => {
    const room = rooms[roomID];
    room.currentContract = contract;
    room.doubles = doubles || {};
    startContract(roomID);
  });

  socket.on('play-card', ({ roomID, card }) => {
    const room = rooms[roomID];
    if (!room || room.currentTurn !== socket.id) return;

    const hand = room.hands[socket.id];
    const index = hand.indexOf(card);
    if (index === -1) return;

    hand.splice(index, 1);
    room.playedCards.push({ playerId: socket.id, card });

    io.to(roomID).emit('card-played', { playerId: socket.id, card });

    if (room.playedCards.length === 4) {
      handleTrick(roomID);
    } else {
      nextTurn(roomID);
    }
  });

  socket.on('disconnect', () => {
    for (const roomID in rooms) {
      const room = rooms[roomID];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        delete room.hands[socket.id];
        delete room.scores[socket.id];
        io.to(roomID).emit('update-players', room.players);
        if (room.players.length === 0) delete rooms[roomID];
        break;
      }
    }
  });
});

function askContractChoice(roomID) {
  const room = rooms[roomID];
  const playerID = room.contractOrder[room.currentKingdom];
  io.to(roomID).emit('choose-contract-turn', playerID);
}

function startContract(roomID) {
  const room = rooms[roomID];
  room.playedCards = [];
  room.tricks = [];

  const deck = createDeck();
  shuffle(deck);

  room.players.forEach((p, i) => {
    room.hands[p.id] = deck.slice(i * 13, (i + 1) * 13);
  });

  room.currentTurn = room.players[0].id;

  io.to(roomID).emit('new-contract', {
    contract: room.currentContract,
    hands: room.hands,
    doubles: room.doubles,
  });

  io.to(roomID).emit('turn-changed', room.currentTurn);
}

function handleTrick(roomID) {
  const room = rooms[roomID];
  const played = room.playedCards;
  const winner = played[0].playerId;
  const contract = room.currentContract;
  let points = 0;

  played.forEach(({ card }) => {
    const [value, suit] = card.split('-');
    if (contract === 'Queens' && value === 'Q') points -= 25 * (room.doubles['Q'] ? 2 : 1);
    if (contract === 'King of Hearts' && card === 'K-H') points -= 75 * (room.doubles['K-H'] ? 2 : 1);
    if (contract === 'Diamonds' && suit === 'D') points -= 10;
    if (contract === 'Slaps') points -= 15;
  });

  room.scores[winner] += points;
  room.playedCards = [];
  room.tricks.push(played);

  if (room.hands[winner].length === 0) {
    room.contractIndex++;

    if (room.contractIndex >= 5) {
      room.contractIndex = 0;
      room.currentKingdom++;

      if (room.currentKingdom >= 4) {
        io.to(roomID).emit('game-ended', room.scores);
        return;
      }
    }

    io.to(roomID).emit('update-scores', room.scores);
    askContractChoice(roomID);
  } else {
    room.currentTurn = winner;
    io.to(roomID).emit('turn-changed', winner);
  }
}

function nextTurn(roomID) {
  const room = rooms[roomID];
  const idx = room.players.findIndex(p => p.id === room.currentTurn);
  room.currentTurn = room.players[(idx + 1) % 4].id;
  io.to(roomID).emit('turn-changed', room.currentTurn);
}

function generateRoomID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createDeck() {
  const suits = ['H', 'D', 'C', 'S'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return suits.flatMap(suit => values.map(value => `${value}-${suit}`));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

server.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
