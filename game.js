// Bitcoin Pac-Man Game
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
const POWER_MODE_DURATION = 5000; // 5 seconds

// Player
const player = {
    x: 13,
    y: 23,
    direction: 'right',
    nextDirection: 'right',
    speed: 0.18,
    image: null,
    imageLoaded: false
};

// Load player image
const playerImg = new Image();
playerImg.src = 'pacman.jpg';
playerImg.onload = () => {
    player.imageLoaded = true;
    // Remove white background by creating a canvas with transparency
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = playerImg.width;
    tempCanvas.height = playerImg.height;
    
    tempCtx.drawImage(playerImg, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    // Remove white/light backgrounds
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // If pixel is mostly white/light, make it transparent
        if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; // Set alpha to 0
        }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    
    // Create new image from cleaned canvas
    const cleanImg = new Image();
    cleanImg.src = tempCanvas.toDataURL();
    cleanImg.onload = () => {
        playerImg.src = cleanImg.src;
    };
};

// Shitcoin ghosts
const ghosts = [
    { name: 'SOL', color: '#14F195', x: 12, y: 11, direction: 'up', targetX: 0, targetY: 0, vulnerable: false, eaten: false, baseX: 12, baseY: 11 },
    { name: 'ETH', color: '#627EEA', x: 13, y: 11, direction: 'up', targetX: 0, targetY: 0, vulnerable: false, eaten: false, baseX: 13, baseY: 11 },
    { name: 'ADA', color: '#0033AD', x: 14, y: 11, direction: 'up', targetX: 0, targetY: 0, vulnerable: false, eaten: false, baseX: 14, baseY: 11 },
    { name: 'XRP', color: '#23292F', x: 15, y: 11, direction: 'up', targetX: 0, targetY: 0, vulnerable: false, eaten: false, baseX: 15, baseY: 11 }
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

// Sound effects (Web Audio API)
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
                // Wall
                ctx.fillStyle = '#2121ff';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#1a1aaa';
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            } else if (cell === 2) {
                // Bitcoin pellet
                ctx.fillStyle = '#f7931a';
                ctx.font = 'bold 10px Arial';
                ctx.fillText('₿', x + 5, y + 14);
            } else if (cell === 3) {
                // Power pellet
                ctx.fillStyle = '#f7931a';
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Draw player
function drawPlayer() {
    const x = player.x * TILE_SIZE;
    const y = player.y * TILE_SIZE;
    
    if (player.imageLoaded) {
        ctx.save();
        ctx.translate(x + TILE_SIZE/2, y + TILE_SIZE/2);
        
        // Rotate based on direction
        if (player.direction === 'right') ctx.rotate(0);
        else if (player.direction === 'down') ctx.rotate(Math.PI / 2);
        else if (player.direction === 'left') ctx.rotate(Math.PI);
        else if (player.direction === 'up') ctx.rotate(-Math.PI / 2);
        
        ctx.drawImage(playerImg, -TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);
        ctx.restore();
    } else {
        // Fallback yellow circle
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw ghosts
function drawGhosts() {
    ghosts.forEach(ghost => {
        if (ghost.eaten) return; // Don't draw eaten ghosts during respawn
        
        const x = ghost.x * TILE_SIZE;
        const y = ghost.y * TILE_SIZE;
        
        // Ghost body - blue when vulnerable
        ctx.fillStyle = ghost.vulnerable ? '#3333ff' : ghost.color;
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
        
        // Eyes - scared look when vulnerable
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
        
        // Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(ghost.name, x + TILE_SIZE/2, y + TILE_SIZE + 8);
        ctx.textAlign = 'left';
    });
}

// Check collision
function canMove(x, y) {
    const col = Math.floor(x);
    const row = Math.floor(y);
    
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
        return false;
    }
    
    return maze[row][col] !== 1;
}

// Move player
function movePlayer() {
    // Try to change direction
    let newX = player.x;
    let newY = player.y;
    
    if (player.nextDirection === 'up') newY -= player.speed;
    else if (player.nextDirection === 'down') newY += player.speed;
    else if (player.nextDirection === 'left') newX -= player.speed;
    else if (player.nextDirection === 'right') newX += player.speed;
    
    if (canMove(newX, newY)) {
        player.direction = player.nextDirection;
    }
    
    // Move in current direction
    newX = player.x;
    newY = player.y;
    
    if (player.direction === 'up') newY -= player.speed;
    else if (player.direction === 'down') newY += player.speed;
    else if (player.direction === 'left') newX -= player.speed;
    else if (player.direction === 'right') newX += player.speed;
    
    if (canMove(newX, newY)) {
        player.x = newX;
        player.y = newY;
        
        // Wrap around
        if (player.x < 0) player.x = COLS - 1;
        if (player.x >= COLS) player.x = 0;
        
        // Check for pellets
        const col = Math.floor(player.x);
        const row = Math.floor(player.y);
        
        if (maze[row][col] === 2) {
            maze[row][col] = 0;
            score += 10;
            pelletCount--;
            playNomSound();
            updateStats();
        } else if (maze[row][col] === 3) {
            maze[row][col] = 0;
            score += 50;
            pelletCount--;
            playNomSound();
            
            // Activate power mode!
            powerMode = true;
            powerModeTimer = Date.now() + POWER_MODE_DURATION;
            ghosts.forEach(g => g.vulnerable = true);
            
            updateStats();
        }
        
        // Level complete
        if (pelletCount === 0) {
            level++;
            resetLevel();
        }
    }
}

// Ghost AI - chase player or flee when vulnerable
function moveGhosts() {
    ghosts.forEach(ghost => {
        // If eaten, respawn to center
        if (ghost.eaten) {
            ghost.x = ghost.baseX;
            ghost.y = ghost.baseY;
            ghost.eaten = false;
            return;
        }
        
        const speed = ghost.vulnerable ? 0.06 : 0.09;
        
        // Calculate direction to/from player
        const dx = player.x - ghost.x;
        const dy = player.y - ghost.y;
        
        // Choose direction based on vulnerability
        let targetDirection;
        if (ghost.vulnerable) {
            // Flee from player
            if (Math.abs(dx) > Math.abs(dy)) {
                targetDirection = dx > 0 ? 'left' : 'right';
            } else {
                targetDirection = dy > 0 ? 'up' : 'down';
            }
        } else {
            // Chase player
            if (Math.abs(dx) > Math.abs(dy)) {
                targetDirection = dx > 0 ? 'right' : 'left';
            } else {
                targetDirection = dy > 0 ? 'down' : 'up';
            }
        }
        
        // Try target direction, otherwise pick random valid direction
        let newX = ghost.x;
        let newY = ghost.y;
        
        if (targetDirection === 'up') newY -= speed;
        else if (targetDirection === 'down') newY += speed;
        else if (targetDirection === 'left') newX -= speed;
        else if (targetDirection === 'right') newX += speed;
        
        if (canMove(newX, newY)) {
            ghost.x = newX;
            ghost.y = newY;
            ghost.direction = targetDirection;
        } else {
            // Try perpendicular directions
            const perpDirs = [];
            if (targetDirection === 'up' || targetDirection === 'down') {
                perpDirs.push('left', 'right');
            } else {
                perpDirs.push('up', 'down');
            }
            
            for (const dir of perpDirs) {
                newX = ghost.x;
                newY = ghost.y;
                
                if (dir === 'up') newY -= speed;
                else if (dir === 'down') newY += speed;
                else if (dir === 'left') newX -= speed;
                else if (dir === 'right') newX += speed;
                
                if (canMove(newX, newY)) {
                    ghost.x = newX;
                    ghost.y = newY;
                    ghost.direction = dir;
                    break;
                }
            }
        }
        
        // Wrap around
        if (ghost.x < 0) ghost.x = COLS - 1;
        if (ghost.x >= COLS) ghost.x = 0;
    });
}

// Check ghost collision
function checkGhostCollision() {
    ghosts.forEach(ghost => {
        if (ghost.eaten) return;
        
        const distance = Math.sqrt(
            Math.pow(player.x - ghost.x, 2) + 
            Math.pow(player.y - ghost.y, 2)
        );
        
        if (distance < 0.6) {
            if (ghost.vulnerable) {
                // Eat the ghost!
                ghost.eaten = true;
                ghost.vulnerable = false;
                score += 200;
                playNomSound();
                updateStats();
                
                // Ghost will respawn in center next frame
            } else {
                // Ghost caught player
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
    player.x = 13;
    player.y = 23;
    player.direction = 'right';
    player.nextDirection = 'right';
    
    ghosts[0].x = 12; ghosts[0].y = 11;
    ghosts[1].x = 13; ghosts[1].y = 11;
    ghosts[2].x = 14; ghosts[2].y = 11;
    ghosts[3].x = 15; ghosts[3].y = 11;
}

// Reset level
function resetLevel() {
    // Restore pellets
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (maze[row][col] === 0) {
                // Restore pellets in paths
                if ((row === 1 || row === 29 || col === 1 || col === 26) ||
                    (row >= 5 && row <= 26 && (col === 6 || col === 21))) {
                    maze[row][col] = 2;
                }
            }
        }
    }
    
    // Restore power pellets
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
