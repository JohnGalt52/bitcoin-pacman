# ₿itcoin Pac-Man

**Stack Sats, Avoid Shitcoins!**

A web-based Pac-Man clone with a Bitcoin theme. Your character eats Bitcoin ₿ pellets while avoiding shitcoin ghosts (Solana, Ethereum, Cardano, XRP).

## Features

- ✅ Custom Pac-Man character (your 2026 image)
- ✅ Bitcoin ₿ pellets to collect
- ✅ Shitcoin ghosts to avoid (SOL, ETH, ADA, XRP)
- ✅ "Nom nom" sound effects when eating pellets
- ✅ Classic Pac-Man gameplay with maze
- ✅ Lives, scoring, and level system
- ✅ Arrow key controls

## How to Play

1. **Start the server:**
   ```bash
   ./start-server.sh
   ```

2. **Open your browser:**
   Navigate to `http://localhost:8080`

3. **Controls:**
   - Use **Arrow Keys** to move
   - Eat all Bitcoin ₿ pellets
   - Avoid the shitcoin ghosts
   - Get hit 3 times = Game Over

## Game Mechanics

- **Small ₿ pellets:** 10 points
- **Large ₿ pellets:** 50 points (power pellets)
- **Lives:** 3 (lose one when a shitcoin catches you)
- **Level up:** Clear all pellets to advance

## Files

- `index.html` - Game page and UI
- `game.js` - Game logic and mechanics
- `pacman.jpg` - Your custom Pac-Man character
- `start-server.sh` - Launch script

## Tech Stack

- HTML5 Canvas
- Vanilla JavaScript
- Web Audio API (for sound effects)
- No dependencies, runs entirely in the browser

---

**Bitcoin only. No shitcoins allowed.**
