function createDeck() {
  const colors = ['Red', 'Blue', 'Yellow', 'Green'];
  const deck = [];
  let cardId = 0;

  for (const color of colors) {
    // Number 0 (one of each color)
    deck.push({ id: `c-${cardId++}`, color, type: 'number', value: '0', score: 0 });

    // Numbers 1-9 (two of each color)
    for (let val = 1; val <= 9; val++) {
      deck.push({ id: `c-${cardId++}`, color, type: 'number', value: String(val), score: val });
      deck.push({ id: `c-${cardId++}`, color, type: 'number', value: String(val), score: val });
    }

    // Special Action Cards (two of each color)
    const actions = [
      { name: 'Skip', type: 'skip' },
      { name: 'Reverse', type: 'reverse' },
      { name: 'Draw2', type: 'draw2' }
    ];

    for (const action of actions) {
      deck.push({ id: `c-${cardId++}`, color, type: action.type, value: action.name, score: 20 });
      deck.push({ id: `c-${cardId++}`, color, type: action.type, value: action.name, score: 20 });
    }
  }

  // Wild Cards (four of each)
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c-${cardId++}`, color: 'Wild', type: 'wild', value: 'Wild', score: 50 });
    deck.push({ id: `c-${cardId++}`, color: 'Wild', type: 'wild4', value: 'Wild4', score: 50 });
  }

  return deck;
}

function shuffle(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = { createDeck, shuffle };
