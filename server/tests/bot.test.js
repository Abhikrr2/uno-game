const { chooseBestColor, makeBotMove } = require('../gameLogic/botAI');
const { startGame } = require('../gameLogic/turnManager');

describe('UNO Bot AI Helper Logic', () => {
  test('should choose the color the bot holds the most of', () => {
    const cards = [
      { id: '1', color: 'Red', value: '5' },
      { id: '2', color: 'Red', value: 'Skip' },
      { id: '3', color: 'Blue', value: '7' },
      { id: '4', color: 'Green', value: '8' },
      { id: '5', color: 'Wild', value: 'Wild' } // Wild card color counts shouldn't increase wild count
    ];
    
    const chosenColor = chooseBestColor(cards);
    expect(chosenColor).toBe('Red');
  });

  test('should fallback to Red if hand is empty or has only wild cards', () => {
    const cards = [
      { id: '1', color: 'Wild', value: 'Wild' },
      { id: '2', color: 'Wild', value: 'Wild4' }
    ];
    const chosenColor = chooseBestColor(cards);
    expect(chosenColor).toBe('Red');
  });
});

describe('UNO Bot AI Action Playthrough', () => {
  let roomState;

  beforeEach(() => {
    const players = [
      { id: 'bot-1', name: 'RoboPanda 🤖', isBot: true },
      { id: 'u2', name: 'Bob', isBot: false }
    ];
    roomState = startGame(players);
    roomState.currentTurn = 'bot-1';
  });

  test('should play matching card if available in hand', () => {
    // Set up top card
    roomState.topCard = { id: 'top', color: 'Blue', type: 'number', value: '5' };
    roomState.currentColor = 'Blue';

    // Give bot some cards: one matching, one non-matching
    const bot = roomState.players.find(p => p.id === 'bot-1');
    bot.cards = [
      { id: 'non-matching', color: 'Red', type: 'number', value: '9' },
      { id: 'matching', color: 'Blue', type: 'number', value: '3' }
    ];

    const decision = makeBotMove(roomState, 'bot-1');
    expect(decision.action).toBe('play');
    expect(decision.cardPlayed.id).toBe('matching');
    expect(decision.roomState.topCard.id).toBe('matching');
    expect(decision.roomState.currentTurn).toBe('u2'); // turn advances
  });

  test('should play Wild card and declare best color', () => {
    roomState.topCard = { id: 'top', color: 'Blue', type: 'number', value: '5' };
    roomState.currentColor = 'Blue';

    const bot = roomState.players.find(p => p.id === 'bot-1');
    bot.cards = [
      { id: 'wild-card', color: 'Wild', type: 'wild', value: 'Wild' },
      { id: 'red-1', color: 'Red', type: 'number', value: '2' },
      { id: 'red-2', color: 'Red', type: 'number', value: '4' }
    ];

    const decision = makeBotMove(roomState, 'bot-1');
    expect(decision.action).toBe('play');
    expect(decision.cardPlayed.id).toBe('wild-card');
    expect(decision.chosenColor).toBe('Red'); // Declares majority color Red
    expect(decision.roomState.currentColor).toBe('Red');
  });

  test('should draw a card and play it if it matches', () => {
    roomState.topCard = { id: 'top', color: 'Blue', type: 'number', value: '5' };
    roomState.currentColor = 'Blue';

    const bot = roomState.players.find(p => p.id === 'bot-1');
    bot.cards = [
      { id: 'red-1', color: 'Red', type: 'number', value: '2' }
    ];

    // Force deck to have a matching card as next drawn
    roomState.deck = [
      { id: 'matching-drawn', color: 'Blue', type: 'number', value: '7' }
    ];

    const decision = makeBotMove(roomState, 'bot-1');
    expect(decision.action).toBe('draw_play');
    expect(decision.cardPlayed.id).toBe('matching-drawn');
    expect(decision.roomState.topCard.id).toBe('matching-drawn');
    expect(decision.roomState.currentTurn).toBe('u2');
  });

  test('should draw and pass if the drawn card does not match', () => {
    roomState.topCard = { id: 'top', color: 'Blue', type: 'number', value: '5' };
    roomState.currentColor = 'Blue';

    const bot = roomState.players.find(p => p.id === 'bot-1');
    bot.cards = [
      { id: 'red-1', color: 'Red', type: 'number', value: '2' }
    ];

    // Force deck to have a non-matching card as next drawn
    roomState.deck = [
      { id: 'non-matching-drawn', color: 'Green', type: 'number', value: '9' }
    ];

    const decision = makeBotMove(roomState, 'bot-1');
    expect(decision.action).toBe('draw_pass');
    expect(decision.cardPlayed).toBeNull();
    expect(decision.roomState.players.find(p => p.id === 'bot-1').cards.length).toBe(2); // Bot keeps drawn card
    expect(decision.roomState.currentTurn).toBe('u2'); // Turn passes
  });

  test('should handle UNO declaration on single card remaining', () => {
    roomState.topCard = { id: 'top', color: 'Blue', type: 'number', value: '5' };
    roomState.currentColor = 'Blue';

    const bot = roomState.players.find(p => p.id === 'bot-1');
    bot.cards = [
      { id: 'matching', color: 'Blue', type: 'number', value: '5' },
      { id: 'last-card', color: 'Red', type: 'number', value: '2' }
    ];

    // Force bot to successfully declare UNO
    const decisionSuccess = makeBotMove(roomState, 'bot-1', true);
    expect(decisionSuccess.unoDeclared).toBe(true);
    expect(decisionSuccess.roomState.players.find(p => p.id === 'bot-1').unoDeclared).toBe(true);

    // Force bot to fail to declare UNO
    const decisionFail = makeBotMove(roomState, 'bot-1', false);
    expect(decisionFail.unoDeclared).toBe(false);
    expect(decisionFail.roomState.players.find(p => p.id === 'bot-1').unoDeclared).toBe(false);
  });
});
