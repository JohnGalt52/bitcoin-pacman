// Bitcoin Pac-Man Game - Classic Mechanics
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
const POWER_MODE_DURATION = 10000; // 10 seconds like original Pac-Man

// Player - grid-based position
const player = {
    gridX: 13,
    gridY: 23,
    pixelX: 13 * TILE_SIZE,
    pixelY: 23 * TILE_SIZE,
    direction: 'right',
    nextDirection: 'right',
    speed: 2, // pixels per frame
    imageLoaded: false
};

// Load player image with transparency
const playerImg = new Image();
playerImg.src = 'pacman.jpg';
playerImg.onload = () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = playerImg.width;
    tempCanvas.height = playerImg.height;
    
    tempCtx.drawImage(playerImg, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    // Remove white background
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > 220 && g > 220 && b > 220) {
            data[i + 3] = 0;
        }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    const cleanImg = new Image();
    cleanImg.src = tempCanvas.toDataURL();
    cleanImg.onload = () => {
        player.imageLoaded = true;
        playerImg.src = cleanImg.src;
    };
};

// Shitcoin ghosts with unique AI personalities
const ghosts = [
    { name: 'SOL', color: '#14F195', gridX: 12, gridY: 11, pixelX: 12*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'chase', vulnerable: false, eaten: false, baseX: 12, baseY: 11 },
    { name: 'ETH', color: '#627EEA', gridX: 13, gridY: 11, pixelX: 13*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'ambush', vulnerable: false, eaten: false, baseX: 13, baseY: 11 },
    { name: 'ADA', color: '#0033AD', gridX: 14, gridY: 11, pixelX: 14*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'patrol', vulnerable: false, eaten: false, baseX: 14, baseY: 11 },
    { name: 'XRP', color: '#23292F', gridX: 15, gridY: 11, pixelX: 15*TILE_SIZE, pixelY: 11*TILE_SIZE, direction: 'up', personality: 'random', vulnerable: false, eaten: false, baseX: 15, baseY: 11 }
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

// Count initial pellets
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

// Sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playNomSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 200;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playDeathSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Draw maze
function drawMaze() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = maze[row][col];
            const x = col * TILE_SIZE;
            const y = row * TILE_SIZE;
            
            if (cell === 1) {
                ctx.fillStyle = '#2121ff';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#1a1aaa';
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            } else if (cell === 2) {
                ctx.fillStyle = '#f7931a';
                ctx.font = 'bold 10px Arial';
                ctx.fillText('₿', x + 5, y + 14);
            } else if (cell === 3) {
                ctx.fillStyle = '#f7931a';
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Draw player - centered and smooth
function drawPlayer() {
    if (player.imageLoaded) {
        ctx.save();
        ctx.translate(player.pixelX + TILE_SIZE/2, player.pixelY + TILE_SIZE/2);
        
        if (player.direction === 'right') ctx.rotate(0);
        else if (player.direction === 'down') ctx.rotate(Math.PI / 2);
        else if (player.direction === 'left') ctx.rotate(Math.PI);
        else if (player.direction === 'up') ctx.rotate(-Math.PI / 2);
        
        ctx.drawImage(playerImg, -TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);
        ctx.restore();
    } else {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(player.pixelX + TILE_SIZE/2, player.pixelY + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw ghosts
function drawGhosts() {
    ghosts.forEach(ghost => {
        if (ghost.eaten) return;
        
        const x = ghost.pixelX;
        const y = ghost.pixelY;
        
        // Check if power mode is ending (last 2 seconds)
        const flashMode = powerMode && (powerModeTimer - Date.now() < 2000);
        const isFlashing = flashMode && Math.floor(Date.now() / 200) % 2 === 0;
        
        ctx.fillStyle = ghost.vulnerable ? (isFlashing ? '#fff' : '#3333ff') : ghost.color;
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/2 - 2, Math.PI, 0);
        ctx.lineTo(x + TILE_SIZE - 2, y + TILE_SIZE);
        ctx.lineTo(x + TILE_SIZE - 5, y + TILE_SIZE - 3);
        ctx.lineTo(x + TILE_SIZE - 8, y + TILE_SIZE);
        ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
        ctx.lineTo(x + 8, y + TILE_SIZE);
        ctx.lineTo(x + 5, y + TILE_SIZE - 3);
        ctx.lineTo(x + 2, y + TILE_SIZE);
        ctx.closePath();
        ctx.fill();
        
        // Eyes
        if (ghost.vulnerable) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x + 7, y + 9, 2, 0, Math.PI * 2);
            ctx.arc(x + 13, y + 9, 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x + 5, y + 6, 4, 5);
            ctx.fillRect(x + 11, y + 6, 4, 5);
            
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 6, y + 7, 2, 3);
            ctx.fillRect(x + 12, y + 7, 2, 3);
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(ghost.name, x + TILE_SIZE/2, y + TILE_SIZE + 8);
        ctx.textAlign = 'left';
    });
}

// Check if tile is walkable
function isWalkable(gridX, gridY) {
    if (gridY < 0 || gridY >= ROWS || gridX < 0 || gridX >= COLS) return false;
    return maze[gridY][gridX] !== 1;
}

// Move player with grid-snapping
function movePlayer() {
    // Try to turn if nextDirection is different
    let tryGridX = player.gridX;
    let tryGridY = player.gridY;
    
    if (player.nextDirection === 'up') tryGridY--;
    else if (player.nextDirection === 'down') tryGridY++;
    else if (player.nextDirection === 'left') tryGridX--;
    else if (player.nextDirection === 'right') tryGridX++;
    
    // If centered on tile and can turn, do it
    const centerX = player.gridX * TILE_SIZE;
    const centerY = player.gridY * TILE_SIZE;
    const isCentered = player.pixelX === centerX && player.pixelY === centerY;
    
    if (isCentered && isWalkable(tryGridX, tryGridY)) {
        player.direction = player.nextDirection;
    }
    
    // Move in current direction
    let newPixelX = player.pixelX;
    let newPixelY = player.pixelY;
    
    if (player.direction === 'up') newPixelY -= player.speed;
    else if (player.direction === 'down') newPixelY += player.speed;
    else if (player.direction === 'left') newPixelX -= player.speed;
    else if (player.direction === 'right') newPixelX += player.speed;
    
    // Check if next grid position is walkable
    const nextGridX = Math.round(newPixelX / TILE_SIZE);
    const nextGridY = Math.round(newPixelY / TILE_SIZE);
    
    if (isWalkable(nextGridX, nextGridY)) {
        player.pixelX = newPixelX;
        player.pixelY = newPixelY;
        player.gridX = Math.round(player.pixelX / TILE_SIZE);
        player.gridY = Math.round(player.pixelY / TILE_SIZE);
        
        // Wrap around
        if (player.pixelX < -TILE_SIZE/2) {
            player.pixelX = (COLS - 0.5) * TILE_SIZE;
            player.gridX = COLS - 1;
        }
        if (player.pixelX > (COLS - 0.5) * TILE_SIZE) {
            player.pixelX = -TILE_SIZE/2;
            player.gridX = 0;
        }
        
        // Check for pellets when centered on tile
        if (player.pixelX === player.gridX * TILE_SIZE && player.pixelY === player.gridY * TILE_SIZE) {
            const cell = maze[player.gridY][player.gridX];
            
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
                playNomSound();
                
                // Power mode!
                powerMode = true;
                powerModeTimer = Date.now() + POWER_MODE_DURATION;
                ghosts.forEach(g => {
                    if (!g.eaten) g.vulnerable = true;
                });
                
                updateStats();
            }
        }
        
        if (pelletCount === 0) {
            level++;
            resetLevel();
        }
    }
}

// Ghost AI with classic Pac-Man behaviors
function moveGhosts() {
    const ghostSpeed = 2;
    
    ghosts.forEach(ghost => {
        if (ghost.eaten) {
            ghost.pixelX = ghost.baseX * TILE_SIZE;
            ghost.pixelY = ghost.baseY * TILE_SIZE;
            ghost.gridX = ghost.baseX;
            ghost.gridY = ghost.baseY;
            ghost.eaten = false;
            return;
        }
        
        const speed = ghost.vulnerable ? 1.5 : ghostSpeed;
        
        // When centered on tile, choose direction
        if (ghost.pixelX === ghost.gridX * TILE_SIZE && ghost.pixelY === ghost.gridY * TILE_SIZE) {
            let targetX, targetY;
            
            if (ghost.vulnerable) {
                // Flee from player
                targetX = ghost.gridX - (player.gridX - ghost.gridX);
                targetY = ghost.gridY - (player.gridY - ghost.gridY);
            } else {
                // Different AI per personality
                if (ghost.personality === 'chase') {
                    targetX = player.gridX;
                    targetY = player.gridY;
                } else if (ghost.personality === 'ambush') {
                    targetX = player.gridX + (player.direction === 'right' ? 4 : player.direction === 'left' ? -4 : 0);
                    targetY = player.gridY + (player.direction === 'down' ? 4 : player.direction === 'up' ? -4 : 0);
                } else if (ghost.personality === 'patrol') {
                    targetX = ghost.gridX < 14 ? 0 : COLS;
                    targetY = ghost.gridY < 15 ? 0 : ROWS;
                } else {
                    targetX = Math.floor(Math.random() * COLS);
                    targetY = Math.floor(Math.random() * ROWS);
                }
            }
            
            // Find best direction
            const dirs = ['up', 'down', 'left', 'right'];
            let bestDir = ghost.direction;
            let bestDist = 9999;
            
            for (const dir of dirs) {
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
        if (ghost.pixelX < -TILE_SIZE/2) {
            ghost.pixelX = (COLS - 0.5) * TILE_SIZE;
            ghost.gridX = COLS - 1;
        }
        if (ghost.pixelX > (COLS - 0.5) * TILE_SIZE) {
            ghost.pixelX = -TILE_SIZE/2;
            ghost.gridX = 0;
        }
    });
}

// Check collisions
function checkGhostCollision() {
    ghosts.forEach(ghost => {
        if (ghost.eaten) return;
        
        const dist = Math.sqrt(
            Math.pow(player.gridX - ghost.gridX, 2) + 
            Math.pow(player.gridY - ghost.gridY, 2)
        );
        
        if (dist < 0.8) {
            if (ghost.vulnerable) {
                ghost.eaten = true;
                ghost.vulnerable = false;
                score += 200;
                playNomSound();
                updateStats();
            } else {
                lives--;
                playDeathSound();
                updateStats();
                
                if (lives <= 0) {
                    gameOver();
                } else {
                    resetPositions();
                }
            }
        }
    });
}

// Reset positions
function resetPositions() {
    player.gridX = 13;
    player.gridY = 23;
    player.pixelX = 13 * TILE_SIZE;
    player.pixelY = 23 * TILE_SIZE;
    player.direction = 'right';
    player.nextDirection = 'right';
    
    ghosts.forEach((ghost, i) => {
        ghost.gridX = ghost.baseX;
        ghost.gridY = ghost.baseY;
        ghost.pixelX = ghost.baseX * TILE_SIZE;
        ghost.pixelY = ghost.baseY * TILE_SIZE;
        ghost.vulnerable = false;
        ghost.eaten = false;
    });
    
    powerMode = false;
}

// Reset level
function resetLevel() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (maze[row][col] === 0) {
                if ((row === 1 || row === 29 || col === 1 || col === 26) ||
                    (row >= 5 && row <= 26 && (col === 6 || col === 21))) {
                    maze[row][col] = 2;
                }
            }
        }
    }
    
    maze[3][1] = 3;
    maze[3][26] = 3;
    maze[23][1] = 3;
    maze[23][26] = 3;
    
    pelletCount = countPellets();
    resetPositions();
    updateStats();
}

// Update stats
function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
}

// Game over
function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    if (e.key === 'ArrowUp') {
        player.nextDirection = 'up';
        e.preventDefault();
    } else if (e.key === 'ArrowDown') {
        player.nextDirection = 'down';
        e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
        player.nextDirection = 'left';
        e.preventDefault();
    } else if (e.key === 'ArrowRight') {
        player.nextDirection = 'right';
        e.preventDefault();
    }
});

// Game loop
function gameLoop() {
    if (!gameRunning) return;
    
    // Check power mode timer
    if (powerMode && Date.now() >= powerModeTimer) {
        powerMode = false;
        ghosts.forEach(g => g.vulnerable = false);
    }
    
    drawMaze();
    drawPlayer();
    drawGhosts();
    movePlayer();
    moveGhosts();
    checkGhostCollision();
    
    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();
