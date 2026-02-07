// Bitcoin Pac-Man v3.0 - Major Fix Edition
// Fixes: bulletproof ghost pen exit, level complete celebration, proper level reset
// Added: inPen flag system, celebration sequence, READY! countdown
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
let gamePaused = false; // NEW: pause flag for celebrations/countdown
let pelletCount = 0;
let powerMode = false;
let powerModeTimer = 0;
const POWER_MODE_DURATION = 10000;
let ghostEatCombo = 0;
let invulnerable = false;
let invulnerableTimer = 0;
const INVULNERABLE_DURATION = 2000;
let gameStartTime = 0;

// NEW: Celebration / countdown state
let celebrationActive = false;
let celebrationStartTime = 0;
let celebrationLevel = 0; // The level that was just completed
let countdownActive = false;
let countdownStartTime = 0;
let countdownText = '';
let mazeFlashColor = null; // For wall flash effect

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

// Ghost starting positions inside the ghost pen
// Ghost pen area: rows 12-16, cols 10-17
// Exit column: 13-14, exit row: 11 (just above pen gate)
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

// NEW: Enhanced victory sound - big ascending fanfare
function playVictorySound() {
    const notes = [
        { freq: 523, delay: 0,    dur: 0.15, type: 'square' },   // C5
        { freq: 587, delay: 0.12, dur: 0.15, type: 'square' },   // D5
        { freq: 659, delay: 0.24, dur: 0.15, type: 'square' },   // E5
        { freq: 784, delay: 0.36, dur: 0.15, type: 'square' },   // G5
        { freq: 880, delay: 0.48, dur: 0.2,  type: 'square' },   // A5
        { freq: 1047, delay: 0.6, dur: 0.4,  type: 'square' },   // C6 (hold)
        // Harmony layer
        { freq: 392, delay: 0,    dur: 0.15, type: 'triangle' }, // G4
        { freq: 440, delay: 0.12, dur: 0.15, type: 'triangle' }, // A4
        { freq: 494, delay: 0.24, dur: 0.15, type: 'triangle' }, // B4
        { freq: 587, delay: 0.36, dur: 0.15, type: 'triangle' }, // D5
        { freq: 659, delay: 0.48, dur: 0.2,  type: 'triangle' }, // E5
        { freq: 784, delay: 0.6,  dur: 0.4,  type: 'triangle' }, // G5 (hold)
        // Final sparkle
        { freq: 1319, delay: 0.85, dur: 0.3, type: 'sine' },    // E6
        { freq: 1568, delay: 0.95, dur: 0.3, type: 'sine' },    // G6
        { freq: 2093, delay: 1.05, dur: 0.5, type: 'sine' },    // C7
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

// OLD: simpler level up sound (kept for reference, replaced by playVictorySound)
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

// NEW: "READY!" beep
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

// Draw maze with optional wall flash color override
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
                    // Celebration wall flash
                    ctx.fillStyle = mazeFlashColor;
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                } else {
                    const wallGrad = ctx.createLinearGradient(x, y, x + TILE_SIZE, y + TILE_SIZE);
                    wallGrad.addColorStop(0, '#2121ff');
                    wallGrad.addColorStop(1, '#0000aa');
                    ctx.fillStyle = wallGrad;
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    
                    ctx.strokeStyle = '#4444ff';
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
    
    // ===== ISSUE 2 FIX: Level complete triggers celebration =====
    if (pelletCount === 0) {
        startLevelCelebration();
    }
}

// ===== ISSUE 1 FIX: BULLETPROOF Ghost Pen Exit =====
// Ghost pen area: rows 12-16, cols 10-17
// Exit target: column 13, row 11 (above gate)
// This is checked BEFORE any AI targeting

function isInPenArea(gridX, gridY) {
    return gridY >= 12 && gridY <= 16 && gridX >= 10 && gridX <= 17;
}

function moveGhostOutOfPen(ghost) {
    const EXIT_COL = 13;
    const EXIT_ROW = 11; // Just above the pen gate at row 12
    const penSpeed = 1.5;
    
    const targetExitPixelX = EXIT_COL * TILE_SIZE;
    const targetExitPixelY = EXIT_ROW * TILE_SIZE;
    
    const currentGridY = Math.round(ghost.pixelY / TILE_SIZE);
    
    // PHASE 1: Move horizontally toward exit column (col 13)
    const dx = targetExitPixelX - ghost.pixelX;
    if (Math.abs(dx) > penSpeed) {
        ghost.pixelX += Math.sign(dx) * penSpeed;
        ghost.direction = dx > 0 ? 'right' : 'left';
        ghost.gridX = Math.round(ghost.pixelX / TILE_SIZE);
        ghost.gridY = Math.round(ghost.pixelY / TILE_SIZE);
        return; // Still moving horizontally
    }
    
    // Snap X to exit column
    ghost.pixelX = targetExitPixelX;
    ghost.gridX = EXIT_COL;
    
    // PHASE 2: Move UP toward exit row (row 11)
    const dy = targetExitPixelY - ghost.pixelY;
    if (Math.abs(dy) > penSpeed) {
        ghost.pixelY += Math.sign(dy) * penSpeed;
        ghost.direction = 'up';
        ghost.gridY = Math.round(ghost.pixelY / TILE_SIZE);
        return; // Still moving up
    }
    
    // PHASE 3: Reached exit! Snap and release
    ghost.pixelX = targetExitPixelX;
    ghost.pixelY = targetExitPixelY;
    ghost.gridX = EXIT_COL;
    ghost.gridY = EXIT_ROW;
    ghost.inPen = false;
    ghost.direction = 'left'; // Start heading left
    
    console.log(`👻 ${ghost.name} exited the pen at (${ghost.gridX}, ${ghost.gridY})`);
}

// Ghost AI movement
function moveGhosts() {
    const baseGhostSpeed = getGhostSpeed();
    const now = Date.now();
    const elapsed = now - gameStartTime;
    
    ghosts.forEach(ghost => {
        // ===== ISSUE 1 FIX: PEN EXIT IS ABSOLUTE FIRST PRIORITY =====
        // Check inPen flag OR detect if ghost is physically in the pen area
        if (ghost.inPen || (isInPenArea(ghost.gridX, ghost.gridY) && !ghost.eaten && ghost.gridY > 11)) {
            // Force inPen true if they're physically in pen (safety net)
            ghost.inPen = true;
            
            // Wait for scatter delay before exiting
            if (elapsed < ghost.scatterDelay) {
                // Bob up and down in pen while waiting
                ghost.pixelY = ghost.baseY * TILE_SIZE + Math.sin(now / 300) * 3;
                ghost.gridY = ghost.baseY;
                return;
            }
            
            // Time to exit - this is the ONLY movement that runs while inPen
            moveGhostOutOfPen(ghost);
            return; // No other AI runs until pen exit is complete
        }
        
        // ===== EATEN ghost returns to pen =====
        if (ghost.eaten) {
            const dx = ghost.baseX * TILE_SIZE - ghost.pixelX;
            const dy = ghost.baseY * TILE_SIZE - ghost.pixelY;
            
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
                // Arrived at base - become alive in pen
                ghost.pixelX = ghost.baseX * TILE_SIZE;
                ghost.pixelY = ghost.baseY * TILE_SIZE;
                ghost.gridX = ghost.baseX;
                ghost.gridY = ghost.baseY;
                ghost.eaten = false;
                ghost.vulnerable = false;
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
        
        // ===== NORMAL AI MOVEMENT (only runs when NOT in pen) =====
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
        if (ghost.eaten || ghost.inPen) return;
        
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

// ===== ISSUE 3 FIX: Complete position reset =====
function resetPositions() {
    // Reset ALL player state
    player.gridX = 13;
    player.gridY = 23;
    player.pixelX = 13 * TILE_SIZE;
    player.pixelY = 23 * TILE_SIZE;
    player.direction = 'right';
    player.nextDirection = 'right';
    
    gameStartTime = Date.now();
    
    // Reset ALL ghost state - back to pen with proper initial positions
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
    
    // Reset ALL ghost flags
    ghosts.forEach(ghost => {
        ghost.vulnerable = false;
        ghost.eaten = false;
        ghost.direction = 'up';
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

// ===== ISSUE 2 & 3 FIX: Level celebration + proper reset =====

function startLevelCelebration() {
    // Stop normal gameplay
    gamePaused = true;
    celebrationActive = true;
    celebrationStartTime = Date.now();
    celebrationLevel = level; // Remember which level was completed
    
    // Stop siren during celebration
    stopSiren();
    
    // Play victory fanfare
    playVictorySound();
    
    console.log(`🎉 Level ${celebrationLevel} COMPLETE! Starting celebration...`);
}

// Draw the celebration overlay
function drawCelebration() {
    const now = Date.now();
    const elapsed = now - celebrationStartTime;
    const CELEBRATION_DURATION = 3000; // 3 seconds
    
    // Flash maze walls (alternate colors every 200ms)
    const flashIndex = Math.floor(elapsed / 200) % 4;
    const flashColors = ['#f7931a', '#ff00ff', '#00ffff', '#ffff00'];
    mazeFlashColor = flashColors[flashIndex];
    
    // Draw the maze with flashing walls
    drawMaze();
    
    // Draw a semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // "LEVEL X COMPLETE!" text with scale animation
    const scale = Math.min(1, elapsed / 500); // Scale up over 0.5s
    const bounce = 1 + Math.sin(elapsed / 150) * 0.05; // Subtle bounce
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 - 30);
    ctx.scale(scale * bounce, scale * bounce);
    
    // Shadow
    ctx.fillStyle = '#000';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LEVEL ${celebrationLevel}`, 2, 2);
    ctx.fillText('COMPLETE!', 2, 42);
    
    // Main text (cycling colors)
    const hue = (elapsed / 5) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
    ctx.fillText(`LEVEL ${celebrationLevel}`, 0, 0);
    ctx.fillText('COMPLETE!', 0, 40);
    
    ctx.restore();
    
    // Show level transition: old → new
    if (elapsed > 1500) {
        const transAlpha = Math.min(1, (elapsed - 1500) / 500);
        ctx.globalAlpha = transAlpha;
        ctx.fillStyle = '#f7931a';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${celebrationLevel} → Level ${celebrationLevel + 1}`, canvas.width / 2, canvas.height / 2 + 80);
        ctx.globalAlpha = 1;
    }
    
    // Score display during celebration
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 120);
    
    // Sparkle particles
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
    
    // End celebration after duration
    if (elapsed >= CELEBRATION_DURATION) {
        celebrationActive = false;
        mazeFlashColor = null;
        
        // NOW increment level and reset
        level++;
        updateStats();
        resetLevel();
        
        // Start countdown before gameplay resumes
        startCountdown();
    }
}

// ===== ISSUE 3 FIX: Countdown before gameplay resumes =====
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
    const COUNTDOWN_DURATION = 2000; // 2 seconds: "READY!" for 1s, "GO!" for 0.5s, then play
    
    // Draw the maze and entities (frozen)
    drawMaze();
    drawPlayer();
    drawGhosts();
    
    // Determine text
    let text = 'READY!';
    let textColor = '#ffff00';
    if (elapsed >= 1200) {
        text = 'GO!';
        textColor = '#00ff00';
    }
    
    // Draw countdown text
    const pulse = 1 + Math.sin(elapsed / 100) * 0.1;
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(pulse, pulse);
    
    // Shadow
    ctx.fillStyle = '#000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 2, 2);
    
    // Main text
    ctx.fillStyle = textColor;
    ctx.fillText(text, 0, 0);
    
    // Level indicator below
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Level ${level}`, 0, 40);
    
    ctx.restore();
    ctx.textAlign = 'left';
    
    // End countdown
    if (elapsed >= COUNTDOWN_DURATION) {
        countdownActive = false;
        gamePaused = false;
        
        // Restart the siren
        startSiren();
        
        console.log(`🎮 Level ${level} - GAME ON!`);
    }
}

// ===== ISSUE 3 FIX: Complete level reset =====
function resetLevel() {
    // Restore ALL maze pellets from the original
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            maze[row][col] = ORIGINAL_MAZE[row][col];
        }
    }
    
    // Recount pellets
    pelletCount = countPellets();
    
    // Reset ALL positions and state
    resetPositions();
    
    // Clear flash color
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

// Touch/swipe controls
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

console.log('Bitcoin Pac-Man v3.0 loaded!');
console.log('Fixes: bulletproof ghost pen exit, level celebration, proper reset');
console.log('Use arrow keys, WASD, or swipe to move');
console.log('Eat Bitcoin pellets, avoid shitcoin ghosts!');
gameLoop();
