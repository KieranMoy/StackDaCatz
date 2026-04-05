const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const width = window.innerWidth;
const height = window.innerHeight;

canvas.width = width;
canvas.height = height;

let score = 0;
let gameOver = false;

const floorTop = height - 110;
const table = {
  x: width / 2 - 250,
  y: height - 170,
  width: 500,
  height: 24
};

const catWidth = 88;
const catHeight = 58;
const moveSpeed = 4;
const fallSpeed = 6;

let moveLeft = false;
let moveRight = false;

let stackedCats = [];
let currentCat = null;

function randomCatColor() {
  const colors = ["#ff9f1c", "#ff595e", "#8ac926", "#1982c4", "#6a4c93"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function spawnCat() {
  currentCat = {
    x: width / 2 - catWidth / 2,
    y: 70,
    width: catWidth,
    height: catHeight,
    color: randomCatColor(),
    falling: false
  };
}

function resetGame() {
  score = 0;
  scoreEl.textContent = score;
  gameOver = false;
  stackedCats = [];
  spawnCat();
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getLandingY(cat) {
  let landingY = table.y - cat.height;

  // only allow support from cats that overlap horizontally
  for (const other of stackedCats) {
    const horizontalOverlap =
      cat.x < other.x + other.width &&
      cat.x + cat.width > other.x;

    if (!horizontalOverlap) continue;

    const candidateY = other.y - cat.height;

    if (candidateY < landingY && other.y >= 0) {
      landingY = candidateY;
    }
  }

  return landingY;
}

function isSupported(cat) {
  // supported by table
  const onTable =
    cat.y + cat.height === table.y &&
    cat.x + cat.width > table.x &&
    cat.x < table.x + table.width;

  if (onTable) return true;

  // supported by another cat
  for (const other of stackedCats) {
    if (other === cat) continue;

    const touchingTop = cat.y + cat.height === other.y;
    const horizontalOverlap =
      cat.x + cat.width > other.x &&
      cat.x < other.x + other.width;

    if (touchingTop && horizontalOverlap) {
      return true;
    }
  }

  return false;
}

function dropCat() {
  if (!currentCat || currentCat.falling || gameOver) return;
  currentCat.falling = true;
}

function endGame() {
  gameOver = true;
  setTimeout(() => {
    alert("A cat fell off the table! Press R to restart.");
  }, 50);
}

function update() {
  if (gameOver) return;

  if (currentCat && !currentCat.falling) {
    if (moveLeft) currentCat.x -= moveSpeed;
    if (moveRight) currentCat.x += moveSpeed;

    const minX = table.x - 120;
    const maxX = table.x + table.width - catWidth + 120;

    if (currentCat.x < minX) currentCat.x = minX;
    if (currentCat.x > maxX) currentCat.x = maxX;
  }

  if (currentCat && currentCat.falling) {
    const targetY = getLandingY(currentCat);

    if (currentCat.y + fallSpeed < targetY) {
      currentCat.y += fallSpeed;
    } else {
      currentCat.y = targetY;

      const landedOnTable =
        currentCat.x + currentCat.width > table.x &&
        currentCat.x < table.x + table.width;

      const landedOnStack = stackedCats.some(other => {
        const touchingTop = currentCat.y + currentCat.height === other.y;
        const horizontalOverlap =
          currentCat.x + currentCat.width > other.x &&
          currentCat.x < other.x + other.width;
        return touchingTop && horizontalOverlap;
      });

      if (!landedOnTable && !landedOnStack) {
        endGame();
        return;
      }

      stackedCats.push({ ...currentCat });
      score += 1;
      scoreEl.textContent = score;

      // lose if stack reaches too high
      if (currentCat.y < 80) {
        endGame();
        return;
      }

      spawnCat();
    }
  }
}

function drawKitchen() {
  // wall
  ctx.fillStyle = "#efe2d0";
  ctx.fillRect(0, 0, width, height);

  // floor
  ctx.fillStyle = "#d8c3a5";
  ctx.fillRect(0, floorTop, width, height - floorTop);

  // window frame
  ctx.fillStyle = "#b58b68";
  ctx.fillRect(60, 130, 150, 170);

  // window glass
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(80, 150, 110, 130);

  // fridge
  ctx.fillStyle = "#aeb7c0";
  ctx.fillRect(width - 240, 130, 120, 230);

  // fridge top
  ctx.fillStyle = "#6b7680";
  ctx.fillRect(width - 260, 105, 160, 35);
}

function drawTable() {
  ctx.fillStyle = "#7a4e2d";
  ctx.fillRect(table.x, table.y, table.width, table.height);

  ctx.fillStyle = "#6a4125";
  ctx.fillRect(table.x + 45, table.y + table.height, 28, 160);
  ctx.fillRect(table.x + table.width - 73, table.y + table.height, 28, 160);

  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(table.x, table.y, table.width, 5);
}

function drawCat(cat) {
  ctx.fillStyle = cat.color;
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 2;

  // body
  roundRect(ctx, cat.x, cat.y, cat.width, cat.height, 18);
  ctx.fill();
  ctx.stroke();

  // ears
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.moveTo(cat.x + 18, cat.y + 10);
  ctx.lineTo(cat.x + 28, cat.y - 8);
  ctx.lineTo(cat.x + 36, cat.y + 10);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cat.x + cat.width - 36, cat.y + 10);
  ctx.lineTo(cat.x + cat.width - 28, cat.y - 8);
  ctx.lineTo(cat.x + cat.width - 18, cat.y + 10);
  ctx.fill();

  // eyes
  ctx.beginPath();
  ctx.arc(cat.x + 28, cat.y + 24, 3, 0, Math.PI * 2);
  ctx.arc(cat.x + 60, cat.y + 24, 3, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = "#ffb3c1";
  ctx.beginPath();
  ctx.moveTo(cat.x + 44, cat.y + 31);
  ctx.lineTo(cat.x + 40, cat.y + 37);
  ctx.lineTo(cat.x + 48, cat.y + 37);
  ctx.closePath();
  ctx.fill();

  // whiskers
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cat.x + 38, cat.y + 36);
  ctx.lineTo(cat.x + 18, cat.y + 32);
  ctx.moveTo(cat.x + 38, cat.y + 39);
  ctx.lineTo(cat.x + 18, cat.y + 41);

  ctx.moveTo(cat.x + 50, cat.y + 36);
  ctx.lineTo(cat.x + 70, cat.y + 32);
  ctx.moveTo(cat.x + 50, cat.y + 39);
  ctx.lineTo(cat.x + 70, cat.y + 41);
  ctx.stroke();
}

function roundRect(ctx, x, y, width, height, radius) {
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

function draw() {
  ctx.clearRect(0, 0, width, height);

  drawKitchen();
  drawTable();

  for (const cat of stackedCats) {
    drawCat(cat);
  }

  if (currentCat) {
    drawCat(currentCat);
  }
}

function gameLoop() {
  update();
  draw();
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

resetGame();
gameLoop();