const { Engine, World, Bodies, Body, Runner, Composite } = Matter;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const engine = Engine.create();
const world = engine.world;
world.gravity.y = 1.0;

const runner = Runner.create();
Runner.run(runner, engine);

let score = 0;
let gameOver = false;

let moveLeft = false;
let moveRight = false;

let currentCat = null;
let catDropped = false;
let settleFrames = 0;

const catBodies = [];

const floorTop = height - 110;

const table = {
  x: width / 2,
  y: height - 170,
  width: 500,
  height: 24
};

const ground = Bodies.rectangle(width / 2, height + 40, width, 80, {
  isStatic: true,
  label: "ground"
});

const leftWall = Bodies.rectangle(-40, height / 2, 80, height * 2, {
  isStatic: true,
  label: "wall"
});

const rightWall = Bodies.rectangle(width + 40, height / 2, 80, height * 2, {
  isStatic: true,
  label: "wall"
});

const tableBody = Bodies.rectangle(table.x, table.y, table.width, table.height, {
  isStatic: true,
  label: "table",
  friction: 0.9
});

const legLeft = Bodies.rectangle(table.x - 170, table.y + 80, 28, 160, {
  isStatic: true,
  label: "tableLeg"
});

const legRight = Bodies.rectangle(table.x + 170, table.y + 80, 28, 160, {
  isStatic: true,
  label: "tableLeg"
});

World.add(world, [ground, leftWall, rightWall, tableBody, legLeft, legRight]);

function randomCatColor() {
  const colors = ["#ff9f1c", "#ff595e", "#8ac926", "#1982c4", "#6a4c93"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createCatBody(x, y, isStatic = false) {
  const cat = Bodies.rectangle(x, y, 88, 58, {
    isStatic,
    label: "cat",
    chamfer: { radius: 18 },
    friction: 0.9,
    frictionStatic: 1.0,
    restitution: 0.05,
    density: 0.0025
  });

  cat.renderColor = randomCatColor();
  return cat;
}

function spawnCat() {
  if (gameOver) return;

  currentCat = createCatBody(table.x, 90, true);
  catDropped = false;
  settleFrames = 0;
  World.add(world, currentCat);
}

function dropCat() {
  if (!currentCat || catDropped || gameOver) return;

  Body.setStatic(currentCat, false);
  Body.setVelocity(currentCat, { x: 0, y: 0.5 });

  catDropped = true;
  score += 1;
  scoreEl.textContent = score;
}

function resetGame() {
  for (const body of [...catBodies, currentCat].filter(Boolean)) {
    World.remove(world, body);
  }

  catBodies.length = 0;
  currentCat = null;
  catDropped = false;
  settleFrames = 0;
  gameOver = false;
  score = 0;
  scoreEl.textContent = score;

  spawnCat();
}

function endGame() {
  if (gameOver) return;
  gameOver = true;

  setTimeout(() => {
    alert("A cat fell off the table! Press R to restart.");
  }, 50);
}

function updateGameLogic() {
  if (gameOver) return;

  if (currentCat && !catDropped) {
    const speed = 3;
    let dx = 0;

    if (moveLeft) dx -= speed;
    if (moveRight) dx += speed;

    const nextX = currentCat.position.x + dx;
    const minX = table.x - 220;
    const maxX = table.x + 220;

    Body.setPosition(currentCat, {
      x: Math.max(minX, Math.min(maxX, nextX)),
      y: currentCat.position.y
    });
  }

  if (currentCat && catDropped) {
    const speed = currentCat.speed;
    const angularSpeed = Math.abs(currentCat.angularSpeed);

    if (speed < 0.15 && angularSpeed < 0.02 && currentCat.position.y < height - 20) {
      settleFrames++;
    } else {
      settleFrames = 0;
    }

    if (settleFrames > 30) {
      catBodies.push(currentCat);
      currentCat = null;
      catDropped = false;
      settleFrames = 0;

      const highestCatY = Math.min(...catBodies.map(c => c.position.y));
      if (highestCatY < 100) {
        endGame();
        return;
      }

      spawnCat();
    }
  }

  for (const cat of [...catBodies, currentCat].filter(Boolean)) {
    if (cat.position.y > height + 120) {
      endGame();
      return;
    }

    if (cat.position.x < -120 || cat.position.x > width + 120) {
      endGame();
      return;
    }
  }
}

function drawKitchen() {
  ctx.fillStyle = "#efe2d0";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#d8c3a5";
  ctx.fillRect(0, floorTop, width, height - floorTop);

  ctx.fillStyle = "#b58b68";
  ctx.fillRect(60, 130, 150, 170);

  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(80, 150, 110, 130);

  ctx.fillStyle = "#aeb7c0";
  ctx.fillRect(width - 240, 130, 120, 230);

  ctx.fillStyle = "#6b7680";
  ctx.fillRect(width - 260, 105, 160, 35);
}

function drawTable() {
  ctx.fillStyle = "#7a4e2d";
  ctx.fillRect(table.x - table.width / 2, table.y - table.height / 2, table.width, table.height);

  ctx.fillStyle = "#6a4125";
  ctx.fillRect(table.x - 170 - 14, table.y + 12, 28, 160);
  ctx.fillRect(table.x + 170 - 14, table.y + 12, 28, 160);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(table.x - table.width / 2, table.y - table.height / 2, table.width, 5);
}

function roundRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCat(cat) {
  const x = cat.position.x;
  const y = cat.position.y;
  const angle = cat.angle;
  const w = 88;
  const h = 58;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = cat.renderColor;
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 2;

  roundRectPath(ctx, -w / 2, -h / 2, w, h, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2b2b2b";

  // ears
  ctx.beginPath();
  ctx.moveTo(-26, -18);
  ctx.lineTo(-16, -34);
  ctx.lineTo(-8, -18);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(8, -18);
  ctx.lineTo(16, -34);
  ctx.lineTo(26, -18);
  ctx.fill();

  // eyes
  ctx.beginPath();
  ctx.arc(-14, -4, 3, 0, Math.PI * 2);
  ctx.arc(14, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = "#ffb3c1";
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(-4, 11);
  ctx.lineTo(4, 11);
  ctx.closePath();
  ctx.fill();

  // whiskers
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, 10);
  ctx.lineTo(-24, 6);
  ctx.moveTo(-6, 13);
  ctx.lineTo(-24, 15);
  ctx.moveTo(6, 10);
  ctx.lineTo(24, 6);
  ctx.moveTo(6, 13);
  ctx.lineTo(24, 15);
  ctx.stroke();

  ctx.restore();
}

function drawAll() {
  ctx.clearRect(0, 0, width, height);

  drawKitchen();
  drawTable();

  for (const cat of catBodies) {
    drawCat(cat);
  }

  if (currentCat) {
    drawCat(currentCat);
  }
}

function gameLoop() {
  updateGameLogic();
  drawAll();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") moveLeft = true;
  if (e.code === "ArrowRight") moveRight = true;

  if (e.code === "Space") {
    e.preventDefault();
    dropCat();
  }

  if (e.key.toLowerCase() === "r") {
    resetGame();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") moveLeft = false;
  if (e.code === "ArrowRight") moveRight = false;
});

window.addEventListener("resize", () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});

resetGame();
gameLoop();