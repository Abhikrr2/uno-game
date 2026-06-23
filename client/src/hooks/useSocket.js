import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
  (import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin);

export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [guest, setGuest] = useState(null);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]); // Array of { id, senderName, emoji }
  const [error, setError] = useState(null);
  const [drawnPrivateCard, setDrawnPrivateCard] = useState(null); // Card drawn privately that is playable
  const [canPlayDrawn, setCanPlayDrawn] = useState(false);

  // Clear errors automatically after 4 seconds
  const setErrorWithTimeout = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }, []);

  useEffect(() => {
    // Check localStorage for existing guest credentials
    const cachedGuestId = localStorage.getItem('uno_guest_id');
    const cachedGuestName = localStorage.getItem('uno_guest_name');

    // Create socket connection
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to game server.');
      // Register or restore credentials
      socket.emit('registerGuest', {
        guestId: cachedGuestId,
        name: cachedGuestName
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from game server.');
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
      setErrorWithTimeout('Server connection failed. Trying to reconnect...');
    });

    socket.on('guestRegistered', (userData) => {
      setGuest(userData);
      localStorage.setItem('uno_guest_id', userData.id);
      localStorage.setItem('uno_guest_name', userData.name);
    });

    socket.on('roomUpdated', (roomState) => {
      setRoom(roomState);
      // Clean private draw states if it is no longer my turn
      if (roomState && roomState.currentTurn !== socket.emit.guestId) {
        setDrawnPrivateCard(null);
        setCanPlayDrawn(false);
      }
    });

    socket.on('newMessage', (msg) => {
      setMessages((prev) => [...prev, msg].slice(-100)); // Keep last 100 messages
    });

    socket.on('newReaction', (reaction) => {
      const reactionId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 9);
      const newReactionItem = {
        id: reactionId,
        ...reaction
      };

      setReactions((prev) => [...prev, newReactionItem]);

      // Remove reaction after 3 seconds (floating animation finishes)
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reactionId));
      }, 3000);
    });

    socket.on('cardDrawnPrivate', ({ card, canPlayDrawn }) => {
      if (canPlayDrawn) {
        setDrawnPrivateCard(card);
        setCanPlayDrawn(true);
      } else {
        setDrawnPrivateCard(null);
        setCanPlayDrawn(false);
      }
    });

    socket.on('leftRoom', () => {
      setRoom(null);
      setMessages([]);
      setDrawnPrivateCard(null);
      setCanPlayDrawn(false);
    });

    socket.on('error', (errMsg) => {
      setErrorWithTimeout(errMsg);
    });

    return () => {
      socket.disconnect();
    };
  }, [setErrorWithTimeout]);

  // --- Emitters ---

  const updateGuestName = useCallback((newName) => {
    if (socketRef.current && isConnected) {
      const currentGuestId = localStorage.getItem('uno_guest_id');
      socketRef.current.emit('registerGuest', {
        guestId: currentGuestId,
        name: newName
      });
    }
  }, [isConnected]);

  const createRoom = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('createRoom');
    }
  }, [isConnected]);

  const joinRoom = useCallback((roomCode) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('joinRoom', { roomCode });
    }
  }, [isConnected]);

  const startGame = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('startGame', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const playCard = useCallback((cardId, chosenColor = null) => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('playCard', {
        roomCode: room.roomCode,
        cardId,
        chosenColor
      });
      // Reset private draw after playing
      setDrawnPrivateCard(null);
      setCanPlayDrawn(false);
    }
  }, [isConnected, room]);

  const drawCard = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('drawCard', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const passTurn = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('passTurn', { roomCode: room.roomCode });
      setDrawnPrivateCard(null);
      setCanPlayDrawn(false);
    }
  }, [isConnected, room]);

  const declareUno = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('declareUno', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const acceptChallenge = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('acceptChallenge', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const executeChallenge = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('executeChallenge', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const reportNoUno = useCallback((targetPlayerId) => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('reportNoUno', { roomCode: room.roomCode, targetPlayerId });
    }
  }, [isConnected, room]);

  const sendMessage = useCallback((text) => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('sendMessage', { roomCode: room.roomCode, text });
    }
  }, [isConnected, room]);

  const sendReaction = useCallback((emoji) => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('sendReaction', { roomCode: room.roomCode, emoji });
    }
  }, [isConnected, room]);

  const resetRoom = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('resetRoom', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const leaveRoom = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('leaveRoom', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const addBot = useCallback(() => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('addBot', { roomCode: room.roomCode });
    }
  }, [isConnected, room]);

  const removeBot = useCallback((botId) => {
    if (socketRef.current && room && isConnected) {
      socketRef.current.emit('removeBot', { roomCode: room.roomCode, botId });
    }
  }, [isConnected, room]);

  return {
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
  };
}
