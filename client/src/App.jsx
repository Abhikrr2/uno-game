import React from 'react';
import { useSocket } from './hooks/useSocket';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import ChatBox from './components/ChatBox';
import EmojiReactions from './components/EmojiReactions';

export default function App() {
  const {
    isConnected,
    guest,
    room,
    messages,
    reactions,
    error,
    drawnPrivateCard,
    canPlayDrawn,
    updateGuestName,
    createRoom,
    joinRoom,
    leaveRoom,
    addBot,
    removeBot,
    startGame,
    playCard,
    drawCard,
    passTurn,
    declareUno,
    acceptChallenge,
    executeChallenge,
    reportNoUno,
    sendMessage,
    sendReaction,
    resetRoom
  } = useSocket();

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Dynamic Connection/Error Banner */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-950/90 border border-red-500/30 text-red-200 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md z-[999] flex items-center gap-2.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      {/* Main View Router */}
      {!room || room.gameStatus === 'waiting' ? (
        <Lobby
          guest={guest}
          room={room}
          isConnected={isConnected}
          updateGuestName={updateGuestName}
          createRoom={createRoom}
          joinRoom={joinRoom}
          leaveRoom={leaveRoom}
          addBot={addBot}
          removeBot={removeBot}
          startGame={startGame}
        />
      ) : (
        <div className="game-layout">
          {/* Gameboard & Floating Reactions Overlay */}
          <div className="relative h-full overflow-hidden">
            <GameBoard
              guest={guest}
              room={room}
              drawnPrivateCard={drawnPrivateCard}
              canPlayDrawn={canPlayDrawn}
              playCard={playCard}
              drawCard={drawCard}
              passTurn={passTurn}
              declareUno={declareUno}
              acceptChallenge={acceptChallenge}
              executeChallenge={executeChallenge}
              reportNoUno={reportNoUno}
              resetRoom={resetRoom}
              leaveRoom={leaveRoom}
              messages={messages}
              reactions={reactions}
            />
            
            {/* Emojis floating over the card board */}
            <EmojiReactions reactions={reactions} />
          </div>

          {/* Chat Panel + Play Reactions Bar */}
          <ChatBox
            messages={messages}
            guest={guest}
            onSendMessage={sendMessage}
            onSendReaction={sendReaction}
          />
        </div>
      )}
    </div>
  );
}
