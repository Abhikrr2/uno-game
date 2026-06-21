import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile } from 'lucide-react';

export default function ChatBox({
  messages = [],
  guest,
  onSendMessage,
  onSendReaction
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const reactionEmojis = ['👍', '😂', '😡', '🎉'];

  return (
    <div className="game-sidebar">
      {/* Chat Messages Section */}
      <div className="chat-panel">
        <div className="panel-header">
          <span>ROOM CHAT</span>
          <span className="text-xs text-indigo-400 font-semibold">• ONLINE</span>
        </div>

        <div className="messages-list">
          {messages.map((msg, index) => {
            const isSelf = msg.senderId === guest.id;
            const isSystem = msg.senderId === 'system';

            if (isSystem) {
              return (
                <div key={index} className="chat-msg system">
                  <div className="msg-bubble">{msg.text}</div>
                </div>
              );
            }

            return (
              <div key={index} className={`chat-msg ${isSelf ? 'self' : ''}`}>
                <span className="msg-sender">{msg.senderName}</span>
                <div className="msg-bubble">{msg.text}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <div className="chat-input-row">
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              maxLength={80}
            />
            <button type="submit" className="chat-send-btn">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Card Reactions Section */}
      <div className="reactions-panel">
        <span className="reaction-title">React to Play</span>
        <div className="reaction-grid">
          {reactionEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="reaction-btn"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
