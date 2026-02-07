// Bitcoin Grepples-Man v4.0 - Simplified Ghost Spawn + Random Wall Colors
// Fixes: Ghosts spawn ABOVE pen (no pen exit logic), random wall colors per level
// No more pen logic - ghosts spawn at row 11 with staggered timers
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Make canvas focusable for keyboard input
canvas.tabIndex = 1;
canvas.focus();

// Canvas internal resolution (CSS handles visual scaling)
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
let gamePaused = false;
let pelletCount = 0;
let powerMode = false;
let powerModeTimer = 0;
const POWER_MODE_DURATION = 10000;
let ghostEatCombo = 0;
let invulnerable = false;
let invulnerableTimer = 0;
const INVULNERABLE_DURATION = 2000;

// CRITICAL: gameStartTime tracks when gameplay begins (for ghost spawn timing)
let gameStartTime = Date.now();

// Wall color palettes - randomized on level change (Level 1 stays classic blue)
const WALL_PALETTES = [
    { main: '#2121ff', dark: '#0000aa', highlight: '#4444ff' },  // Classic blue (Level 1)
    { main: '#ff2121', dark: '#aa0000', highlight: '#ff4444' },  // Red
    { main: '#21ff21', dark: '#00aa00', highlight: '#44ff44' },  // Green
    { main: '#ff21ff', dark: '#aa00aa', highlight: '#ff44ff' },  // Purple/Magenta
    { main: '#ff8c21', dark: '#aa5500', highlight: '#ffaa44' },  // Orange
    { main: '#21ffff', dark: '#00aaaa', highlight: '#44ffff' },  // Cyan
    { main: '#ff69b4', dark: '#aa3366', highlight: '#ff8fc4' },  // Pink
    { main: '#ffd700', dark: '#aa8c00', highlight: '#ffe944' },  // Gold
];
let currentWallColors = WALL_PALETTES[0]; // Start with classic blue

// Celebration / countdown state
let celebrationActive = false;
let celebrationStartTime = 0;
let celebrationLevel = 0;
let countdownActive = false;
let countdownStartTime = 0;
let countdownText = '';
let mazeFlashColor = null;

// Player
const player = {
    gridX: 13,
    gridY: 23,
    pixelX: 13 * TILE_SIZE,
    pixelY: 23 * TILE_SIZE,
    direction: 'right',
    nextDirection: 'right',
    speed: 2,
    mouthOpen: true,
    animFrame: 0
};

// Create offscreen canvas to process Pac-Man image (remove white background)
let pacmanProcessed = null;

function processPacmanImage() {
    if (!pacmanLoaded || pacmanProcessed) return;
    
    const offscreen = document.createElement('canvas');
    offscreen.width = pacmanImg.width;
    offscreen.height = pacmanImg.height;
    const offCtx = offscreen.getContext('2d');
    
    offCtx.drawImage(pacmanImg, 0, 0);
    
    const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0;
        }
    }
    
    offCtx.putImageData(imageData, 0, 0);
    pacmanProcessed = offscreen;
    console.log('Pac-Man white background removed!');
}

function drawPacmanImage(x, y, size, direction) {
    if (!pacmanLoaded) return;
    
    if (!pacmanProcessed) processPacmanImage();
    
    ctx.save();
    ctx.translate(x + size/2, y + size/2);
    
    const rotations = { right: 0, down: Math.PI/2, left: Math.PI, up: -Math.PI/2 };
    ctx.rotate(rotations[direction] || 0);
    
    if (invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }
    
    const img = pacmanProcessed || pacmanImg;
    ctx.drawImage(img, -size/2, -size/2, size, size);
    
    ctx.restore();
}

// Ghost definitions
// NEW: Ghosts spawn ABOVE the pen at row 11 (exit row) - no pen exit logic needed!
// spawnDelay: milliseconds after gameStartTime when ghost becomes visible
// visible: false = waiting to spawn, true = active in playfield
// SOL spawns immediately (0), ETH at 3s, ADA at 6s, XRP at 9s
const GHOST_SPAWN_ROW = 11;  // Row above the pen - ghosts spawn here directly
const ghosts = [
    { name: 'SOL', color: '#14F195', gradient: ['#14F195', '#9945FF'],
      gridX: 13, gridY: GHOST_SPAWN_ROW, pixelX: 13*TILE_SIZE, pixelY: GHOST_SPAWN_ROW*TILE_SIZE,
      direction: 'left', personality: 'chase', vulnerable: false, eaten: false,
      baseX: 13, baseY: 14, visible: true, spawnDelay: 0 },

    { name: 'ETH', color: '#627EEA', gradient: ['#627EEA', '#8A9EFF'],
      gridX: 13, gridY: GHOST_SPAWN_ROW, pixelX: 13*TILE_SIZE, pixelY: GHOST_SPAWN_ROW*TILE_SIZE,
      direction: 'left', personality: 'ambush', vulnerable: false, eaten: false,
      baseX: 14, baseY: 14, visible: false, spawnDelay: 3000 },

    { name: 'ADA', color: '#0033AD', gradient: ['#0033AD', '#0052FF'],
      gridX: 13, gridY: GHOST_SPAWN_ROW, pixelX: 13*TILE_SIZE, pixelY: GHOST_SPAWN_ROW*TILE_SIZE,
      direction: 'left', personality: 'patrol', vulnerable: false, eaten: false,
      baseX: 13, baseY: 14, visible: false, spawnDelay: 6000 },

    { name: 'XRP', color: '#23292F', gradient: ['#23292F', '#555'],
      gridX: 13, gridY: GHOST_SPAWN_ROW, pixelX: 13*TILE_SIZE, pixelY: GHOST_SPAWN_ROW*TILE_SIZE,
      direction: 'left', personality: 'random', vulnerable: false, eaten: false,
      baseX: 14, baseY: 14, visible: false, spawnDelay: 9000 }
];

// Original maze layout (stored once for resets)
const ORIGINAL_MAZE = [
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

// Mutable maze (copied from original each level)
const maze = [];
for (let row = 0; row < ORIGINAL_MAZE.length; row++) {
    maze[row] = [...ORIGINAL_MAZE[row]];
}

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
    gainNode.gain.value = 0.8;
    
    source.start(0);
}

function startSiren() {
    if (sirenPlaying) return;
    
    sirenOscillator = audioContext.createOscillator();
    sirenGain = audioContext.createGain();
    sirenLFO = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    sirenLFO.frequency.value = powerMode ? 8 : 2;
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
    
    if (powerMode) {
        sirenOscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        sirenLFO.frequency.setValueAtTime(8, audioContext.currentTime);
    } else {
        sirenOscillator.frequency.setValueAtTime(110, audioContext.currentTime);
        sirenLFO.frequency.setValueAtTime(2, audioContext.currentTime);
    }
}

// Sound effects
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

function playVictorySound() {
    const notes = [
        { freq: 523, delay: 0,    dur: 0.15, type: 'square' },
        { freq: 587, delay: 0.12, dur: 0.15, type: 'square' },
        { freq: 659, delay: 0.24, dur: 0.15, type: 'square' },
        { freq: 784, delay: 0.36, dur: 0.15, type: 'square' },
        { freq: 880, delay: 0.48, dur: 0.2,  type: 'square' },
        { freq: 1047, delay: 0.6, dur: 0.4,  type: 'square' },
        { freq: 392, delay: 0,    dur: 0.15, type: 'triangle' },
        { freq: 440, delay: 0.12, dur: 0.15, type: 'triangle' },
        { freq: 494, delay: 0.24, dur: 0.15, type: 'triangle' },
        { freq: 587, delay: 0.36, dur: 0.15, type: 'triangle' },
        { freq: 659, delay: 0.48, dur: 0.2,  type: 'triangle' },
        { freq: 784, delay: 0.6,  dur: 0.4,  type: 'triangle' },
        { freq: 1319, delay: 0.85, dur: 0.3, type: 'sine' },
        { freq: 1568, delay: 0.95, dur: 0.3, type: 'sine' },
        { freq: 2093, delay: 1.05, dur: 0.5, type: 'sine' },
    ];
    
    notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = note.freq;
        osc.type = note.type;
        gain.gain.setValueAtTime(0.12, audioContext.currentTime + note.delay);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.delay + note.dur);
        osc.start(audioContext.currentTime + note.delay);
        osc.stop(audioContext.currentTime + note.delay + note.dur);
    });
}

function playLevelUpSound() {
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

function playReadySound() {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 660;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
}

// ========== DRAWING FUNCTIONS ==========

function drawCoinLogo(ctx, ghost, x, y, size) {
    const centerX = x + size/2;
    const centerY = y + size/2 - 2;
    const radius = size/2 - 2;
    
    const grad = ctx.createRadialGradient(centerX, centerY - 3, 0, centerX, centerY, radius);
    grad.addColorStop(0, ghost.gradient[1]);
    grad.addColorStop(1, ghost.gradient[0]);
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(centerX - 2, centerY - 3, radius/2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size/2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (ghost.name === 'SOL') {
        ctx.fillRect(centerX - 5, centerY - 4, 10, 2);
        ctx.fillRect(centerX - 5, centerY - 1, 10, 2);
        ctx.fillRect(centerX - 5, centerY + 2, 10, 2);
    } else if (ghost.name === 'ETH') {
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
        ctx.fillText('A', centerX, centerY + 1);
    } else if (ghost.name === 'XRP') {
        ctx.fillText('X', centerX, centerY + 1);
    }
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.fillText(ghost.name, centerX, y + size + 8);
}

function drawVulnerableGhost(ctx, ghost, x, y, size) {
    const flashMode = powerMode && (powerModeTimer - Date.now() < 2000);
    const isFlashing = flashMode && Math.floor(Date.now() / 150) % 2 === 0;
    
    ctx.fillStyle = isFlashing ? '#fff' : '#3333ff';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2 - 2, size/2 - 2, Math.PI, 0);
    ctx.lineTo(x + size - 2, y + size);
    
    for (let i = 0; i < 4; i++) {
        const wx = x + size - 2 - (i * size/4);
        ctx.lineTo(wx - size/8, y + size - 4);
        ctx.lineTo(wx - size/4, y + size);
    }
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = isFlashing ? '#f00' : '#fff';
    ctx.fillRect(x + 5, y + 6, 3, 4);
    ctx.fillRect(x + 12, y + 6, 3, 4);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 13);
    for (let i = 0; i < 5; i++) {
        ctx.lineTo(x + 4 + i * 3, y + 13 + (i % 2 === 0 ? 0 : 2));
    }
    ctx.strokeStyle = isFlashing ? '#f00' : '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawEatenGhost(ctx, ghost, x, y, size) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 6, y + 8, 3, 0, Math.PI * 2);
    ctx.arc(x + 14, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    
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

function drawMaze() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = maze[row][col];
            const x = col * TILE_SIZE;
            const y = row * TILE_SIZE;
            
            if (cell === 1) {
                if (mazeFlashColor) {
                    ctx.fillStyle = mazeFlashColor;
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                } else {
                    // Use currentWallColors (randomized per level, Level 1 = blue)
                    const wallGrad = ctx.createLinearGradient(x, y, x + TILE_SIZE, y + TILE_SIZE);
                    wallGrad.addColorStop(0, currentWallColors.main);
                    wallGrad.addColorStop(1, currentWallColors.dark);
                    ctx.fillStyle = wallGrad;
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    
                    ctx.strokeStyle = currentWallColors.highlight;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                }
            } else if (cell === 2) {
                ctx.fillStyle = '#f7931a';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('₿', x + TILE_SIZE/2, y + 14);
            } else if (cell === 3) {
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

function drawPlayer() {
    drawPacmanImage(
        player.pixelX, 
        player.pixelY, 
        TILE_SIZE, 
        player.direction
    );
}

function drawGhosts() {
    ghosts.forEach(ghost => {
        // Don't draw ghosts that haven't spawned yet
        if (!ghost.visible) return;
        
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

// ========== COLLISION DETECTION ==========
function checkCollision(x1, y1, x2, y2, threshold = 10) {
    const dx = (x1 + TILE_SIZE/2) - (x2 + TILE_SIZE/2);
    const dy = (y1 + TILE_SIZE/2) - (y2 + TILE_SIZE/2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < threshold;
}

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

function isWalkable(gridX, gridY) {
    if (gridY < 0 || gridY >= ROWS) return false;
    if (gridX < 0) gridX = COLS - 1;
    if (gridX >= COLS) gridX = 0;
    return maze[gridY][gridX] !== 1;
}

function getPlayerSpeed() {
    return 2 + (level - 1) * 0.15;
}

function getGhostSpeed() {
    return 2 + (level - 1) * 0.2;
}

// ========== PLAYER MOVEMENT ==========
function movePlayer() {
    player.speed = getPlayerSpeed();
    
    const centerX = player.gridX * TILE_SIZE;
    const centerY = player.gridY * TILE_SIZE;
    
    const distToCenter = Math.abs(player.pixelX - centerX) + Math.abs(player.pixelY - centerY);
    
    if (distToCenter < player.speed) {
        player.pixelX = centerX;
        player.pixelY = centerY;
        
        let tryX = player.gridX;
        let tryY = player.gridY;
        if (player.nextDirection === 'up') tryY--;
        else if (player.nextDirection === 'down') tryY++;
        else if (player.nextDirection === 'left') tryX--;
        else if (player.nextDirection === 'right') tryX++;
        
        if (isWalkable(tryX, tryY)) {
            player.direction = player.nextDirection;
        }
        
        let currX = player.gridX;
        let currY = player.gridY;
        if (player.direction === 'up') currY--;
        else if (player.direction === 'down') currY++;
        else if (player.direction === 'left') currX--;
        else if (player.direction === 'right') currX++;
        
        if (!isWalkable(currX, currY)) {
            return;
        }
    }
    
    if (player.direction === 'up') player.pixelY -= player.speed;
    else if (player.direction === 'down') player.pixelY += player.speed;
    else if (player.direction === 'left') player.pixelX -= player.speed;
    else if (player.direction === 'right') player.pixelX += player.speed;
    
    player.gridX = Math.round(player.pixelX / TILE_SIZE);
    player.gridY = Math.round(player.pixelY / TILE_SIZE);
    
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
    
    // Check pellets
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
        
        powerMode = true;
        powerModeTimer = Date.now() + POWER_MODE_DURATION;
        ghostEatCombo = 0;
        ghosts.forEach(g => {
            if (!g.eaten) g.vulnerable = true;
        });
        
        updateSirenForPowerMode();
    }
    
    // Level complete triggers celebration (only if not already celebrating)
    if (pelletCount === 0 && !celebrationActive && !countdownActive) {
        startLevelCelebration();
    }
}

// ========== SIMPLIFIED GHOST SPAWNING ==========
// Ghosts spawn ABOVE the pen at row 11 - no pen exit logic needed!
// They use a visibility flag and staggered spawn delays

function moveGhosts() {
    const baseGhostSpeed = getGhostSpeed();
    const now = Date.now();
    
    ghosts.forEach(ghost => {
        // ============================================================
        // CHECK SPAWN TIMING: Make ghost visible when it's time
        // ============================================================
        if (!ghost.visible) {
            if (now >= gameStartTime + ghost.spawnDelay) {
                ghost.visible = true;
                console.log(`👻 ${ghost.name} spawned at (${ghost.gridX}, ${ghost.gridY})`);
            } else {
                return; // Still waiting to spawn - do nothing
            }
        }
        
        // ============================================================
        // EATEN ghost returns to spawn point then respawns
        // ============================================================
        if (ghost.eaten) {
            // Return to spawn row (row 11, col 13)
            const targetX = 13 * TILE_SIZE;
            const targetY = GHOST_SPAWN_ROW * TILE_SIZE;
            const dx = targetX - ghost.pixelX;
            const dy = targetY - ghost.pixelY;
            
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
                // Arrived - respawn immediately
                ghost.pixelX = targetX;
                ghost.pixelY = targetY;
                ghost.gridX = 13;
                ghost.gridY = GHOST_SPAWN_ROW;
                ghost.eaten = false;
                ghost.vulnerable = false;
                ghost.direction = 'left';
            } else {
                // Fast return - move toward spawn point ignoring walls
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
        
        // ============================================================
        // NORMAL AI MOVEMENT
        // ============================================================
        const speed = ghost.vulnerable ? baseGhostSpeed * 0.5 : baseGhostSpeed;
        
        const tileCenterX = ghost.gridX * TILE_SIZE;
        const tileCenterY = ghost.gridY * TILE_SIZE;
        const distToCenterX = Math.abs(ghost.pixelX - tileCenterX);
        const distToCenterY = Math.abs(ghost.pixelY - tileCenterY);
        
        // Decision at tile center
        if (distToCenterX < speed && distToCenterY < speed) {
            ghost.pixelX = tileCenterX;
            ghost.pixelY = tileCenterY;
            
            let targetX, targetY;
            
            if (ghost.vulnerable) {
                targetX = ghost.gridX + (ghost.gridX - player.gridX);
                targetY = ghost.gridY + (ghost.gridY - player.gridY);
            } else {
                switch (ghost.personality) {
                    case 'chase':
                        targetX = player.gridX;
                        targetY = player.gridY;
                        break;
                    case 'ambush':
                        targetX = player.gridX + (player.direction === 'right' ? 4 : player.direction === 'left' ? -4 : 0);
                        targetY = player.gridY + (player.direction === 'down' ? 4 : player.direction === 'up' ? -4 : 0);
                        break;
                    case 'patrol':
                        const blinky = ghosts[0];
                        const vecX = player.gridX - blinky.gridX;
                        const vecY = player.gridY - blinky.gridY;
                        targetX = player.gridX + vecX;
                        targetY = player.gridY + vecY;
                        break;
                    default:
                        const distToPlayer = Math.abs(ghost.gridX - player.gridX) + Math.abs(ghost.gridY - player.gridY);
                        if (distToPlayer > 8) {
                            targetX = player.gridX;
                            targetY = player.gridY;
                        } else {
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
            
            for (const dir of dirs) {
                let testX = ghost.gridX;
                let testY = ghost.gridY;
                
                if (dir === 'up') testY--;
                else if (dir === 'down') testY++;
                else if (dir === 'left') testX--;
                else if (dir === 'right') testX++;
                
                if (isWalkable(testX, testY)) {
                    validDirs.push({ dir, testX, testY });
                    if (dir !== opposite[ghost.direction]) {
                        const dist = Math.abs(testX - targetX) + Math.abs(testY - targetY);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestDir = dir;
                        }
                    }
                }
            }
            
            if (bestDist === Infinity && validDirs.length > 0) {
                bestDir = validDirs[0].dir;
            }
            
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
        
        ghost.gridX = Math.round(ghost.pixelX / TILE_SIZE);
        ghost.gridY = Math.round(ghost.pixelY / TILE_SIZE);
        
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

// Ghost collision detection
function checkGhostCollision() {
    if (invulnerable) {
        if (Date.now() > invulnerableTimer) {
            invulnerable = false;
        }
        return;
    }
    
    ghosts.forEach(ghost => {
        // Skip ghosts that haven't spawned yet or are eaten
        if (ghost.eaten || !ghost.visible) return;
        
        if (checkCollision(player.pixelX, player.pixelY, ghost.pixelX, ghost.pixelY, 14)) {
            if (ghost.vulnerable) {
                ghost.eaten = true;
                ghost.vulnerable = false;
                
                ghostEatCombo++;
                const points = 200 * Math.pow(2, ghostEatCombo - 1);
                score += points;
                
                playFuckYouTao();
                updateStats();
                
                showFloatingPoints(ghost.pixelX, ghost.pixelY, points);
            } else {
                lives--;
                playDeathSound();
                stopSiren();
                updateStats();
                
                if (lives <= 0) {
                    gameOver();
                } else {
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

// Reset positions (after death or level change)
function resetPositions() {
    // Reset player
    player.gridX = 13;
    player.gridY = 23;
    player.pixelX = 13 * TILE_SIZE;
    player.pixelY = 23 * TILE_SIZE;
    player.direction = 'right';
    player.nextDirection = 'right';
    
    // CRITICAL: Reset gameStartTime so spawn timers work correctly
    gameStartTime = Date.now();
    
    // Reset all ghosts to spawn position (row 11, above pen)
    // They spawn at the same position but with staggered visibility
    ghosts.forEach((ghost, i) => {
        ghost.gridX = 13;
        ghost.gridY = GHOST_SPAWN_ROW;
        ghost.pixelX = 13 * TILE_SIZE;
        ghost.pixelY = GHOST_SPAWN_ROW * TILE_SIZE;
        ghost.vulnerable = false;
        ghost.eaten = false;
        ghost.direction = 'left';
        
        // Staggered spawn: SOL=0s, ETH=3s, ADA=6s, XRP=9s
        ghost.spawnDelay = i * 3000;
        ghost.visible = (i === 0); // Only SOL visible immediately
    });
    
    // Reset power mode
    powerMode = false;
    powerModeTimer = 0;
    ghostEatCombo = 0;
    
    // Reset invulnerability
    invulnerable = false;
    invulnerableTimer = 0;
    
    // Clear floating text
    floatingTexts = [];
}

// Level celebration
function startLevelCelebration() {
    gamePaused = true;
    celebrationActive = true;
    celebrationStartTime = Date.now();
    celebrationLevel = level;
    
    stopSiren();
    playVictorySound();
    
    // Pick random wall colors for the next level (Level 1 stays blue, so this is for Level 2+)
    // Exclude the current color to ensure variety
    const otherPalettes = WALL_PALETTES.filter(p => p.main !== currentWallColors.main);
    currentWallColors = otherPalettes[Math.floor(Math.random() * otherPalettes.length)];
    
    console.log(`🎉 Level ${celebrationLevel} COMPLETE! Starting celebration...`);
    console.log(`🎨 Next level wall color: ${currentWallColors.main}`);
}

function drawCelebration() {
    const now = Date.now();
    const elapsed = now - celebrationStartTime;
    const CELEBRATION_DURATION = 3000;
    
    const flashIndex = Math.floor(elapsed / 200) % 4;
    const flashColors = ['#f7931a', '#ff00ff', '#00ffff', '#ffff00'];
    mazeFlashColor = flashColors[flashIndex];
    
    drawMaze();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const scale = Math.min(1, elapsed / 500);
    const bounce = 1 + Math.sin(elapsed / 150) * 0.05;
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 - 30);
    ctx.scale(scale * bounce, scale * bounce);
    
    ctx.fillStyle = '#000';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LEVEL ${celebrationLevel}`, 2, 2);
    ctx.fillText('COMPLETE!', 2, 42);
    
    const hue = (elapsed / 5) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
    ctx.fillText(`LEVEL ${celebrationLevel}`, 0, 0);
    ctx.fillText('COMPLETE!', 0, 40);
    
    ctx.restore();
    
    if (elapsed > 1500) {
        const transAlpha = Math.min(1, (elapsed - 1500) / 500);
        ctx.globalAlpha = transAlpha;
        ctx.fillStyle = '#f7931a';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${celebrationLevel} → Level ${celebrationLevel + 1}`, canvas.width / 2, canvas.height / 2 + 80);
        ctx.globalAlpha = 1;
    }
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 120);
    
    for (let i = 0; i < 8; i++) {
        const angle = (elapsed / 500 + i * Math.PI / 4) % (Math.PI * 2);
        const radius = 80 + Math.sin(elapsed / 200 + i) * 20;
        const sx = canvas.width / 2 + Math.cos(angle) * radius;
        const sy = canvas.height / 2 + Math.sin(angle) * radius;
        const sparkleSize = 3 + Math.sin(elapsed / 100 + i * 2) * 2;
        
        ctx.fillStyle = `hsl(${(hue + i * 45) % 360}, 100%, 70%)`;
        ctx.beginPath();
        ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.textAlign = 'left';
    
    if (elapsed >= CELEBRATION_DURATION) {
        celebrationActive = false;
        mazeFlashColor = null;
        
        level++;
        updateStats();
        resetLevel();
        
        startCountdown();
    }
}

function startCountdown() {
    countdownActive = true;
    countdownStartTime = Date.now();
    countdownText = 'READY!';
    playReadySound();
    console.log(`⏱️ Countdown started for Level ${level}`);
}

function drawCountdown() {
    const now = Date.now();
    const elapsed = now - countdownStartTime;
    const COUNTDOWN_DURATION = 2000;
    
    drawMaze();
    drawPlayer();
    drawGhosts();
    
    let text = 'READY!';
    let textColor = '#ffff00';
    if (elapsed >= 1200) {
        text = 'GO!';
        textColor = '#00ff00';
    }
    
    const pulse = 1 + Math.sin(elapsed / 100) * 0.1;
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(pulse, pulse);
    
    ctx.fillStyle = '#000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 2, 2);
    
    ctx.fillStyle = textColor;
    ctx.fillText(text, 0, 0);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Level ${level}`, 0, 40);
    
    ctx.restore();
    ctx.textAlign = 'left';
    
    if (elapsed >= COUNTDOWN_DURATION) {
        countdownActive = false;
        
        // CRITICAL: Ensure ALL game state is properly reset for the new level
        gamePaused = false;
        gameRunning = true;
        celebrationActive = false;
        
        // Force player to exact grid position with clean direction
        player.gridX = 13;
        player.gridY = 23;
        player.pixelX = 13 * TILE_SIZE;
        player.pixelY = 23 * TILE_SIZE;
        player.direction = 'right';
        player.nextDirection = 'right';
        
        // Reset power mode state
        powerMode = false;
        powerModeTimer = 0;
        ghostEatCombo = 0;
        invulnerable = false;
        invulnerableTimer = 0;
        
        // Reset gameStartTime for ghost spawn timers
        gameStartTime = Date.now();
        
        // Re-set ghost visibility based on new gameStartTime
        ghosts.forEach((ghost, i) => {
            ghost.spawnDelay = i * 3000;
            ghost.visible = (i === 0);
        });
        
        startSiren();
        
        console.log(`🎮 Level ${level} - GAME ON! gamePaused=${gamePaused} gameRunning=${gameRunning}`);
        console.log(`🎮 Player at (${player.gridX},${player.gridY}) dir=${player.direction} pellets=${pelletCount}`);
        console.log(`🎨 Wall color: ${currentWallColors.main}`);
    }
}

function resetLevel() {
    // Restore all maze pellets from original
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            maze[row][col] = ORIGINAL_MAZE[row][col];
        }
    }
    
    pelletCount = countPellets();
    resetPositions();
    mazeFlashColor = null;
    
    updateStats();
    
    console.log(`🔄 Level ${level} reset complete. Pellets: ${pelletCount}`);
}

function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
}

function gameOver() {
    gameRunning = false;
    gamePaused = false;
    stopSiren();
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
}

// ========== INPUT HANDLING ==========

canvas.addEventListener('click', () => {
    canvas.focus();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (!sirenPlaying && gameRunning && !gamePaused) {
        startSiren();
    }
});

function handleKeydown(e) {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (!sirenPlaying && gameRunning && !gamePaused) {
        startSiren();
    }
    
    if (!gameRunning || gamePaused) return;
    
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

// Touch/swipe controls with CSS scaling support
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (!sirenPlaying && gameRunning && !gamePaused) {
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
    if (!gameRunning || gamePaused) return;
    
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const swipeTime = Date.now() - touchStartTime;
    
    const minDist = 20;
    const maxTime = 500;
    
    if (swipeTime > maxTime) return;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > minDist) {
            player.nextDirection = dx > 0 ? 'right' : 'left';
        }
    } else {
        if (Math.abs(dy) > minDist) {
            player.nextDirection = dy > 0 ? 'down' : 'up';
        }
    }
}, { passive: false });

document.addEventListener('touchstart', (e) => {
    if (e.target === canvas) return;
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { passive: true });

// ========== MAIN GAME LOOP ==========
function gameLoop() {
    if (!gameRunning) return;
    
    // Handle celebration overlay (game is paused)
    if (celebrationActive) {
        drawCelebration();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Handle countdown overlay (game is paused)
    if (countdownActive) {
        drawCountdown();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Safety check: if not in celebration or countdown, game should NOT be paused
    if (!celebrationActive && !countdownActive && gamePaused) {
        console.warn('⚠️ Game was paused with no celebration/countdown active! Force-unpausing.');
        gamePaused = false;
    }
    
    // Normal gameplay (not paused)
    if (!gamePaused) {
        movePlayer();
        moveGhosts();
        checkGhostCollision();
        
        // Check power mode timer
        if (powerMode && Date.now() >= powerModeTimer) {
            powerMode = false;
            ghostEatCombo = 0;
            ghosts.forEach(g => g.vulnerable = false);
            updateSirenForPowerMode();
        }
    }
    
    // Draw everything
    drawMaze();
    drawPlayer();
    drawGhosts();
    drawFloatingPoints();
    
    requestAnimationFrame(gameLoop);
}

// Initialize
gameStartTime = Date.now();

console.log('Bitcoin Grepples-Man v4.0 loaded!');
console.log('Features: Simplified ghost spawning (no pen logic), random wall colors per level');
console.log('Ghost spawn schedule: SOL=0s, ETH=3s, ADA=6s, XRP=9s');
console.log('Use arrow keys, WASD, or swipe to move');
console.log('Eat Bitcoin pellets, avoid shitcoin ghosts!');
gameLoop();
