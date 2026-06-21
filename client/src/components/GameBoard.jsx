import React, { useState, useEffect } from 'react';
import { AlertCircle, ShieldAlert, Award, RefreshCw, LogOut } from 'lucide-react';
import confetti from 'canvas-confetti';
import PlayerHand from './PlayerHand';

export default function GameBoard({
  guest,
  room,
  drawnPrivateCard,
  canPlayDrawn,
  playCard,
  drawCard,
  passTurn,
  declareUno,
  reportNoUno,
  resetRoom,
  leaveRoom,
  messages,
  reactions
}) {
  const [selectedWildCard, setSelectedWildCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeBubbles, setActiveBubbles] = useState({}); // playerId -> bubbleContent

  // Trigger confetti when game is finished
  useEffect(() => {
    if (room?.gameStatus === 'finished') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [room?.gameStatus]);

  // Track chat messages for speech bubbles
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    
    // Ignore system messages for speech bubbles
    if (latestMessage.senderId === 'system') return;
    
    setActiveBubbles(prev => ({
      ...prev,
      [latestMessage.senderId]: latestMessage.text
    }));

    const timer = setTimeout(() => {
      setActiveBubbles(prev => {
        const next = { ...prev };
        delete next[latestMessage.senderId];
        return next;
      });
    }, 3500);

    return () => clearTimeout(timer);
  }, [messages]);

  // Track emoji reactions for speech bubbles
  useEffect(() => {
    if (!reactions || reactions.length === 0) return;
    const latestReaction = reactions[reactions.length - 1];
    
    const matchingPlayer = room.players.find(p => p.name === latestReaction.senderName);
    if (!matchingPlayer) return;

    setActiveBubbles(prev => ({
      ...prev,
      [matchingPlayer.id]: latestReaction.emoji
    }));

    const timer = setTimeout(() => {
      setActiveBubbles(prev => {
        const next = { ...prev };
        delete next[matchingPlayer.id];
        return next;
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [reactions, room.players]);

  if (!room || !guest) return null;

  const myId = guest.id;
  const myPlayerState = room.players.find(p => p.id === myId);
  const isMyTurn = room.currentTurn === myId;
  const isHost = room.hostId === myId;

  const myIndex = room.players.findIndex(p => p.id === myId);
  const totalPlayers = room.players.length;

  // Helper to get seat class for opponents (Me is seat-0 at bottom-left corner)
  const getOpponentSeatClass = (opponentIndex, totalOpponents) => {
    if (totalOpponents === 1) {
      return 'seat-top-center';
    }
    if (totalOpponents === 2) {
      return opponentIndex === 0 ? 'seat-left' : 'seat-right';
    }
    if (totalOpponents === 3) {
      if (opponentIndex === 0) return 'seat-left';
      if (opponentIndex === 1) return 'seat-top-center';
      return 'seat-right';
    }
    // 4 opponents
    if (opponentIndex === 0) return 'seat-left';
    if (opponentIndex === 1) return 'seat-top-left';
    if (opponentIndex === 2) return 'seat-top-right';
    return 'seat-right';
  };

  const getSeatClass = (relativeIndex) => {
    if (relativeIndex === 0) return 'my-profile-seat';
    return getOpponentSeatClass(relativeIndex - 1, totalPlayers - 1);
  };

  // Create an ordered list starting with me, then wrapping around clockwise
  const orderedSeats = [];
  for (let i = 0; i < totalPlayers; i++) {
    const player = room.players[(myIndex + i) % totalPlayers];
    orderedSeats.push({
      player,
      seatClass: getSeatClass(i),
      isMe: player.id === myId
    });
  }

  const [dealingCards, setDealingCards] = useState([]);
  const [activeDealRoom, setActiveDealRoom] = useState(null);

  // Staggered round-robin card dealing animations when game starts
  useEffect(() => {
    if (!room) return;
    if (room.gameStatus === 'playing') {
      if (activeDealRoom !== room.roomCode) {
        setActiveDealRoom(room.roomCode);
        
        const cardsPerPlayer = 7;
        const newDealingCards = [];

        for (let c = 0; c < cardsPerPlayer; c++) {
          for (let p = 0; p < totalPlayers; p++) {
            const seatClass = getSeatClass(p);
            
            newDealingCards.push({
              id: `deal-${c}-${p}`,
              seatClass,
              delay: (c * totalPlayers + p) * 0.08
            });
          }
        }

        setDealingCards(newDealingCards);

        const duration = (cardsPerPlayer * totalPlayers) * 80 + 600;
        const timer = setTimeout(() => {
          setDealingCards([]);
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      setActiveDealRoom(null);
    }
  }, [room?.gameStatus, room?.roomCode]);

  // Handle playing a card
  const handleCardClick = (card) => {
    if (card.color === 'Wild' || card.type === 'wild' || card.type === 'wild4') {
      setSelectedWildCard(card);
      setShowColorPicker(true);
    } else {
      playCard(card.id);
    }
  };

  const handleColorSelect = (color) => {
    if (selectedWildCard) {
      playCard(selectedWildCard.id, color);
      setSelectedWildCard(null);
      setShowColorPicker(false);
    }
  };

  const getCardDisplaySymbol = (card) => {
    if (!card) return '';
    switch (card.type) {
      case 'skip': return '⊘';
      case 'reverse': return '⇄';
      case 'draw2': return '+2';
      case 'wild4': return '+4';
      case 'wild': return 'W';
      default: return card.value;
    }
  };

  const isDealing = dealingCards.length > 0;

  return (
    <div className={`game-main ${isDealing ? 'dealing-active' : ''}`}>
      {/* Header Info */}
      <div className="game-header">
        <div className="room-badge" onClick={() => {
          navigator.clipboard.writeText(room.roomCode);
        }}>
          <span className="text-xs text-slate-400">ROOM:</span>
          <span className="room-code-txt text-yellow-400">{room.roomCode}</span>
        </div>

        {room.penaltyAccumulator > 0 && (
          <div className="penalty-banner">
            <AlertCircle className="w-4 h-4 text-red-400 animate-bounce" />
            <span>Draw Penalty: +{room.penaltyAccumulator} cards!</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-semibold">
            TURN: <span className="text-indigo-400">{isMyTurn ? 'YOURS' : room.players.find(p => p.id === room.currentTurn)?.name}</span>
          </span>
        </div>
      </div>

      {/* Main Table Space */}
      <div className="table-area">
        <div className="game-table">

          {/* Staggered card dealing animations */}
          {dealingCards.map((card) => (
            <div
              key={card.id}
              className={`dealing-card card-deck-back ${card.seatClass}`}
              style={{
                animationDelay: `${card.delay}s`
              }}
            >
              <div className="deck-inner" style={{ fontSize: '0.7rem' }}>UNO</div>
            </div>
          ))}

          {/* Center piles (Draw Deck & Discard Pile) */}
          <div className="center-pile">
            {/* Draw Deck */}
            <div className="card-deck-pile">
              <div 
                className="card-deck-back"
                onClick={() => isMyTurn && !drawnPrivateCard && drawCard()}
              >
                <div className="deck-inner">UNO</div>
              </div>
              <span className="deck-count">{room.deckCount} left</span>
            </div>

            {/* Discard Pile */}
            <div className="discard-pile-slot">
              {room.topCard && (
                <>
                  <div className="uno-card discard-bg-card-1" />
                  <div className="uno-card discard-bg-card-2" />
                  
                  <div className={`uno-card color-${room.currentColor} discard-active-card`}>
                    <div className={`active-color-ring ${room.currentColor}`} />
                    
                    <span className="card-mini-symbol symbol-top-left">
                      {getCardDisplaySymbol(room.topCard)}
                    </span>
                    <span className="card-mini-symbol symbol-bottom-right">
                      {getCardDisplaySymbol(room.topCard)}
                    </span>
                    
                    <div className="card-oval">
                      <span className="card-symbol">{getCardDisplaySymbol(room.topCard)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Player seats around the table (Opponents only) */}
          {orderedSeats.filter(s => !s.isMe).map(({ player, seatClass }) => {
            const isPlayerTurn = room.currentTurn === player.id;
            const initials = player.name.substring(0, 2).toUpperCase();
            const canReport = player.cardCount === 1 && !player.unoDeclared && room.gameStatus === 'playing';

            return (
              <div
                key={player.id}
                className={`player-seat ${seatClass} ${isPlayerTurn ? 'active-turn' : ''} ${player.disconnected ? 'disconnected' : ''}`}
              >
                {/* Speech Bubble */}
                {activeBubbles[player.id] && (
                  <div className="player-speech-bubble">
                    {activeBubbles[player.id]}
                  </div>
                )}

                {/* Avatar Wrapper */}
                <div className="player-avatar-wrapper">
                  <div className="player-avatar">
                    {initials}
                  </div>
                  
                  <div className="card-count-badge">
                    {player.cardCount}
                  </div>

                  <span className={`player-status-indicator ${player.disconnected ? 'offline' : 'online'}`} />

                  {canReport && (
                    <button
                      onClick={() => reportNoUno(player.id)}
                      className="absolute -top-3 -right-6 p-1.5 bg-red-500 rounded-full hover:bg-red-600 shadow-md text-white transition-all scale-100 hover:scale-110"
                      title="Report player for not calling UNO!"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <span className="player-name">
                  {player.name}
                </span>
                
                {player.unoDeclared && (
                  <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 mt-1 uppercase tracking-widest animate-pulse">
                    UNO!
                  </span>
                )}

                {/* Other player's fanned card backs */}
                {player.cardCount > 0 && (
                  <div className={`fanned-hand-back fanned-${seatClass}`}>
                    {Array.from({ length: Math.min(player.cardCount, 5) }).map((_, cIdx) => (
                      <div
                        key={cIdx}
                        className="mini-card-back"
                        style={{
                          '--card-index': cIdx,
                          '--total-cards': Math.min(player.cardCount, 5)
                        }}
                      >
                        <span>UNO</span>
                      </div>
                    ))}
                    {player.cardCount > 5 && (
                      <div className="more-cards-badge">+{player.cardCount - 5}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Local Player Profile in the bottom-left corner (Never overlaps fanned hand) */}
      {myPlayerState && (
        <div className={`my-profile-seat ${isMyTurn ? 'active-turn' : ''}`}>
          {activeBubbles[myId] && (
            <div className="player-speech-bubble my-speech-bubble">
              {activeBubbles[myId]}
            </div>
          )}
          <div className="player-avatar-wrapper">
            <div className="player-avatar">
              {guest.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="card-count-badge">{myPlayerState.cardCount}</div>
            <span className="player-status-indicator online" />
          </div>
          <span className="player-name">{guest.name} (You)</span>
          {myPlayerState.unoDeclared && (
            <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 mt-1 uppercase tracking-widest animate-pulse">
              UNO!
            </span>
          )}
        </div>
      )}

      {/* Large 3D Call UNO Button in the bottom-right corner */}
      {myPlayerState && myPlayerState.cards.length <= 2 && (
        <button
          onClick={declareUno}
          disabled={myPlayerState.unoDeclared}
          className={`call-uno-3d-btn ${myPlayerState.unoDeclared ? 'declared' : ''}`}
        >
          <div className="btn-inner">
            <span className="btn-call">CALL</span>
            <span className="btn-uno">UNO</span>
          </div>
        </button>
      )}

      {/* Wild color choosing overlay */}
      {showColorPicker && (
        <div className="color-picker-overlay">
          <h3 className="font-bold text-lg text-slate-200">Choose Wild Color</h3>
          <p className="text-xs text-slate-400 mt-1">Select a color to set the active pile</p>
          <div className="color-picker-grid">
            {['Red', 'Blue', 'Green', 'Yellow'].map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={`color-choice-btn ${color}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Private Draw Turn Selection (Draw 1 card, choose to play it or pass) */}
      {drawnPrivateCard && isMyTurn && (
        <div className="color-picker-overlay" style={{ height: 'auto', bottom: '160px', top: 'auto', padding: '20px' }}>
          <h4 className="text-sm font-semibold text-slate-300">You drew a playable card!</h4>
          
          <div className="flex gap-4 items-center justify-center my-3">
            <div className={`uno-card color-${drawnPrivateCard.color}`}>
              <span className="card-mini-symbol symbol-top-left">{getCardDisplaySymbol(drawnPrivateCard)}</span>
              <div className="card-oval">
                <span className="card-symbol">{getCardDisplaySymbol(drawnPrivateCard)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleCardClick(drawnPrivateCard)}
              className="primary-btn px-6 py-2 text-xs rounded-full"
            >
              Play Card
            </button>
            <button
              onClick={passTurn}
              className="secondary-btn px-6 py-2 text-xs rounded-full"
            >
              Pass Turn
            </button>
          </div>
        </div>
      )}

      {/* Player Hand & Bottom Controls */}
      {myPlayerState && (
        <div className="player-hand-container">
          <div className="action-row">
            {/* Draw 1 card action button */}
            {isMyTurn && !drawnPrivateCard && room.penaltyAccumulator === 0 && (
              <button onClick={drawCard} className="action-btn draw">
                Draw Card
              </button>
            )}

            {/* Draw penalty collection button */}
            {isMyTurn && room.penaltyAccumulator > 0 && (
              <button onClick={drawCard} className="action-btn draw bg-red-950/40 border-red-800 text-red-300">
                Draw +{room.penaltyAccumulator} Cards
              </button>
            )}
          </div>

          <PlayerHand
            cards={myPlayerState.cards}
            isMyTurn={isMyTurn && !drawnPrivateCard}
            topCard={room.topCard}
            currentColor={room.currentColor}
            penaltyAccumulator={room.penaltyAccumulator}
            penaltyCardType={room.penaltyCardType}
            onPlayCard={handleCardClick}
          />
        </div>
      )}

      {/* Win Game Screen Overlay */}
      {room.gameStatus === 'finished' && room.winner && (
        <div className="win-overlay">
          <Award className="w-16 h-16 text-yellow-500 animate-bounce mb-2" />
          <h2 className="win-title">GAME FINISHED</h2>
          <p className="win-subtitle">
            🎉 <strong className="text-yellow-400">{room.winner.name}</strong> won the game!
          </p>

          <div className="flex gap-4">
            {isHost ? (
              <button
                onClick={resetRoom}
                className="primary-btn flex items-center gap-2 px-6 py-3 rounded-full"
              >
                <RefreshCw className="w-5 h-5" />
                Play Again
              </button>
            ) : (
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-400">
                Waiting for host to play again...
              </div>
            )}
            
            <button
              onClick={leaveRoom}
              className="secondary-btn flex items-center gap-2 px-6 py-3 rounded-full"
            >
              <LogOut className="w-5 h-5" />
              Exit Room
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
