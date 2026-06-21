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

  test('should restrict card selection during stacking penalty', () => {
    const draw2Card = { id: '7', color: 'Red', type: 'draw2', value: 'Draw2' };
    const anotherDraw2 = { id: '8', color: 'Blue', type: 'draw2', value: 'Draw2' };
    
    // Must stack a draw2 on top of active draw2 penalty
    expect(isValidPlay(anotherDraw2, draw2Card, 'Red', 2, 'draw2')).toBe(true);
    expect(isValidPlay(red5, draw2Card, 'Red', 2, 'draw2')).toBe(false);
    expect(isValidPlay(wild4, draw2Card, 'Red', 2, 'draw2')).toBe(false);
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

  test('should accumulate penalty stacking and force draw on drawCard', () => {
    const state = startGame(players);
    
    // Give u1 and u2 +2 cards
    const draw2_1 = { id: 'd2-1', color: state.currentColor, type: 'draw2', value: 'Draw2' };
    const draw2_2 = { id: 'd2-2', color: state.currentColor, type: 'draw2', value: 'Draw2' };
    
    state.players[0].cards.push(draw2_1);
    state.players[1].cards.push(draw2_2);

    // u1 plays +2
    let updated = playCard(state, 'u1', 'd2-1');
    expect(updated.penaltyAccumulator).toBe(2);
    expect(updated.penaltyCardType).toBe('draw2');
    expect(updated.currentTurn).toBe('u2');

    // u2 stacks another +2
    updated = playCard(updated, 'u2', 'd2-2');
    expect(updated.penaltyAccumulator).toBe(4);
    expect(updated.currentTurn).toBe('u3');

    // u3 has no +2 cards and draws penalty stack
    const initialHandSize = updated.players[2].cards.length;
    const drawResult = drawCard(updated, 'u3');
    
    expect(drawResult.roomState.penaltyAccumulator).toBe(0);
    expect(drawResult.roomState.players[2].cards.length).toBe(initialHandSize + 4);
    expect(drawResult.roomState.currentTurn).toBe('u1'); // Turn advanced after drawing
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
