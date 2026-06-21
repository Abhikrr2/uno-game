/**
 * Validates whether a card can be played on the current top card of the discard pile.
 * 
 * @param {Object} card - The card the player wants to play.
 * @param {Object} topCard - The top card currently on the discard pile.
 * @param {string} currentColor - The active game color (differs from topCard color if Wild was played).
 * @param {number} penaltyAccumulator - The active draw penalty stack size (from +2 or +4 stacking).
 * @param {string|null} penaltyCardType - The type of card that started the penalty stack ('draw2' or 'wild4').
 * @returns {boolean} - True if the card play is valid, false otherwise.
 */
function isValidPlay(card, topCard, currentColor, penaltyAccumulator = 0, penaltyCardType = null) {
  // If there is an active stacking penalty that the player must respond to
  if (penaltyAccumulator > 0 && penaltyCardType) {
    if (penaltyCardType === 'draw2') {
      // Only stack another +2 card
      return card.type === 'draw2';
    }
    if (penaltyCardType === 'wild4') {
      // Only stack another +4 card
      return card.type === 'wild4';
    }
  }

  // Wild cards (Wild, Wild4) can be played on any card
  if (card.color === 'Wild' || card.type === 'wild' || card.type === 'wild4') {
    return true;
  }

  // Must match the current active color
  if (card.color === currentColor) {
    return true;
  }

  // Or must match the top card's type (e.g. skip on skip, reverse on reverse, draw2 on draw2)
  if (card.type === topCard.type) {
    // If it's a number card, their values must also match
    if (card.type === 'number') {
      return card.value === topCard.value;
    }
    return true;
  }

  return false;
}

module.exports = { isValidPlay };
