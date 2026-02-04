// Bitcoin Pac-Man v2.0 - Enhanced Edition
// Featuring: Real coin logos, improved sound, better collision, power mode music
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

// Player - enhanced with smooth animation
const player = {
    gridX: 13,
    gridY: 23,
    pixelX: 13 * TILE_SIZE,
    pixelY: 23 * TILE_SIZE,
    direction: 'right',
    nextDirection: 'right',
    speed: 4,  // Increased from 2
    mouthOpen: true,
    animFrame: 0
};

// Draw Pac-Man using original image with rotation
function drawPacmanImage(x, y, size, direction) {
    if (!pacmanLoaded) return;
    
    ctx.save();
    ctx.translate(x + size/2, y + size/2);
    
    // Rotate based on direction
    const rotations = { right: 0, down: Math.PI/2, left: Math.PI, up: -Math.PI/2 };
    ctx.rotate(rotations[direction] || 0);
    
    // Draw the original image centered and scaled
    ctx.drawImage(pacmanImg, -size/2, -size/2, size, size);
    
    ctx.restore();
}

// Shitcoin ghosts with real logo rendering
const ghosts = [
    { name: 'SOL', color: '#14F195', gradient: ['#14F195', '#9945FF'], gridX: 12, gridY: 11, pixelX: 12*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'chase', vulnerable: false, eaten: false, baseX: 12, baseY: 11 },
    { name: 'ETH', color: '#627EEA', gradient: ['#627EEA', '#8A9EFF'], gridX: 13, gridY: 11, pixelX: 13*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'ambush', vulnerable: false, eaten: false, baseX: 13, baseY: 11 },
    { name: 'ADA', color: '#0033AD', gradient: ['#0033AD', '#0052FF'], gridX: 14, gridY: 11, pixelX: 14*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'patrol', vulnerable: false, eaten: false, baseX: 14, baseY: 11 },
    { name: 'XRP', color: '#23292F', gradient: ['#23292F', '#555'], gridX: 15, gridY: 11, pixelX: 15*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'random', vulnerable: false, eaten: false, baseX: 15, baseY: 11 }
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
    sirenOscillator?.stop();
    sirenLFO?.stop();
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
        ctx.stroke();
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
        if (ghost.eaten) return;
        
        const x = ghost.pixelX;
        const y = ghost.pixelY;
        
        if (ghost.vulnerable) {
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

// Move player
function movePlayer() {
    let tryGridX = player.gridX;
    let tryGridY = player.gridY;
    
    if (player.nextDirection === 'up') tryGridY--;
    else if (player.nextDirection === 'down') tryGridY++;
    else if (player.nextDirection === 'left') tryGridX--;
    else if (player.nextDirection === 'right') tryGridX++;
    
    const centerX = player.gridX * TILE_SIZE;
    const centerY = player.gridY * TILE_SIZE;
    const isCentered = Math.abs(player.pixelX - centerX) < player.speed && Math.abs(player.pixelY - centerY) < player.speed;
    
    // Try to change direction when centered on a tile
    if (isCentered && isWalkable(tryGridX, tryGridY)) {
        player.direction = player.nextDirection;
        // Snap to grid center to prevent drift
        player.pixelX = centerX;
        player.pixelY = centerY;
    }
    
    // Calculate new position
    let newPixelX = player.pixelX;
    let newPixelY = player.pixelY;
    
    if (player.direction === 'up') newPixelY -= player.speed;
    else if (player.direction === 'down') newPixelY += player.speed;
    else if (player.direction === 'left') newPixelX -= player.speed;
    else if (player.direction === 'right') newPixelX += player.speed;
    
    // Check collision at the leading edge of movement
    let canMove = true;
    const margin = 2; // Small margin to prevent wall sticking
    
    if (player.direction === 'up') {
        const checkY = Math.floor((newPixelY + margin) / TILE_SIZE);
        const checkX = Math.floor((player.pixelX + TILE_SIZE/2) / TILE_SIZE);
        canMove = isWalkable(checkX, checkY);
    } else if (player.direction === 'down') {
        const checkY = Math.floor((newPixelY + TILE_SIZE - margin) / TILE_SIZE);
        const checkX = Math.floor((player.pixelX + TILE_SIZE/2) / TILE_SIZE);
        canMove = isWalkable(checkX, checkY);
    } else if (player.direction === 'left') {
        const checkX = Math.floor((newPixelX + margin) / TILE_SIZE);
        const checkY = Math.floor((player.pixelY + TILE_SIZE/2) / TILE_SIZE);
        canMove = isWalkable(checkX, checkY);
    } else if (player.direction === 'right') {
        const checkX = Math.floor((newPixelX + TILE_SIZE - margin) / TILE_SIZE);
        const checkY = Math.floor((player.pixelY + TILE_SIZE/2) / TILE_SIZE);
        canMove = isWalkable(checkX, checkY);
    }
    
    if (canMove) {
        player.pixelX = newPixelX;
        player.pixelY = newPixelY;
        player.gridX = Math.floor((player.pixelX + TILE_SIZE/2) / TILE_SIZE);
        player.gridY = Math.floor((player.pixelY + TILE_SIZE/2) / TILE_SIZE);
        
        // Wrap around tunnel
        if (player.pixelX < -TILE_SIZE) {
            player.pixelX = COLS * TILE_SIZE;
            player.gridX = COLS - 1;
        }
        if (player.pixelX > COLS * TILE_SIZE) {
            player.pixelX = -TILE_SIZE;
            player.gridX = 0;
        }
        
        // Check pellets with better alignment
        if (Math.abs(player.pixelX - player.gridX * TILE_SIZE) < 3 && 
            Math.abs(player.pixelY - player.gridY * TILE_SIZE) < 3) {
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
                updateStats();
            }
        }
        
        if (pelletCount === 0) {
            level++;
            resetLevel();
        }
    }
}

// Ghost AI
function moveGhosts() {
    const ghostSpeed = 1.8 + (level * 0.1);
    
    ghosts.forEach(ghost => {
        if (ghost.eaten) {
            // Return to base
            const dx = ghost.baseX * TILE_SIZE - ghost.pixelX;
            const dy = ghost.baseY * TILE_SIZE - ghost.pixelY;
            
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                ghost.pixelX = ghost.baseX * TILE_SIZE;
                ghost.pixelY = ghost.baseY * TILE_SIZE;
                ghost.gridX = ghost.baseX;
                ghost.gridY = ghost.baseY;
                ghost.eaten = false;
            } else {
                ghost.pixelX += Math.sign(dx) * 3;
                ghost.pixelY += Math.sign(dy) * 3;
            }
            return;
        }
        
        const speed = ghost.vulnerable ? ghostSpeed * 0.6 : ghostSpeed;
        
        // Decision at tile center
        if (Math.abs(ghost.pixelX - ghost.gridX * TILE_SIZE) < 2 && 
            Math.abs(ghost.pixelY - ghost.gridY * TILE_SIZE) < 2) {
            
            ghost.pixelX = ghost.gridX * TILE_SIZE;
            ghost.pixelY = ghost.gridY * TILE_SIZE;
            
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
                        targetX = ghost.gridX < 14 ? 26 : 1;
                        targetY = ghost.gridY < 15 ? 29 : 1;
                        break;
                    default:
                        targetX = Math.floor(Math.random() * COLS);
                        targetY = Math.floor(Math.random() * ROWS);
                }
            }
            
            const dirs = ['up', 'down', 'left', 'right'];
            const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
            let bestDir = ghost.direction;
            let bestDist = Infinity;
            
            for (const dir of dirs) {
                if (dir === opposite[ghost.direction]) continue; // No 180s
                
                let testX = ghost.gridX;
                let testY = ghost.gridY;
                
                if (dir === 'up') testY--;
                else if (dir === 'down') testY++;
                else if (dir === 'left') testX--;
                else if (dir === 'right') testX++;
                
                if (isWalkable(testX, testY)) {
                    const dist = Math.abs(testX - targetX) + Math.abs(testY - targetY);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestDir = dir;
                    }
                }
            }
            
            ghost.direction = bestDir;
        }
        
        // Move
        if (ghost.direction === 'up') ghost.pixelY -= speed;
        else if (ghost.direction === 'down') ghost.pixelY += speed;
        else if (ghost.direction === 'left') ghost.pixelX -= speed;
        else if (ghost.direction === 'right') ghost.pixelX += speed;
        
        ghost.gridX = Math.round(ghost.pixelX / TILE_SIZE);
        ghost.gridY = Math.round(ghost.pixelY / TILE_SIZE);
        
        // Wrap
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
function checkGhostCollision() {
    ghosts.forEach(ghost => {
        if (ghost.eaten) return;
        
        if (checkCollision(player.pixelX, player.pixelY, ghost.pixelX, ghost.pixelY, 12)) {
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
    
    ghosts.forEach(ghost => {
        ghost.gridX = ghost.baseX;
        ghost.gridY = ghost.baseY;
        ghost.pixelX = ghost.baseX * TILE_SIZE;
        ghost.pixelY = ghost.baseY * TILE_SIZE;
        ghost.vulnerable = false;
        ghost.eaten = false;
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

// Game loop
function gameLoop() {
    if (!gameRunning) return;
    
    // Check power mode timer
    if (powerMode && Date.now() >= powerModeTimer) {
        powerMode = false;
        ghostEatCombo = 0;
        ghosts.forEach(g => g.vulnerable = false);
        updateSirenForPowerMode();
    }
    
    drawMaze();
    drawPlayer();
    drawGhosts();
    drawFloatingPoints();
    movePlayer();
    moveGhosts();
    checkGhostCollision();
    
    requestAnimationFrame(gameLoop);
}

// Start game
console.log('Bitcoin Pac-Man v2.0 loaded!');
console.log('Use arrow keys or WASD to move');
console.log('Eat Bitcoin pellets, avoid shitcoin ghosts!');
gameLoop();
