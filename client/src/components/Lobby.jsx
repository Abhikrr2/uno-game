import React, { useState } from 'react';
import { User, Copy, Plus, Play, LogOut, Check } from 'lucide-react';

export default function Lobby({
  guest,
  room,
  isConnected,
  updateGuestName,
  createRoom,
  joinRoom,
  leaveRoom,
  addBot,
  removeBot,
  startGame
}) {
  const [nameInput, setNameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSaveName = (e) => {
    e.preventDefault();
    if (nameInput.trim()) {
      updateGuestName(nameInput.trim());
      setNameInput('');
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomCodeInput.trim() && roomCodeInput.trim().length === 6) {
      joinRoom(roomCodeInput.trim().toUpperCase());
    }
  };

  const handleCopyCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!guest) {
    return (
      <div className="lobby-container">
        <div className="lobby-box glass-panel">
          <h1 className="lobby-title">UNO GAME</h1>
          <p className="lobby-subtitle">Initializing guest profile...</p>
        </div>
      </div>
    );
  }

  // Waiting in Lobby Screen
  if (room && room.gameStatus === 'waiting') {
    const isHost = room.hostId === guest.id;
    const playerCount = room.players.length;
    const maxPlayers = 5;

    return (
      <div className="lobby-container">
        <div className="lobby-box glass-panel lobby-waiting-box">
          <h1 className="lobby-title">UNO LOBBY</h1>
          
          <div className="lobby-room-code-wrapper">
            <span className="lobby-section-title">ROOM CODE</span>
            <div className="room-badge" onClick={handleCopyCode} style={{ justifyContent: 'center' }}>
              <span className="room-code-txt">{room.roomCode}</span>
              {copied ? <Check className="copied-icon" /> : <Copy className="copy-icon" />}
            </div>
            <span className="lobby-section-subtitle">Share this code with up to 4 friends</span>
          </div>

          <div className="players-list">
            <div className="lobby-players-header">
              <span>PLAYERS IN ROOM</span>
              <span>{playerCount} / {maxPlayers}</span>
            </div>

            {room.players.map((player) => (
              <div key={player.id} className="player-list-item">
                <div className="player-list-info">
                  <User className="player-icon" />
                  <span className={player.id === guest.id ? 'player-self' : ''}>
                    {player.name} {player.id === guest.id && '(You)'}
                  </span>
                </div>
                <div className="player-status-group">
                  {room.hostId === player.id && <span className="host-tag">HOST</span>}
                  {isHost && player.isBot ? (
                    <button
                      onClick={() => removeBot(player.id)}
                      className="kick-bot-btn"
                      title="Kick Bot Player"
                    >
                      ✕
                    </button>
                  ) : (
                    <span className={`status-dot ${player.disconnected ? 'offline' : 'online'}`} />
                  )}
                </div>
              </div>
            ))}

            {Array.from({ length: maxPlayers - playerCount }).map((_, idx) => (
              <div key={idx} className="player-list-item empty-slot">
                Waiting for player...
              </div>
            ))}
          </div>

          {/* Button Group: Staggered columns for guests, row split for host */}
          {isHost ? (
            <div className="lobby-btn-group-column">
              <div className="lobby-btn-group-row">
                <button
                  onClick={startGame}
                  disabled={playerCount < 2}
                  className="primary-btn flex items-center justify-center gap-2"
                  style={{ opacity: playerCount < 2 ? 0.6 : 1, cursor: playerCount < 2 ? 'not-allowed' : 'pointer' }}
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Game
                </button>
                {playerCount < maxPlayers && (
                  <button
                    onClick={addBot}
                    className="secondary-btn flex items-center justify-center gap-2"
                    style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}
                  >
                    🤖 Add Bot
                  </button>
                )}
              </div>
              <button
                onClick={leaveRoom}
                className="secondary-btn flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Leave Room
              </button>
            </div>
          ) : (
            <div className="lobby-btn-group-column">
              <div className="lobby-waiting-banner">
                Waiting for Host to start...
              </div>
              <button
                onClick={leaveRoom}
                className="secondary-btn flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Leave Room
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Create or Join Room Screen
  return (
    <div className="lobby-container relative overflow-hidden">
      {/* Background Decorative Floating Cards */}
      <div className="lobby-bg-cards">
        <div className="bg-card bg-card-1 uno-card color-Red">
          <span className="card-mini-symbol symbol-top-left">7</span>
          <div className="card-oval"><span className="card-symbol">7</span></div>
        </div>
        <div className="bg-card bg-card-2 uno-card color-Blue">
          <span className="card-mini-symbol symbol-top-left">⇄</span>
          <div className="card-oval"><span className="card-symbol">⇄</span></div>
        </div>
        <div className="bg-card bg-card-3 uno-card color-Yellow">
          <span className="card-mini-symbol symbol-top-left">9</span>
          <div className="card-oval"><span className="card-symbol">9</span></div>
        </div>
        <div className="bg-card bg-card-4 uno-card color-Green">
          <span className="card-mini-symbol symbol-top-left">⊘</span>
          <div className="card-oval"><span className="card-symbol">⊘</span></div>
        </div>
        <div className="bg-card bg-card-5 uno-card color-Wild">
          <span className="card-mini-symbol symbol-top-left">+4</span>
          <div className="card-oval"><span className="card-symbol">+4</span></div>
        </div>
      </div>

      <div className="lobby-box glass-panel z-10">
        {/* Slanted 3D Game Logo */}
        <div className="lobby-logo-wrapper">
          <div className="lobby-logo">
            <span className="logo-uno">UNO</span>
            <span className="logo-play">PLAY</span>
          </div>
        </div>
        
        <p className="lobby-subtitle">Real-time UNO card game with reactions and chat</p>

        <form onSubmit={handleSaveName} className="guest-profile">
          <label className="guest-label">
            Your Nickname
          </label>
          <div className="guest-input-group">
            <input
              type="text"
              className="guest-input"
              placeholder={guest.name}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={15}
            />
            <button type="submit" className="random-btn">
              Change
            </button>
          </div>
          <span className="guest-input-hint">
            Current guest name: <strong className="guest-name-highlight">{guest.name}</strong>
          </span>
        </form>

        <div className="lobby-actions">
          <button onClick={createRoom} className="primary-btn flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" />
            Create Game Room
          </button>

          <div className="join-divider">OR</div>

          <form onSubmit={handleJoin} className="join-input-group">
            <input
              type="text"
              className="join-input"
              placeholder="Enter Room Code"
              maxLength={6}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={roomCodeInput.trim().length !== 6}
              className="secondary-btn"
              style={{ padding: '0 20px', opacity: roomCodeInput.trim().length !== 6 ? 0.6 : 1 }}
            >
              Join
            </button>
          </form>
        </div>

        <div className="lobby-status-footer">
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
          {isConnected ? 'Connected to server' : 'Disconnected from server'}
        </div>
      </div>
    </div>
  );
}
