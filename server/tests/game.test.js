const { createDeck } = require('../gameLogic/deck');
const { isValidPlay } = require('../gameLogic/validator');
const {
  startGame,
  playCard,
  drawCard,
  passTurn,
  declareUno,
  reportNoUno
} = require('../gameLogic/turnManager');

describe('UNO Deck Generation', () => {
  test('should generate a standard 108 card deck', () => {
    const deck = createDeck();
    expect(deck.length).toBe(108);
  });
});

describe('UNO Play Validator', () => {
  const blue5 = { id: '1', color: 'Blue', type: 'number', value: '5' };
  const blueSkip = { id: '2', color: 'Blue', type: 'skip', value: 'Skip' };
  const red5 = { id: '3', color: 'Red', type: 'number', value: '5' };
  const redSkip = { id: '4', color: 'Red', type: 'skip', value: 'Skip' };
  const wild = { id: '5', color: 'Wild', type: 'wild', value: 'Wild' };
  const wild4 = { id: '6', color: 'Wild', type: 'wild4', value: 'Wild4' };

  test('should validate color match', () => {
    expect(isValidPlay(blueSkip, blue5, 'Blue')).toBe(true);
    expect(isValidPlay(red5, blueSkip, 'Blue')).toBe(false); // different color and type
  });

  test('should validate number/symbol match', () => {
    expect(isValidPlay(red5, blue5, 'Blue')).toBe(true); // different color, same number (5 on 5)
    expect(isValidPlay(red5, blue5, 'Red')).toBe(true); // matches currentColor
    expect(isValidPlay(red5, blueSkip, 'Blue')).toBe(false); // different color and type
    
    // symbol match (e.g. skip on skip, regardless of color)
    expect(isValidPlay(redSkip, blueSkip, 'Blue')).toBe(true);
  });

  test('should allow playing Wild cards on anything', () => {
    expect(isValidPlay(wild, blue5, 'Blue')).toBe(true);
    expect(isValidPlay(wild4, blue5, 'Blue')).toBe(true);
  });

  test('should not restrict card selection based on penalty accumulator as stacking is disabled', () => {
    const draw2Card = { id: '7', color: 'Red', type: 'draw2', value: 'Draw2' };
    const anotherDraw2 = { id: '8', color: 'Blue', type: 'draw2', value: 'Draw2' };
    
    // Stacking is disabled, so normal matching rules apply
    expect(isValidPlay(anotherDraw2, draw2Card, 'Red', 0, null)).toBe(true);
    expect(isValidPlay(red5, draw2Card, 'Red', 0, null)).toBe(true);
  });
});

describe('UNO Turn Manager & Game Playthrough Flow', () => {
  let players;

  beforeEach(() => {
    players = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
      { id: 'u3', name: 'Charlie' }
    ];
  });

  test('should initialize game state with 7 cards per player', () => {
    const state = startGame(players);
    expect(state.gameStatus).toBe('playing');
    expect(state.players.length).toBe(3);
    expect(state.players[0].cards.length).toBe(7);
    expect(state.players[1].cards.length).toBe(7);
    expect(state.players[2].cards.length).toBe(7);
    expect(state.topCard).toBeDefined();
    expect(state.currentColor).toBe(state.topCard.color);
    expect(state.currentTurn).toBe('u1');
    expect(state.direction).toBe(1);
  });

  test('should progress turn on normal card play', () => {
    const state = startGame(players);
    
    // Give u1 a card that is guaranteed to match top color
    const matchCard = { id: 'test-match', color: state.currentColor, type: 'number', value: '9' };
    state.players[0].cards.push(matchCard);

    const updated = playCard(state, 'u1', 'test-match');
    expect(updated.topCard.id).toBe('test-match');
    expect(updated.currentTurn).toBe('u2'); // turn advances to next player
  });

  test('should handle Skip action card', () => {
    const state = startGame(players);
    
    // Give u1 a Skip card matching currentColor
    const skipCard = { id: 'test-skip', color: state.currentColor, type: 'skip', value: 'Skip' };
    state.players[0].cards.push(skipCard);

    const updated = playCard(state, 'u1', 'test-skip');
    expect(updated.currentTurn).toBe('u3'); // Bob (u2) is skipped, turn goes to Charlie (u3)
  });

  test('should handle Reverse action card', () => {
    const state = startGame(players);
    
    // Give u1 a Reverse card matching currentColor
    const reverseCard = { id: 'test-reverse', color: state.currentColor, type: 'reverse', value: 'Reverse' };
    state.players[0].cards.push(reverseCard);

    const updated = playCard(state, 'u1', 'test-reverse');
    expect(updated.direction).toBe(-1); // direction reversed
    expect(updated.currentTurn).toBe('u3'); // previous in reversed order is Charlie (u3)
  });

  test('should resolve Draw Two immediately on next player and skip their turn', () => {
    const state = startGame(players);
    
    // Give u1 a +2 card
    const draw2Card = { id: 'd2-test', color: state.currentColor, type: 'draw2', value: 'Draw2' };
    state.players[0].cards.push(draw2Card);

    const initialHandSizeU2 = state.players[1].cards.length;

    // u1 plays +2
    const updated = playCard(state, 'u1', 'd2-test');
    
    // u2 should have drawn 2 cards immediately
    expect(updated.players[1].cards.length).toBe(initialHandSizeU2 + 2);
    // Turn should skip u2 and go to u3
    expect(updated.currentTurn).toBe('u3');
  });

  test('should set up challenge state when wild4 is played and support accepting challenge', () => {
    const state = startGame(players);
    
    // Give u1 a Wild Draw Four card
    const wild4Card = { id: 'w4-test', color: 'Wild', type: 'wild4', value: 'Wild4' };
    state.players[0].cards.push(wild4Card);

    // u1 plays Wild Draw Four, choosing Blue
    const updated = playCard(state, 'u1', 'w4-test', 'Blue');
    
    // Turn should advance to the challenger (u2)
    expect(updated.currentTurn).toBe('u2');
    // Challenge state should be set up
    expect(updated.challenge).toBeDefined();
    expect(updated.challenge.challengerId).toBe('u2');
    expect(updated.challenge.targetId).toBe('u1');

    // u2 accepts challenge
    const initialHandSizeU2 = updated.players[1].cards.length;
    const { acceptChallenge } = require('../gameLogic/turnManager');
    const resolved = acceptChallenge(updated, 'u2');

    // u2 draws 4 cards
    expect(resolved.players[1].cards.length).toBe(initialHandSizeU2 + 4);
    // Challenge is cleared
    expect(resolved.challenge).toBeNull();
    // Turn advances to u3 (u2 lost turn)
    expect(resolved.currentTurn).toBe('u3');
  });

  test('should handle successful wild4 challenge (u1 played illegally)', () => {
    const state = startGame(players);
    
    // Ensure u1 has a card matching the currentColor to make the play illegal
    const originalColor = state.currentColor;
    const matchingCard = { id: 'match', color: originalColor, type: 'number', value: '5' };
    state.players[0].cards.push(matchingCard);

    // Give u1 a Wild Draw Four card
    const wild4Card = { id: 'w4-test', color: 'Wild', type: 'wild4', value: 'Wild4' };
    state.players[0].cards.push(wild4Card);

    // u1 plays Wild Draw Four
    const updated = playCard(state, 'u1', 'w4-test', 'Blue');

    // u2 executes challenge
    const initialHandSizeU1 = updated.players[0].cards.length;
    const { executeChallenge } = require('../gameLogic/turnManager');
    const resolved = executeChallenge(updated, 'u2');

    // Challenge is successful (u1 had matching color)
    expect(resolved.challengeSuccess).toBe(true);
    // Target (u1) draws 4 penalty cards
    expect(resolved.players[0].cards.length).toBe(initialHandSizeU1 + 4);
    // Challenger (u2) plays normally: current turn is still u2
    expect(resolved.currentTurn).toBe('u2');
  });

  test('should handle failed wild4 challenge (u1 played legally)', () => {
    const state = startGame(players);
    
    // Clear u1's cards matching the currentColor so play is legal
    state.players[0].cards = state.players[0].cards.filter(c => c.color !== state.currentColor);
    
    // Give u1 a Wild Draw Four card
    const wild4Card = { id: 'w4-test', color: 'Wild', type: 'wild4', value: 'Wild4' };
    state.players[0].cards.push(wild4Card);

    // u1 plays Wild Draw Four
    const updated = playCard(state, 'u1', 'w4-test', 'Blue');

    // u2 executes challenge
    const initialHandSizeU2 = updated.players[1].cards.length;
    const { executeChallenge } = require('../gameLogic/turnManager');
    const resolved = executeChallenge(updated, 'u2');

    // Challenge is failed
    expect(resolved.challengeSuccess).toBe(false);
    // Challenger (u2) draws 6 penalty cards (4 + 2 penalty)
    expect(resolved.players[1].cards.length).toBe(initialHandSizeU2 + 6);
    // Challenger (u2) loses turn: current turn advances to u3
    expect(resolved.currentTurn).toBe('u3');
  });

  test('should handle UNO declarations and penalties', () => {
    const state = startGame(players);
    
    // Give u1 exactly 1 card to simulate they just played down to 1 card
    state.players[0].cards = [{ id: 'last-card', color: 'Red', type: 'number', value: '2' }];
    state.players[0].unoDeclared = false;

    // Bob (u2) reports Alice (u1) for not calling UNO
    const reportResult = reportNoUno(state, 'u2', 'u1');
    expect(reportResult.success).toBe(true);
    expect(reportResult.drawnCount).toBe(2);
    expect(reportResult.roomState.players[0].cards.length).toBe(3); //Alice draws 2 cards
  });
});
