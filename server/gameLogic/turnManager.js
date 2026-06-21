const { createDeck, shuffle } = require('./deck');
const { isValidPlay } = require('./validator');

/**
 * Initializes a game room state.
 */
function startGame(players) {
  if (players.length < 2) {
    throw new Error('Need at least 2 players to start game');
  }

  let deck = shuffle(createDeck());
  const discardPile = [];
  
  // Deal 7 cards to each player
  const playerStates = players.map(p => ({
    id: p.id,
    name: p.name,
    cards: [],
    unoDeclared: false,
    disconnected: false,
    disconnectTimeout: null,
    isBot: p.isBot || false
  }));

  for (let i = 0; i < 7; i++) {
    for (const player of playerStates) {
      player.cards.push(deck.pop());
    }
  }

  // Draw starting card (must be a normal number color card for clean start)
  let startingCard = deck.pop();
  while (startingCard.color === 'Wild' || startingCard.type !== 'number') {
    deck.unshift(startingCard);
    deck = shuffle(deck);
    startingCard = deck.pop();
  }

  discardPile.push(startingCard);

  return {
    players: playerStates,
    deck,
    discardPile,
    topCard: startingCard,
    currentColor: startingCard.color,
    currentTurn: playerStates[0].id,
    direction: 1, // 1 for clockwise, -1 for counter-clockwise
    penaltyAccumulator: 0,
    penaltyCardType: null,
    gameStatus: 'playing',
    winner: null,
    lastPlayTime: Date.now()
  };
}

/**
 * Helper to draw card(s) safely from deck, reshuffling discard pile if empty.
 */
function drawCardsFromDeck(roomState, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (roomState.deck.length === 0) {
      if (roomState.discardPile.length <= 1) {
        break; // No more cards available
      }
      const top = roomState.discardPile.pop();
      roomState.deck = shuffle(roomState.discardPile);
      roomState.discardPile = [top];
    }
    drawn.push(roomState.deck.pop());
  }
  return drawn;
}

/**
 * Advances the turn to the next player.
 */
function advanceTurn(roomState, steps = 1) {
  const { players, currentTurn, direction } = roomState;
  
  // Get active players (not AFK or fully disconnected, but skip disconnected ones temporarily)
  const activePlayers = players;
  const currentIndex = activePlayers.findIndex(p => p.id === currentTurn);
  
  if (currentIndex === -1) return;

  const nextIndex = (currentIndex + steps * direction + activePlayers.length * steps) % activePlayers.length;
  roomState.currentTurn = activePlayers[nextIndex].id;
  roomState.lastPlayTime = Date.now();
}

/**
 * Handles playing a card.
 */
function playCard(roomState, playerId, cardId, chosenColor = null) {
  if (roomState.gameStatus !== 'playing') {
    throw new Error('Game is not in playing state');
  }

  if (roomState.currentTurn !== playerId) {
    throw new Error('Not your turn');
  }

  const player = roomState.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error('Player not found in room');
  }

  const cardIndex = player.cards.findIndex(c => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error('Card not in hand');
  }

  const card = player.cards[cardIndex];

  // Validate the play using current validator logic
  if (!isValidPlay(card, roomState.topCard, roomState.currentColor, roomState.penaltyAccumulator, roomState.penaltyCardType)) {
    throw new Error('Invalid play: Card does not match color/value or stack requirement');
  }

  // Remove card from player hand
  player.cards.splice(cardIndex, 1);
  roomState.discardPile.push(card);
  roomState.topCard = card;

  // Reset player's UNO status if they didn't call it correctly
  if (player.cards.length > 1) {
    player.unoDeclared = false;
  }

  // Set color: for Wilds it's chosenColor, otherwise the card's native color
  if (card.color === 'Wild') {
    if (!chosenColor || !['Red', 'Blue', 'Yellow', 'Green'].includes(chosenColor)) {
      // If color not selected, server defaults or throws (we throw to force frontend choice)
      throw new Error('Color choice required for Wild card');
    }
    roomState.currentColor = chosenColor;
  } else {
    roomState.currentColor = card.color;
  }

  // Handle Win Condition
  if (player.cards.length === 0) {
    roomState.gameStatus = 'finished';
    roomState.winner = player;
    return roomState;
  }

  // Resolve Card Effects & Turn Advancement
  let stepsToAdvance = 1;

  if (card.type === 'number') {
    // Normal card
    advanceTurn(roomState, stepsToAdvance);
  } else if (card.type === 'skip') {
    // Skip next player
    stepsToAdvance = 2;
    advanceTurn(roomState, stepsToAdvance);
  } else if (card.type === 'reverse') {
    // Reverse direction
    if (roomState.players.length === 2) {
      // In 2-player game, Reverse works like Skip
      stepsToAdvance = 2;
    } else {
      roomState.direction *= -1;
      stepsToAdvance = 1;
    }
    advanceTurn(roomState, stepsToAdvance);
  } else if (card.type === 'draw2') {
    roomState.penaltyAccumulator += 2;
    roomState.penaltyCardType = 'draw2';
    advanceTurn(roomState, stepsToAdvance);
  } else if (card.type === 'wild') {
    advanceTurn(roomState, stepsToAdvance);
  } else if (card.type === 'wild4') {
    roomState.penaltyAccumulator += 4;
    roomState.penaltyCardType = 'wild4';
    advanceTurn(roomState, stepsToAdvance);
  }

  return roomState;
}

/**
 * Handles drawing a card.
 */
function drawCard(roomState, playerId) {
  if (roomState.gameStatus !== 'playing') {
    throw new Error('Game is not playing');
  }

  if (roomState.currentTurn !== playerId) {
    throw new Error('Not your turn');
  }

  const player = roomState.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error('Player not found');
  }

  // If there's a penalty stack, player must draw all of them and lose turn
  if (roomState.penaltyAccumulator > 0) {
    const drawn = drawCardsFromDeck(roomState, roomState.penaltyAccumulator);
    player.cards.push(...drawn);
    roomState.penaltyAccumulator = 0;
    roomState.penaltyCardType = null;
    player.unoDeclared = false;
    advanceTurn(roomState);
    return { roomState, drawn };
  }

  // Normal turn draw (draws 1 card)
  const drawn = drawCardsFromDeck(roomState, 1);
  if (drawn.length > 0) {
    player.cards.push(drawn[0]);
    player.unoDeclared = false;
    
    // Check if drawn card is playable immediately
    const playable = isValidPlay(
      drawn[0], 
      roomState.topCard, 
      roomState.currentColor, 
      0, 
      null
    );

    if (playable) {
      // Send drawn card back, but don't advance turn yet (let them play or pass)
      // We will have a 'pass' event or let them play the card
      return { roomState, drawn, canPlayDrawn: true };
    }
  }

  // If not playable or deck is empty, advance turn
  advanceTurn(roomState);
  return { roomState, drawn, canPlayDrawn: false };
}

/**
 * Allows a player to manually pass after drawing a playable card.
 */
function passTurn(roomState, playerId) {
  if (roomState.currentTurn !== playerId) {
    throw new Error('Not your turn');
  }
  advanceTurn(roomState);
  return roomState;
}

/**
 * Declares UNO for a player (safeguard before playing second-to-last card).
 */
function declareUno(roomState, playerId) {
  const player = roomState.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error('Player not found');
  }

  // Standard UNO rule: can declare UNO if hand has 2 cards (so after play it will have 1 card)
  // or if they have 1 card left and want to be safe before anyone reports them
  if (player.cards.length <= 2) {
    player.unoDeclared = true;
  }
  return roomState;
}

/**
 * Report a player who has 1 card left and didn't call UNO.
 */
function reportNoUno(roomState, reporterId, targetPlayerId) {
  const target = roomState.players.find(p => p.id === targetPlayerId);
  if (!target) {
    throw new Error('Target player not found');
  }

  // If target player has exactly 1 card and has not declared UNO, they get penalized 2 cards
  if (target.cards.length === 1 && !target.unoDeclared) {
    const drawn = drawCardsFromDeck(roomState, 2);
    target.cards.push(...drawn);
    // Mark them safe now so they don't get reported again immediately
    target.unoDeclared = true;
    return { roomState, target, success: true, drawnCount: drawn.length };
  }

  return { roomState, target, success: false, drawnCount: 0 };
}

module.exports = {
  startGame,
  playCard,
  drawCard,
  passTurn,
  declareUno,
  reportNoUno,
  advanceTurn
};
