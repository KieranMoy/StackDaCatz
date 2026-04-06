// Matter.js modules
const { Engine, World, Bodies, Body, Runner, Sleeping } = Matter;

// Canvas and context
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

// Game variables
let engine;
let world;
let runner;
let score = 0;
let gameOver = false;
let currentCat = null;
let catDropped = false;
let moveLeft = false;
let moveRight = false;
const catBodies = [];

// Table and ground
let table;
let ground;

// Initialize game
function init() {
  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Create engine
  engine = Engine.create();
  engine.enableSleeping = true;
  world = engine.world;
  world.gravity.y = 1.2;

  // Create runner
  runner = Runner.create();
  Runner.run(runner, engine);

  // Create table
  table = Bodies.rectangle(canvas.width / 2, canvas.height - 150, 400, 20, {
    isStatic: true,
    friction: 0.4,
    restitution: 0.1
  });

  // Create ground (below screen)
  ground = Bodies.rectangle(canvas.width / 2, canvas.height + 50, canvas.width, 100, {
    isStatic: true
  });

  // Add bodies to world
  World.add(world, [table, ground]);

  // Spawn first cat
  spawnCat();

  // Start game loop
  gameLoop();
}

// Spawn a new cat at the top
function spawnCat() {
  if (gameOver) return;

  const x = canvas.width / 2;
  const y = 100;
  currentCat = Bodies.rectangle(x, y, 80, 50, {
    isStatic: true,
    friction: 0.5,
    restitution: 0.2,
    density: 0.01,
    chamfer: { radius: 15 }
  });
  currentCat.renderColor = getRandomColor();
  World.add(world, currentCat);
  catDropped = false;
}

// Drop the current cat
function dropCat() {
  if (!currentCat || catDropped || gameOver) return;

  Body.setStatic(currentCat, false);
  Body.setVelocity(currentCat, { x: 0, y: 1 });
  catDropped = true;
  score++;
  scoreEl.textContent = score;
}

// Move the current cat left/right
function moveCat() {
  if (!currentCat || catDropped || gameOver) return;

  const speed = 4;
  let dx = 0;
  if (moveLeft) dx -= speed;
  if (moveRight) dx += speed;

  const newX = currentCat.position.x + dx;
  const minX = table.position.x - 180;
  const maxX = table.position.x + 180;

  Body.setPosition(currentCat, {
    x: Math.max(minX, Math.min(maxX, newX)),
    y: currentCat.position.y
  });
}

// Check game logic
function updateGame() {
  if (gameOver) return;

  moveCat();

  // Check if dropped cat has settled
  if (currentCat && catDropped && Sleeping(currentCat)) {
    catBodies.push(currentCat);
    currentCat = null;

    // Check if stack is too high
    const highestY = Math.min(...catBodies.map(cat => cat.position.y));
    if (highestY < 120) {
      endGame();
      return;
    }

    // Spawn new cat
    spawnCat();
  }

  // Check if any cat has fallen off
  for (const cat of [...catBodies, currentCat].filter(Boolean)) {
    if (cat.position.y > canvas.height + 100 ||
        cat.position.x < -100 ||
        cat.position.x > canvas.width + 100) {
      endGame();
      return;
    }
  }
}

// End the game
function endGame() {
  gameOver = true;
  Runner.stop(runner);
  setTimeout(() => {
    alert('Game Over! Press R to restart.');
  }, 100);
}

// Reset the game
function resetGame() {
  // Remove all bodies
  World.clear(world, false);
  catBodies.length = 0;
  currentCat = null;
  catDropped = false;
  gameOver = false;
  score = 0;
  scoreEl.textContent = score;

  // Recreate world
  World.add(world, [table, ground]);
  spawnCat();
  Runner.run(runner, engine);
}

// Draw the game
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw table
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(table.position.x - 200, table.position.y - 10, 400, 20);

  // Draw cats
  for (const cat of catBodies) {
    drawCat(cat);
  }
  if (currentCat) {
    drawCat(currentCat);
  }
}

// Draw a cat
function drawCat(cat) {
  ctx.save();
  ctx.translate(cat.position.x, cat.position.y);
  ctx.rotate(cat.angle);

  ctx.fillStyle = cat.renderColor;
  ctx.fillRect(-40, -25, 80, 50);

  // Simple cat face
  ctx.fillStyle = '#000';
  ctx.fillRect(-15, -10, 5, 5); // left eye
  ctx.fillRect(10, -10, 5, 5);  // right eye
  ctx.fillRect(-5, 5, 10, 5);   // nose

  ctx.restore();
}

// Get random color
function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Game loop
function gameLoop() {
  updateGame();
  draw();
  requestAnimationFrame(gameLoop);
}

// Event listeners
document.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft') moveLeft = true;
  if (e.code === 'ArrowRight') moveRight = true;
  if (e.code === 'Space') {
    e.preventDefault();
    dropCat();
  }
  if (e.key.toLowerCase() === 'r') {
    resetGame();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') moveLeft = false;
  if (e.code === 'ArrowRight') moveRight = false;
});

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Start the game
init();