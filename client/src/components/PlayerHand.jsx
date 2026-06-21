import React from 'react';

// Helper to determine if card is playable
function isCardPlayable(card, topCard, currentColor, penaltyAccumulator = 0, penaltyCardType = null) {
  if (penaltyAccumulator > 0 && penaltyCardType) {
    if (penaltyCardType === 'draw2') return card.type === 'draw2';
    if (penaltyCardType === 'wild4') return card.type === 'wild4';
  }
  if (card.color === 'Wild' || card.type === 'wild' || card.type === 'wild4') return true;
  if (card.color === currentColor) return true;
  if (card.type === topCard.type) {
    if (card.type === 'number') return card.value === topCard.value;
    return true;
  }
  return false;
}

export default function PlayerHand({
  cards = [],
  isMyTurn = false,
  topCard,
  currentColor,
  penaltyAccumulator = 0,
  penaltyCardType = null,
  onPlayCard
}) {
  const getDisplaySymbol = (type, value) => {
    switch (type) {
      case 'skip': return '⊘';
      case 'reverse': return '⇄';
      case 'draw2': return '+2';
      case 'wild4': return '+4';
      case 'wild': return 'W';
      default: return value;
    }
  };

  const getMiniSymbol = (type, value) => {
    switch (type) {
      case 'skip': return '⊘';
      case 'reverse': return '⇄';
      case 'draw2': return '+2';
      case 'wild4': return '+4';
      case 'wild': return 'W';
      default: return value;
    }
  };

  return (
    <div className="hand-scroll-wrapper">
      <div className="hand-fan">
        {cards.map((card, idx) => {
          const playable = isMyTurn && isCardPlayable(card, topCard, currentColor, penaltyAccumulator, penaltyCardType);
          const displaySymbol = getDisplaySymbol(card.type, card.value);
          const miniSymbol = getMiniSymbol(card.type, card.value);

          // Dynamic styling calculations
          const rotate = (idx - (cards.length - 1) / 2) * (cards.length > 10 ? 3 : 5); // Fan tilt angle
          const translateY = Math.abs(idx - (cards.length - 1) / 2) * (cards.length > 10 ? 1 : 2); // Curve drop

          return (
            <div
              key={card.id}
              onClick={() => playable && onPlayCard(card)}
              className={`uno-card color-${card.color} ${playable ? 'playable' : ''}`}
              style={{
                transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
                zIndex: idx
              }}
            >
              {/* Corner Symbols */}
              <span className="card-mini-symbol symbol-top-left">{miniSymbol}</span>
              <span className="card-mini-symbol symbol-bottom-right">{miniSymbol}</span>
              
              {/* Center Oval Visual */}
              <div className="card-oval">
                <span className="card-symbol">{displaySymbol}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
