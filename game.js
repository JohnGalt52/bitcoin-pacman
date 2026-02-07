// Bitcoin Pac-Man v2.1 - Fixed & Enhanced Edition
// Fixes: ghost spawns, wall clipping, missing brace, ghost house exit
// Added: touch controls, speed scaling, invulnerability, better AI
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Make canvas focusable for keyboard input
canvas.tabIndex = 1;
canvas.focus();

// Increase canvas resolution for sharper graphics
canvas.width = 560;  // 28 * 20
canvas.height = 620; // 31 * 20

// Load original Pac-Man image
const pacmanImg = new Image();
pacmanImg.src = 'pacman.jpg';
let pacmanLoaded = false;
pacmanImg.onload = () => { pacmanLoaded = true; console.log('Pac-Man image loaded!'); };

// Game constants
const TILE_SIZE = 20;
const COLS = 28;
const ROWS = 31;

// Game state
let score = 0;
let lives = 3;
let level = 1;
let gameRunning = true;
let pelletCount = 0;
let powerMode = false;
let powerModeTimer = 0;
const POWER_MODE_DURATION = 10000;
let ghostEatCombo = 0; // For combo scoring: 200, 400, 800, 1600
let invulnerable = false;
let invulnerableTimer = 0;
const INVULNERABLE_DURATION = 2000; // 2 seconds after death
let gameStartTime = 0; // Track when game/level started for ghost scatter

// Player - enhanced with smooth animation
const player = {
    gridX: 13,
    gridY: 23,
    pixelX: 13 * TILE_SIZE,
    pixelY: 23 * TILE_SIZE,
    direction: 'right',
    nextDirection: 'right',
    speed: 2,  // Balanced speed
    mouthOpen: true,
    animFrame: 0
};

// Create offscreen canvas to process Pac-Man image (remove white background)
let pacmanProcessed = null;

function processPacmanImage() {
    if (!pacmanLoaded || pacmanProcessed) return;
    
    // Create offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = pacmanImg.width;
    offscreen.height = pacmanImg.height;
    const offCtx = offscreen.getContext('2d');
    
    // Draw original image
    offCtx.drawImage(pacmanImg, 0, 0);
    
    // Get image data and remove white pixels
    const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // If pixel is white or near-white, make it transparent
        if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // Set alpha to 0
        }
    }
    
    offCtx.putImageData(imageData, 0, 0);
    pacmanProcessed = offscreen;
    console.log('Pac-Man white background removed!');
}

// Draw Pac-Man using original image with rotation
function drawPacmanImage(x, y, size, direction) {
    if (!pacmanLoaded) return;
    
    // Process image on first draw
    if (!pacmanProcessed) processPacmanImage();
    
    ctx.save();
    ctx.translate(x + size/2, y + size/2);
    
    // Rotate based on direction
    const rotations = { right: 0, down: Math.PI/2, left: Math.PI, up: -Math.PI/2 };
    ctx.rotate(rotations[direction] || 0);
    
    // Flash when invulnerable
    if (invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }
    
    // Draw the processed image (white background removed)
    const img = pacmanProcessed || pacmanImg;
    ctx.drawImage(img, -size/2, -size/2, size, size);
    
    ctx.restore();
}

// ===== FIX #2: Ghost starting positions inside the ghost pen =====
// Ghost pen area is around rows 13-15, cols 11-16 (maze value 0)
// Each ghost has a scatter delay (ms after game start) before leaving the pen
const ghosts = [
    { name: 'SOL', color: '#14F195', gradient: ['#14F195', '#9945FF'],
      gridX: 11, gridY: 14, pixelX: 11*TILE_SIZE, pixelY: 14*TILE_SIZE,
      direction: 'up', personality: 'chase', vulnerable: false, eaten: false,
      baseX: 13, baseY: 14, inPen: true, scatterDelay: 0 },

    { name: 'ETH', color: '#627EEA', gradient: ['#627EEA', '#8A9EFF'],
      gridX: 16, gridY: 14, pixelX: 16*TILE_SIZE, pixelY: 14*TILE_SIZE,
      direction: 'up', personality: 'ambush', vulnerable: false, eaten: false,
      baseX: 14, baseY: 14, inPen: true, scatterDelay: 3000 },

    { name: 'ADA', color: '#0033AD', gradient: ['#0033AD', '#0052FF'],
      gridX: 13, gridY: 14, pixelX: 13*TILE_SIZE, pixelY: 14*TILE_SIZE,
      direction: 'up', personality: 'patrol', vulnerable: false, eaten: false,
      baseX: 13, baseY: 14, inPen: true, scatterDelay: 6000 },

    { name: 'XRP', color: '#23292F', gradient: ['#23292F', '#555'],
      gridX: 14, gridY: 14, pixelX: 14*TILE_SIZE, pixelY: 14*TILE_SIZE,
      direction: 'up', personality: 'random', vulnerable: false, eaten: false,
      baseX: 14, baseY: 14, inPen: true, scatterDelay: 9000 }
];

// Maze layout (0 = path, 1 = wall, 2 = pellet, 3 = power pellet)
const maze = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
    [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,0,1,1,1,0,0,1,1,1,0,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1],
    [0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,0],
    [1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
    [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
    [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
    [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// ========== ENHANCED AUDIO SYSTEM ==========
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let sirenOscillator = null;
let sirenGain = null;
let sirenLFO = null;
let sirenPlaying = false;

// Load "Fuck You Tao" sound effect for eating shitcoin ghosts
let fuckYouTaoBuffer = null;

fetch('sounds/fuck_you_tao.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedBuffer => {
        fuckYouTaoBuffer = decodedBuffer;
        console.log('🎵 "Fuck you Tao" sound loaded!');
    })
    .catch(err => console.warn('Could not load fuck_you_tao.mp3:', err));

function playFuckYouTao() {
    if (!fuckYouTaoBuffer) return;
    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = fuckYouTaoBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0.8; // Loud and proud
    
    source.start(0);
}

// Start background siren (classic Pac-Man ambience)
function startSiren() {
    if (sirenPlaying) return;
    
    sirenOscillator = audioContext.createOscillator();
    sirenGain = audioContext.createGain();
    sirenLFO = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    // LFO for wobble effect
    sirenLFO.frequency.value = powerMode ? 8 : 2; // Faster in power mode
    sirenLFO.type = 'sine';
    lfoGain.gain.value = powerMode ? 80 : 30;
    
    sirenLFO.connect(lfoGain);
    lfoGain.connect(sirenOscillator.frequency);
    
    sirenOscillator.type = 'sine';
    sirenOscillator.frequency.value = powerMode ? 220 : 110;
    sirenOscillator.connect(sirenGain);
    sirenGain.connect(audioContext.destination);
    sirenGain.gain.value = 0.05;
    
    sirenOscillator.start();
    sirenLFO.start();
    sirenPlaying = true;
}

function stopSiren() {
    if (!sirenPlaying) return;
    try {
        sirenOscillator?.stop();
        sirenLFO?.stop();
    } catch(e) { /* already stopped */ }
    sirenPlaying = false;
}

function updateSirenForPowerMode() {
    if (!sirenPlaying) return;
    
    // Speed up siren during power mode
    if (powerMode) {
        sirenOscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        sirenLFO.frequency.setValueAtTime(8, audioContext.currentTime);
    } else {
        sirenOscillator.frequency.setValueAtTime(110, audioContext.currentTime);
        sirenLFO.frequency.setValueAtTime(2, audioContext.currentTime);
    }
}

// Enhanced sound effects
function playNomSound() {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(300, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.08);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.08);
}

function playPowerPelletSound() {
    // Distinctive ascending tone for power pellet
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(200, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
    osc.type = 'square';
    
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
}

function playGhostEatenSound() {
    // Classic Pac-Man ghost eaten sound
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(800, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.3);
    osc.type = 'square';
    
    gain.gain.setValueAtTime(0.25, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
}

function playDeathSound() {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(500, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.8);
    osc.type = 'sawtooth';
    
    gain.gain.setValueAtTime(0.25, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.8);
}

function playLevelUpSound() {
    // Fun ascending arpeggio for level up
    [0, 0.1, 0.2, 0.3].forEach((delay, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 400 * Math.pow(1.25, i);
        osc.type = 'square';
        gain.gain.setValueAtTime(0.15, audioContext.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.15);
        osc.start(audioContext.currentTime + delay);
        osc.stop(audioContext.currentTime + delay + 0.15);
    });
}

// ========== DRAWING FUNCTIONS ==========

// Draw crypto coin logo for ghosts
function drawCoinLogo(ctx, ghost, x, y, size) {
    const centerX = x + size/2;
    const centerY = y + size/2 - 2;
    const radius = size/2 - 2;
    
    // Create gradient
    const grad = ctx.createRadialGradient(centerX, centerY - 3, 0, centerX, centerY, radius);
    grad.addColorStop(0, ghost.gradient[1]);
    grad.addColorStop(1, ghost.gradient[0]);
    
    // Draw coin circle
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add 3D effect (highlight)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(centerX - 2, centerY - 3, radius/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw coin-specific symbol
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size/2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (ghost.name === 'SOL') {
        // Solana - three horizontal bars
        ctx.fillRect(centerX - 5, centerY - 4, 10, 2);
        ctx.fillRect(centerX - 5, centerY - 1, 10, 2);
        ctx.fillRect(centerX - 5, centerY + 2, 10, 2);
    } else if (ghost.name === 'ETH') {
        // Ethereum diamond
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 6);
        ctx.lineTo(centerX + 5, centerY);
        ctx.lineTo(centerX, centerY + 6);
        ctx.lineTo(centerX - 5, centerY);
        ctx.closePath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else if (ghost.name === 'ADA') {
        // Cardano - stylized A
        ctx.fillText('A', centerX, centerY + 1);
    } else if (ghost.name === 'XRP') {
        // Ripple X
        ctx.fillText('X', centerX, centerY + 1);
    }
    
    // Coin name below
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.fillText(ghost.name, centerX, y + size + 8);
}

// Draw vulnerable ghost (scared blue)
function drawVulnerableGhost(ctx, ghost, x, y, size) {
    const flashMode = powerMode && (powerModeTimer - Date.now() < 2000);
    const isFlashing = flashMode && Math.floor(Date.now() / 150) % 2 === 0;
    
    // Body
    ctx.fillStyle = isFlashing ? '#fff' : '#3333ff';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2 - 2, size/2 - 2, Math.PI, 0);
    ctx.lineTo(x + size - 2, y + size);
    
    // Wavy bottom
    for (let i = 0; i < 4; i++) {
        const wx = x + size - 2 - (i * size/4);
        ctx.lineTo(wx - size/8, y + size - 4);
        ctx.lineTo(wx - size/4, y + size);
    }
    ctx.closePath();
    ctx.fill();
    
    // Scared face
    ctx.fillStyle = isFlashing ? '#f00' : '#fff';
    // Eyes
    ctx.fillRect(x + 5, y + 6, 3, 4);
    ctx.fillRect(x + 12, y + 6, 3, 4);
    // Wavy mouth
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 13);
    for (let i = 0; i < 5; i++) {
        ctx.lineTo(x + 4 + i * 3, y + 13 + (i % 2 === 0 ? 0 : 2));
    }
    ctx.strokeStyle = isFlashing ? '#f00' : '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

// Draw eaten ghost (eyes only, returning to pen)
function drawEatenGhost(ctx, ghost, x, y, size) {
    // Just draw the eyes heading back to base
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 6, y + 8, 3, 0, Math.PI * 2);
    ctx.arc(x + 14, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils pointing toward base
    const dx = ghost.baseX * TILE_SIZE - ghost.pixelX;
    const dy = ghost.baseY * TILE_SIZE - ghost.pixelY;
    const angle = Math.atan2(dy, dx);
    const pupilDist = 1.5;
    
    ctx.fillStyle = '#00f';
    ctx.beginPath();
    ctx.arc(x + 6 + Math.cos(angle) * pupilDist, y + 8 + Math.sin(angle) * pupilDist, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 14 + Math.cos(angle) * pupilDist, y + 8 + Math.sin(angle) * pupilDist, 1.5, 0, Math.PI * 2);
    ctx.fill();
}

// Draw maze with improved graphics
function drawMaze() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = maze[row][col];
            const x = col * TILE_SIZE;
            const y = row * TILE_SIZE;
            
            if (cell === 1) {
                // Enhanced wall with gradient
                const wallGrad = ctx.createLinearGradient(x, y, x + TILE_SIZE, y + TILE_SIZE);
                wallGrad.addColorStop(0, '#2121ff');
                wallGrad.addColorStop(1, '#0000aa');
                ctx.fillStyle = wallGrad;
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                
                // Inner highlight
                ctx.strokeStyle = '#4444ff';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            } else if (cell === 2) {
                // Bitcoin pellet (small)
                ctx.fillStyle = '#f7931a';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('₿', x + TILE_SIZE/2, y + 14);
            } else if (cell === 3) {
                // Power pellet (pulsing Bitcoin)
                const pulse = Math.sin(Date.now() / 200) * 0.3 + 1;
                ctx.fillStyle = '#f7931a';
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 7 * pulse, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${8 * pulse}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('₿', x + TILE_SIZE/2, y + TILE_SIZE/2 + 3);
            }
        }
    }
    ctx.textAlign = 'left';
}

// Draw player
function drawPlayer() {
    drawPacmanImage(
        player.pixelX, 
        player.pixelY, 
        TILE_SIZE, 
        player.direction
    );
}

// Draw ghosts with coin logos
function drawGhosts() {
    ghosts.forEach(ghost => {
        const x = ghost.pixelX;
        const y = ghost.pixelY;
        
        if (ghost.eaten) {
            drawEatenGhost(ctx, ghost, x, y, TILE_SIZE);
        } else if (ghost.vulnerable) {
            drawVulnerableGhost(ctx, ghost, x, y, TILE_SIZE);
        } else {
            drawCoinLogo(ctx, ghost, x, y, TILE_SIZE);
        }
    });
}

// ========== IMPROVED COLLISION DETECTION ==========
function checkCollision(x1, y1, x2, y2, threshold = 10) {
    const dx = (x1 + TILE_SIZE/2) - (x2 + TILE_SIZE/2);
    const dy = (y1 + TILE_SIZE/2) - (y2 + TILE_SIZE/2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < threshold;
}

// Count pellets
function countPellets() {
    let count = 0;
    for (let row of maze) {
        for (let cell of row) {
            if (cell === 2 || cell === 3) count++;
        }
    }
    return count;
}

pelletCount = countPellets();

// Check if tile is walkable
function isWalkable(gridX, gridY) {
    if (gridY < 0 || gridY >= ROWS) return false;
    // Wrap horizontally
    if (gridX < 0) gridX = COLS - 1;
    if (gridX >= COLS) gridX = 0;
    return maze[gridY][gridX] !== 1;
}

// ===== FIX #5: Speed increases per level =====
function getPlayerSpeed() {
    return 2 + (level - 1) * 0.15; // Slight speed increase per level
}

function getGhostSpeed() {
    return 2 + (level - 1) * 0.2; // Ghosts get faster each level
}

// Move player - simplified grid-based movement
// ===== FIX #1: Missing closing brace fixed =====
function movePlayer() {
    player.speed = getPlayerSpeed();
    
    const centerX = player.gridX * TILE_SIZE;
    const centerY = player.gridY * TILE_SIZE;
    
    // Calculate distance to tile center
    const distToCenter = Math.abs(player.pixelX - centerX) + Math.abs(player.pixelY - centerY);
    
    // At tile center - can change direction
    if (distToCenter < player.speed) {
        // Snap to center
        player.pixelX = centerX;
        player.pixelY = centerY;
        
        // Try requested direction first
        let tryX = player.gridX;
        let tryY = player.gridY;
        if (player.nextDirection === 'up') tryY--;
        else if (player.nextDirection === 'down') tryY++;
        else if (player.nextDirection === 'left') tryX--;
        else if (player.nextDirection === 'right') tryX++;
        
        if (isWalkable(tryX, tryY)) {
            player.direction = player.nextDirection;
        }
        
        // Check if current direction is blocked
        let currX = player.gridX;
        let currY = player.gridY;
        if (player.direction === 'up') currY--;
        else if (player.direction === 'down') currY++;
        else if (player.direction === 'left') currX--;
        else if (player.direction === 'right') currX++;
        
        if (!isWalkable(currX, currY)) {
            // Stop - can't move in current direction
            return;
        }
    }
    
    // Move in current direction
    if (player.direction === 'up') player.pixelY -= player.speed;
    else if (player.direction === 'down') player.pixelY += player.speed;
    else if (player.direction === 'left') player.pixelX -= player.speed;
    else if (player.direction === 'right') player.pixelX += player.speed;
    
    // Update grid position
    player.gridX = Math.round(player.pixelX / TILE_SIZE);
    player.gridY = Math.round(player.pixelY / TILE_SIZE);
    
    // Clamp grid position
    player.gridX = Math.max(0, Math.min(COLS - 1, player.gridX));
    player.gridY = Math.max(0, Math.min(ROWS - 1, player.gridY));
    
    // Tunnel wrap
    if (player.pixelX < -TILE_SIZE / 2) {
        player.pixelX = (COLS - 1) * TILE_SIZE;
        player.gridX = COLS - 1;
    }
    if (player.pixelX > (COLS - 0.5) * TILE_SIZE) {
        player.pixelX = 0;
        player.gridX = 0;
    }
    
    // Check pellets when near tile center
    const cell = maze[player.gridY]?.[player.gridX];
    
    if (cell === 2) {
        maze[player.gridY][player.gridX] = 0;
        score += 10;
        pelletCount--;
        playNomSound();
        updateStats();
    } else if (cell === 3) {
        maze[player.gridY][player.gridX] = 0;
        score += 50;
        pelletCount--;
        playPowerPelletSound();
        
        // Power mode!
        powerMode = true;
        powerModeTimer = Date.now() + POWER_MODE_DURATION;
        ghostEatCombo = 0;
        ghosts.forEach(g => {
            if (!g.eaten) g.vulnerable = true;
        });
        
        updateSirenForPowerMode();
    } // <-- FIX #1: This closing brace was missing!
    
    if (pelletCount === 0) {
        level++;
        playLevelUpSound();
        resetLevel();
    }
}

// ===== FIX #4: Ghost house exit logic =====
// Ghost pen exit path: from pen interior → (13, 12) → (13, 11) → up and out
function moveGhostOutOfPen(ghost) {
    const exitX = 13; // Ghost house exit column
    const exitY = 11; // Just above the pen gate
    
    const targetPixelX = exitX * TILE_SIZE;
    const targetPixelY = exitY * TILE_SIZE;
    
    const dx = targetPixelX - ghost.pixelX;
    const dy = targetPixelY - ghost.pixelY;
    const penSpeed = 1.5;
    
    // Move horizontally to exit column first
    if (Math.abs(dx) > penSpeed) {
        ghost.pixelX += Math.sign(dx) * penSpeed;
        ghost.direction = dx > 0 ? 'right' : 'left';
    }
    // Then move vertically up to exit
    else if (Math.abs(dy) > penSpeed) {
        ghost.pixelX = targetPixelX; // Snap X
        ghost.pixelY += Math.sign(dy) * penSpeed;
        ghost.direction = dy > 0 ? 'down' : 'up';
    }
    // Reached exit
    else {
        ghost.pixelX = targetPixelX;
        ghost.pixelY = targetPixelY;
        ghost.gridX = exitX;
        ghost.gridY = exitY;
        ghost.inPen = false;
        ghost.direction = 'left'; // Start heading left out of the pen area
    }
    
    // Update grid position while in pen
    ghost.gridX = Math.round(ghost.pixelX / TILE_SIZE);
    ghost.gridY = Math.round(ghost.pixelY / TILE_SIZE);
}

// ===== FIX #3: Ghost wall clipping fix =====
// Ghost AI with proper tile-center snapping and pen exit
function moveGhosts() {
    const baseGhostSpeed = getGhostSpeed();
    const now = Date.now();
    const elapsed = now - gameStartTime;
    
    ghosts.forEach(ghost => {
        // ===== FIX #4: Ghost house exit with scatter delays =====
        if (ghost.inPen) {
            // Wait for scatter delay before exiting
            if (elapsed < ghost.scatterDelay) {
                // Bob up and down in pen while waiting
                ghost.pixelY = ghost.baseY * TILE_SIZE + Math.sin(now / 300) * 3;
                ghost.gridY = ghost.baseY;
                return;
            }
            // Time to exit the pen
            moveGhostOutOfPen(ghost);
            return;
        }
        
        if (ghost.eaten) {
            // Return to base (pen) - eyes only
            const dx = ghost.baseX * TILE_SIZE - ghost.pixelX;
            const dy = ghost.baseY * TILE_SIZE - ghost.pixelY;
            
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
                ghost.pixelX = ghost.baseX * TILE_SIZE;
                ghost.pixelY = ghost.baseY * TILE_SIZE;
                ghost.gridX = ghost.baseX;
                ghost.gridY = ghost.baseY;
                ghost.eaten = false;
                ghost.inPen = true;
                ghost.scatterDelay = 0; // Exit immediately when reviving
            } else {
                // Fast return - move toward base ignoring walls
                const returnSpeed = 4;
                if (Math.abs(dx) > Math.abs(dy)) {
                    ghost.pixelX += Math.sign(dx) * returnSpeed;
                    ghost.direction = dx > 0 ? 'right' : 'left';
                } else {
                    ghost.pixelY += Math.sign(dy) * returnSpeed;
                    ghost.direction = dy > 0 ? 'down' : 'up';
                }
                ghost.gridX = Math.round(ghost.pixelX / TILE_SIZE);
                ghost.gridY = Math.round(ghost.pixelY / TILE_SIZE);
            }
            return;
        }
        
        const speed = ghost.vulnerable ? baseGhostSpeed * 0.5 : baseGhostSpeed;
        
        // ===== FIX #3: Proper tile center snapping =====
        const tileCenterX = ghost.gridX * TILE_SIZE;
        const tileCenterY = ghost.gridY * TILE_SIZE;
        const distToCenterX = Math.abs(ghost.pixelX - tileCenterX);
        const distToCenterY = Math.abs(ghost.pixelY - tileCenterY);
        
        // Decision at tile center
        if (distToCenterX < speed && distToCenterY < speed) {
            // SNAP exactly to tile center before choosing new direction
            ghost.pixelX = tileCenterX;
            ghost.pixelY = tileCenterY;
            
            let targetX, targetY;
            
            if (ghost.vulnerable) {
                // Run away from player
                targetX = ghost.gridX + (ghost.gridX - player.gridX);
                targetY = ghost.gridY + (ghost.gridY - player.gridY);
            } else {
                // ===== FIX #5: Better ghost AI variety =====
                switch (ghost.personality) {
                    case 'chase':
                        // Blinky - direct chase
                        targetX = player.gridX;
                        targetY = player.gridY;
                        break;
                    case 'ambush':
                        // Pinky - target 4 tiles ahead of player
                        targetX = player.gridX + (player.direction === 'right' ? 4 : player.direction === 'left' ? -4 : 0);
                        targetY = player.gridY + (player.direction === 'down' ? 4 : player.direction === 'up' ? -4 : 0);
                        break;
                    case 'patrol':
                        // Inky - uses Blinky's position for pincer attack
                        // Vector from SOL (chase ghost) to player, doubled
                        const blinky = ghosts[0];
                        const vecX = player.gridX - blinky.gridX;
                        const vecY = player.gridY - blinky.gridY;
                        targetX = player.gridX + vecX;
                        targetY = player.gridY + vecY;
                        break;
                    default:
                        // Clyde - chase when far, scatter when close
                        const distToPlayer = Math.abs(ghost.gridX - player.gridX) + Math.abs(ghost.gridY - player.gridY);
                        if (distToPlayer > 8) {
                            targetX = player.gridX;
                            targetY = player.gridY;
                        } else {
                            // Scatter to bottom-left corner
                            targetX = 1;
                            targetY = 29;
                        }
                }
            }
            
            const dirs = ['up', 'down', 'left', 'right'];
            const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
            let bestDir = ghost.direction;
            let bestDist = Infinity;
            let validDirs = [];
            
            // Find all valid directions (excluding 180 turns initially)
            for (const dir of dirs) {
                let testX = ghost.gridX;
                let testY = ghost.gridY;
                
                if (dir === 'up') testY--;
                else if (dir === 'down') testY++;
                else if (dir === 'left') testX--;
                else if (dir === 'right') testX++;
                
                if (isWalkable(testX, testY)) {
                    validDirs.push({ dir, testX, testY });
                    // Prefer non-180 turns
                    if (dir !== opposite[ghost.direction]) {
                        const dist = Math.abs(testX - targetX) + Math.abs(testY - targetY);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestDir = dir;
                        }
                    }
                }
            }
            
            // If stuck (no valid non-180 moves), allow 180 turn
            if (bestDist === Infinity && validDirs.length > 0) {
                bestDir = validDirs[0].dir;
            }
            
            // If truly stuck (shouldn't happen in valid maze), don't move
            if (validDirs.length === 0) {
                return;
            }
            
            ghost.direction = bestDir;
        }
        
        // Move in current direction
        if (ghost.direction === 'up') ghost.pixelY -= speed;
        else if (ghost.direction === 'down') ghost.pixelY += speed;
        else if (ghost.direction === 'left') ghost.pixelX -= speed;
        else if (ghost.direction === 'right') ghost.pixelX += speed;
        
        // ===== FIX #3: Proper grid position clamping =====
        ghost.gridX = Math.round(ghost.pixelX / TILE_SIZE);
        ghost.gridY = Math.round(ghost.pixelY / TILE_SIZE);
        
        // Clamp grid positions to valid range
        ghost.gridX = Math.max(0, Math.min(COLS - 1, ghost.gridX));
        ghost.gridY = Math.max(0, Math.min(ROWS - 1, ghost.gridY));
        
        // Tunnel wrap
        if (ghost.pixelX < -TILE_SIZE) {
            ghost.pixelX = COLS * TILE_SIZE;
            ghost.gridX = COLS - 1;
        }
        if (ghost.pixelX > COLS * TILE_SIZE) {
            ghost.pixelX = -TILE_SIZE;
            ghost.gridX = 0;
        }
    });
}

// Check ghost collisions with pixel-perfect detection
// ===== FIX #5: Invulnerability after death =====
function checkGhostCollision() {
    // Skip collision during invulnerability frames
    if (invulnerable) {
        if (Date.now() > invulnerableTimer) {
            invulnerable = false;
        }
        return;
    }
    
    ghosts.forEach(ghost => {
        if (ghost.eaten || ghost.inPen) return;
        
        if (checkCollision(player.pixelX, player.pixelY, ghost.pixelX, ghost.pixelY, 14)) {
            // Ghost is edible if vulnerable (blue/scared state)
            if (ghost.vulnerable) {
                ghost.eaten = true;
                ghost.vulnerable = false;
                
                // Combo scoring: 200, 400, 800, 1600
                ghostEatCombo++;
                const points = 200 * Math.pow(2, ghostEatCombo - 1);
                score += points;
                
                // Play "Fuck you Tao!" when eating shitcoin ghosts
                playFuckYouTao();
                updateStats();
                
                // Show points briefly
                showFloatingPoints(ghost.pixelX, ghost.pixelY, points);
            } else {
                lives--;
                playDeathSound();
                stopSiren();
                updateStats();
                
                if (lives <= 0) {
                    gameOver();
                } else {
                    // Brief invulnerability after respawn
                    invulnerable = true;
                    invulnerableTimer = Date.now() + INVULNERABLE_DURATION;
                    
                    setTimeout(() => {
                        resetPositions();
                        startSiren();
                    }, 1000);
                }
            }
        }
    });
}

// Floating points display
let floatingTexts = [];

function showFloatingPoints(x, y, points) {
    floatingTexts.push({ x, y, points, alpha: 1, vy: -2 });
}

function drawFloatingPoints() {
    floatingTexts = floatingTexts.filter(ft => {
        ctx.fillStyle = `rgba(255, 255, 255, ${ft.alpha})`;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(ft.points, ft.x + TILE_SIZE/2, ft.y);
        
        ft.y += ft.vy;
        ft.alpha -= 0.02;
        
        return ft.alpha > 0;
    });
    ctx.textAlign = 'left';
}

// Reset positions
function resetPositions() {
    player.gridX = 13;
    player.gridY = 23;
    player.pixelX = 13 * TILE_SIZE;
    player.pixelY = 23 * TILE_SIZE;
    player.direction = 'right';
    player.nextDirection = 'right';
    
    gameStartTime = Date.now();
    
    ghosts[0].gridX = 11; ghosts[0].gridY = 14;
    ghosts[0].pixelX = 11 * TILE_SIZE; ghosts[0].pixelY = 14 * TILE_SIZE;
    ghosts[0].inPen = true; ghosts[0].scatterDelay = 0;
    
    ghosts[1].gridX = 16; ghosts[1].gridY = 14;
    ghosts[1].pixelX = 16 * TILE_SIZE; ghosts[1].pixelY = 14 * TILE_SIZE;
    ghosts[1].inPen = true; ghosts[1].scatterDelay = 3000;
    
    ghosts[2].gridX = 13; ghosts[2].gridY = 14;
    ghosts[2].pixelX = 13 * TILE_SIZE; ghosts[2].pixelY = 14 * TILE_SIZE;
    ghosts[2].inPen = true; ghosts[2].scatterDelay = 6000;
    
    ghosts[3].gridX = 14; ghosts[3].gridY = 14;
    ghosts[3].pixelX = 14 * TILE_SIZE; ghosts[3].pixelY = 14 * TILE_SIZE;
    ghosts[3].inPen = true; ghosts[3].scatterDelay = 9000;
    
    ghosts.forEach(ghost => {
        ghost.vulnerable = false;
        ghost.eaten = false;
        ghost.direction = 'up';
    });
    
    powerMode = false;
    ghostEatCombo = 0;
}

// Reset level
function resetLevel() {
    // Restore pellets
    const originalMaze = [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
        [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,0,1,1,1,0,0,1,1,1,0,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1],
        [0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,0],
        [1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
        [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
        [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
        [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
        [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
        [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ];
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            maze[row][col] = originalMaze[row][col];
        }
    }
    
    pelletCount = countPellets();
    resetPositions();
    updateStats();
}

// Update stats display
function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
}

// Game over
function gameOver() {
    gameRunning = false;
    stopSiren();
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
}

// Keyboard controls
// Click to focus canvas (needed for keyboard input)
canvas.addEventListener('click', () => {
    canvas.focus();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (!sirenPlaying && gameRunning) {
        startSiren();
    }
});

// Keyboard controls - listen on both document and canvas
function handleKeydown(e) {
    // Resume audio context on first interaction
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (!sirenPlaying && gameRunning) {
        startSiren();
    }
    
    if (!gameRunning) return;
    
    const keyMap = {
        'ArrowUp': 'up', 'w': 'up', 'W': 'up',
        'ArrowDown': 'down', 's': 'down', 'S': 'down',
        'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
        'ArrowRight': 'right', 'd': 'right', 'D': 'right'
    };
    
    if (keyMap[e.key]) {
        player.nextDirection = keyMap[e.key];
        e.preventDefault();
    }
}

document.addEventListener('keydown', handleKeydown);
canvas.addEventListener('keydown', handleKeydown);

// ===== FIX #5: Touch/swipe controls for mobile =====
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    // Resume audio on first touch
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (!sirenPlaying && gameRunning) {
        startSiren();
    }
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const swipeTime = Date.now() - touchStartTime;
    
    // Minimum swipe distance (pixels) and max time (ms)
    const minDist = 20;
    const maxTime = 500;
    
    if (swipeTime > maxTime) return;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (Math.abs(dx) > minDist) {
            player.nextDirection = dx > 0 ? 'right' : 'left';
        }
    } else {
        // Vertical swipe
        if (Math.abs(dy) > minDist) {
            player.nextDirection = dy > 0 ? 'down' : 'up';
        }
    }
}, { passive: false });

// Also support tap-to-direct (tap in quadrant relative to player)
document.addEventListener('touchstart', (e) => {
    // Only if touching outside canvas (on-screen directional areas)
    if (e.target === canvas) return;
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { passive: true });

// Game loop
function gameLoop() {
    if (!gameRunning) return;
    
    // Move and check collisions FIRST
    movePlayer();
    moveGhosts();
    checkGhostCollision();
    
    // THEN check power mode timer (so player gets last chance to eat ghosts)
    if (powerMode && Date.now() >= powerModeTimer) {
        powerMode = false;
        ghostEatCombo = 0;
        ghosts.forEach(g => g.vulnerable = false);
        updateSirenForPowerMode();
    }
    
    // Draw everything
    drawMaze();
    drawPlayer();
    drawGhosts();
    drawFloatingPoints();
    
    requestAnimationFrame(gameLoop);
}

// Initialize game start time
gameStartTime = Date.now();

// Start game
console.log('Bitcoin Pac-Man v2.1 loaded!');
console.log('Use arrow keys, WASD, or swipe to move');
console.log('Eat Bitcoin pellets, avoid shitcoin ghosts!');
gameLoop();
