# 🃏 Real-Time Multiplayer UNO Game

A sleek, modern, real-time multiplayer UNO card game built for high-performance and rich visual aesthetics. It features a responsive React client, a Node.js Socket.io backend, local In-Memory / Redis persistence, in-game room chat, and animated floating card reactions.

---

## ✨ Features

- **Guest Profile Naming (No Login)**: Automatically generates unique player UUIDs and caches them in the browser's `localStorage` for session persistence. Generates fun random animal nicknames (e.g., *SwiftFalcon42*, *BravePanda75*) which can be customized at any time.
- **Robust Room Management**: 
  - Create or join rooms with a unique 6-character alphanumeric room code.
  - Supports up to 5 players per room.
  - Auto-host transfer when the room host exits.
  - Automatic room deletion and state cleanup when all players leave.
- **Physical Card Design**: Fronts feature solid white ovals and color-matched numbers/symbols. Wild cards feature 4-quadrant conic gradients on black card faces. Card backs render slanted red ovals with bold yellow-orange lettering. 
- **Staggered Dealing Animations**: Staggered, round-robin deal-outs flying from the center deck directly to player seats and local hands, simulating physical card distributions.
- **Gameplay Logic & Rules**:
  - Full game loops: turns, skips, reverses, colors, wild color selection overlays, and private drew-card play options.
  - **Stacking (+2 on +2, +4 on +4)**: Stacking penalties accumulate on top of players. If a player cannot stack, they draw the accumulated card total.
  - **UNO Declarations & Penalties**: Declare UNO safety with a button prior to playing down to one card. Catch other players holding 1 card who forgot to declare UNO and penalize them +2 cards.
- **Disconnection Grace Window**: If a player disconnects, they are given a 60-second grace window to reconnect and sync their states. If they exceed the timer, they are removed, host transfer is evaluated, and active turns are advanced.
- **Dual-Mode State Store**: Zero-setup local development using JavaScript Memory Maps, which seamlessly upgrades to a production-grade Redis cache when a `REDIS_URL` is provided.

---

## 🛠️ Technology Stack

* **Frontend**: React.js (Vite), Lucide Icons, Canvas Confetti, Vanilla CSS.
* **Backend**: Node.js, Express, Socket.io.
* **Database**: Redis (Optional, falls back to In-Memory mode).
* **Testing**: Jest.

---

## 📂 Project Structure

```text
/uno-game
├── package.json               # Root monorepo configuration & run scripts
├── .gitignore                 # Excludes caches, builds, node_modules, and secrets
├── README.md                  # Project documentation
├── /server                    # Node.js Express + Socket.io Server
│   ├── package.json           # Server configuration & dependencies
│   ├── index.js               # Entry point (room CRUD, Socket.io event loop)
│   ├── /redis
│   │   └── store.js           # Memory / Redis dual-mode store abstraction
│   ├── /gameLogic
│   │   ├── deck.js            # Standard 108 card UNO deck generator
│   │   ├── validator.js       # Play eligibility & stacking (+2/+4) evaluator
│   │   └── turnManager.js     # Action resolutions, turns, and drawing
│   └── /tests
│       └── game.test.js       # Jest unit test suite
└── /client                    # Vite + React Frontend
    ├── index.html             # Client entry with Plus Jakarta & Outfit Fonts
    ├── vite.config.js         # Port configuration
    └── /src
        ├── main.jsx           # Mount point
        ├── App.jsx            # Dynamic view switcher (Lobby <--> GameBoard)
        ├── index.css          # Slate dark mode theme, glassmorphism, & animations
        ├── /hooks
        │   └── useSocket.js   # Client socket hook, guest registry & state sync
        └── /components
            ├── Lobby.jsx      # Guest settings, code entry, and host panel
            ├── GameBoard.jsx  # Interactive seats, card table, & action buttons
            ├── PlayerHand.jsx # Curved overlapping card deck hands
            ├── ChatBox.jsx    # Room messages and floating reactions bar
            └── EmojiReactions.jsx # Floating emoji renderer
```

---

## 🚀 How to Run Locally

### 1. Install Dependencies
Run the following command at the root of the project to install all monorepo dependencies concurrently:
```bash
npm run install:all
```
*(If script execution policies are restricted in Windows PowerShell, execute via Command Prompt or run `cmd /c npm run install:all`)*.

### 2. Start Development Servers
Run the start command to concurrently launch both the React client (on `http://localhost:3000`) and the Express server (on `http://localhost:4000`):
```bash
npm run dev
```

### 3. Open the Game
Open [http://localhost:3000](http://localhost:3000) in multiple browser windows or tabs to simulate players, join rooms, and play UNO.

---

## 🧪 Running Tests

A complete suite of tests verifies the core UNO rules (deck generation, skips, reverses, +2/+4 stacking, and card matching).

To execute the Jest test suite:
```bash
npm run test:server
```

---

## ☁️ Deployment Guide

### Frontend: Vercel
1. Link your repository in the Vercel dashboard.
2. Select `client` as the **Root Directory** under Project Settings.
3. Set the **Framework Preset** to Vite.
4. Add the following environment variable:
   - `VITE_SERVER_URL`: Set this to your live backend server URL (e.g., `https://uno-backend.onrender.com`).

### Backend: Render / Railway / Fly.io
Since WebSockets require a persistent, stateful Node.js process (and are not compatible with standard Serverless functions), host the server on a persistent deployment platform:
1. Deploy the project with root starting script: `node server/index.js` (or set Root Directory to `server` and start script `node index.js`).
2. Add the following environment variables:
   - `PORT`: (automatically configured by the provider, defaults to 4000).
   - `REDIS_URL` (optional): Connect a Redis instance (e.g., from Render Redis, Railway Redis, or Redis Labs). If left blank, the server automatically defaults to memory storage mode.
