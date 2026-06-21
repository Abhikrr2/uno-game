import React from 'react';

export default function EmojiReactions({ reactions = [] }) {
  return (
    <div className="floating-emojis-container">
      {reactions.map((reaction) => {
        // Derive stable random-looking styling offsets from the reaction's ID character codes
        const randomX = (reaction.id.charCodeAt(0) % 9 - 4) * 12; // -48px to 48px
        const scale = 0.85 + (reaction.id.charCodeAt(1 || 0) % 5) * 0.08; // 0.85 to 1.17

        return (
          <div
            key={reaction.id}
            className="floating-emoji"
            style={{
              transform: `translate(calc(-50% + ${randomX}px), -50%) scale(${scale})`
            }}
          >
            {reaction.emoji}
          </div>
        );
      })}
    </div>
  );
}
