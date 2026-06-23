const validator = require('./validator');
const turnManager = require('./turnManager');

/**
 * Calculates the best color to declare for a Wild card.
 * Counts the color distribution in the bot's hand and returns the majority color.
 */
function chooseBestColor(cards) {
  const colorCounts = { Red: 0, Blue: 0, Green: 0, Yellow: 0 };
  cards.forEach(c => {
    if (colorCounts[c.color] !== undefined) colorCounts[c.color]++;
  });

  let maxCount = -1;
  let bestColor = 'Red';
  for (const [col, count] of Object.entries(colorCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestColor = col;
    }
  }
  return bestColor;
}

/**
 * Executes a single move for a bot player.
 * Updates and returns the new roomState.
 */
function makeBotMove(roomState, botId, forceUnoSuccess = null) {
  // Deep clone roomState to ensure pure function behavior
  const state = JSON.parse(JSON.stringify(roomState));

  if (state.gameStatus !== 'playing') {
    return { roomState: state };
  }

  const botState = state.players.find(p => p.id === botId);
  if (!botState) {
    return { roomState: state };
  }

  // Handle pending challenge if the bot is the challenger
  if (state.challenge) {
    if (state.challenge.challengerId === botId) {
      const shouldChallenge = Math.random() < 0.35; // 35% chance to challenge
      let updatedState;
      let actionResult;
      if (shouldChallenge) {
        updatedState = turnManager.executeChallenge(state, botId);
        actionResult = 'challenge_execute';
      } else {
        updatedState = turnManager.acceptChallenge(state, botId);
        actionResult = 'challenge_accept';
      }
      return {
        action: actionResult,
        challengeSuccess: updatedState.challengeSuccess,
        roomState: updatedState
      };
    } else {
      // A challenge is pending for someone else, the bot cannot play.
      return { roomState: state };
    }
  }

  const playableCards = botState.cards.filter(card =>
    validator.isValidPlay(card, state.topCard, state.currentColor, state.penaltyAccumulator, state.penaltyCardType)
  );

  let action = null; // 'play', 'draw_play', 'draw_pass'
  let cardPlayed = null;
  let cardDrawn = null;
  let chosenColor = null;
  let unoDeclared = false;

  if (playableCards.length > 0) {
    // Play the first playable card
    const cardToPlay = playableCards[0];
    if (cardToPlay.color === 'Wild') {
      chosenColor = chooseBestColor(botState.cards);
    }

    action = 'play';
    cardPlayed = cardToPlay;
    
    // Play the card
    const updatedState = turnManager.playCard(state, botState.id, cardToPlay.id, chosenColor);
    
    // Determine UNO declaration
    // Find player in the updated state to set declaration
    const updatedBot = updatedState.players.find(p => p.id === botId);
    if (updatedBot && updatedBot.cards.length === 1) {
      const success = forceUnoSuccess !== null ? forceUnoSuccess : (Math.random() < 0.9);
      if (success) {
        updatedBot.unoDeclared = true;
        unoDeclared = true;
      } else {
        updatedBot.unoDeclared = false;
        unoDeclared = false;
      }
    }

    return {
      action,
      cardPlayed,
      chosenColor,
      unoDeclared,
      roomState: updatedState
    };
  } else {
    // Draw a card
    const result = turnManager.drawCard(state, botState.id);
    let updatedState = result.roomState;
    const drawn = result.drawn;

    if (drawn.length > 0) {
      cardDrawn = drawn[0];
      if (result.canPlayDrawn) {
        action = 'draw_play';
        cardPlayed = cardDrawn;
        if (cardDrawn.color === 'Wild') {
          // Note: drawn card is already in the hand of the bot in result.roomState
          // So best color count includes it
          const updatedBot = updatedState.players.find(p => p.id === botId);
          chosenColor = chooseBestColor(updatedBot ? updatedBot.cards : []);
        }

        updatedState = turnManager.playCard(updatedState, botState.id, cardDrawn.id, chosenColor);

        const updatedBot = updatedState.players.find(p => p.id === botId);
        if (updatedBot && updatedBot.cards.length === 1) {
          updatedBot.unoDeclared = true;
          unoDeclared = true;
        }
      } else {
        action = 'draw_pass';
      }
    } else {
      action = 'draw_pass'; // Deck was empty, turn advanced
    }

    return {
      action,
      cardDrawn,
      cardPlayed,
      chosenColor,
      unoDeclared,
      roomState: updatedState
    };
  }
}

module.exports = {
  makeBotMove,
  chooseBestColor
};
