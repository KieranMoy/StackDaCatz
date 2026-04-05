const { Engine, Render, Runner, World, Bodies, Body, Events, Composite } = Matter;

const canvas = document.getElementById("game");
const scoreEl = document.getElementById("score");

const width = window.innerWidth;
const height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const engine = Engine.create();
const world = engine.world;
world.gravity.y = 0.9;

const render = Render.create({
  canvas,
  engine,
  options: {
    width,
    height,
    wireframes: false,
    background: "#efe2d0"
  }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

let score = 0;
let gameOver = false;
let currentCat = null;
let catDropped = false;
let moveLeft = false;
let moveRight = false;

const tableX = width / 2;
const tableWidth = 500;
const tableY = height - 170;
const floorTop = height - 110;

const ground = Bodies.rectangle(width / 2, height + 40, width, 80, {
  isStatic: true,
  render: { visible: false }
});

const leftWall = Bodies.rectangle(-30, height / 2, 60, height, {
  isStatic: true,
  render: { visible: false }
});

const rightWall = Bodies.rectangle(width + 30, height / 2, 60, height, {
  isStatic: true,
  render: { visible: false }
});

const table = Bodies.rectangle(tableX, tableY, tableWidth, 26, {
  isStatic: true,
  label: "table",
  render: {
    fillStyle: "#7a4e2d",
    strokeStyle: "#5c371f",
    lineWidth: 2
  }
});

const tableLegLeft = Bodies.rectangle(tableX - 170, tableY + 80, 28, 160, {
  isStatic: true,
  render: {
    fillStyle: "#6a4125"
  }
});

const tableLegRight = Bodies.rectangle(tableX + 170, tableY + 80, 28, 160, {
  isStatic: true,
  render: {
    fillStyle: "#6a4125"
  }
});

World.add(world, [ground, leftWall, rightWall, table, tableLegLeft, tableLegRight]);

function randomCatColor() {
  const colors = ["#ff9f1c", "#ff595e", "#8ac926", "#1982c4", "#6a4c93"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createCat(x, y, isStatic = false) {
  return Bodies.rectangle(x, y, 88, 58, {
    isStatic,
    label: "cat",
    chamfer: { radius: 18 },
    friction: 0.9,
    restitution: 0.05,
    density: 0.002,
    render: {
      fillStyle: randomCatColor(),
      strokeStyle: "#2b2b2b",
      lineWidth: 2
    }
  });
}

function spawnCat() {
  if (gameOver) return;

  currentCat = createCat(tableX, 90, true);
  catDropped = false;
  World.add(world, currentCat);
}

function dropCurrentCat() {
  if (!currentCat || catDropped || gameOver) return;

  Body.setStatic(currentCat, false);
  Body.setVelocity(currentCat, { x: 0, y: 1.5 });
  Body.setAngularVelocity(currentCat, (Math.random() - 0.5) * 0.02);

  catDropped = true;
  score += 1;
  scoreEl.textContent = score;

  setTimeout(() => {
    if (!gameOver) {
      spawnCat();
    }
  }, 1600);
}

function restartGame() {
  const allBodies = Composite.allBodies(world);

  for (const body of allBodies) {
    if (body.label === "cat") {
      World.remove(world, body);
    }
  }

  score = 0;
  scoreEl.textContent = score;
  gameOver = false;
  currentCat = null;
  catDropped = false;

  spawnCat();
}

function endGame() {
  if (gameOver) return;
  gameOver = true;

  setTimeout(() => {
    alert("A cat fell off the table! Press R to restart.");
  }, 50);
}

Events.on(engine, "beforeUpdate", () => {
  if (!currentCat || catDropped || gameOver) return;

  let dx = 0;
  const speed = 3;

  if (moveLeft) dx -= speed;
  if (moveRight) dx += speed;

  const nextX = currentCat.position.x + dx;
  const leftLimit = tableX - 210;
  const rightLimit = tableX + 210;

  if (nextX > leftLimit && nextX < rightLimit) {
    Body.setPosition(currentCat, {
      x: nextX,
      y: currentCat.position.y
    });
  }
});

Events.on(engine, "afterUpdate", () => {
  if (gameOver) return;

  const allBodies = Composite.allBodies(world);

  for (const body of allBodies) {
    if (body.label !== "cat" || body.isStatic) continue;

    if (body.position.y > height + 80) {
      endGame();
      break;
    }

    if (
      body.position.y > tableY - 30 &&
      (body.position.x < tableX - 310 || body.position.x > tableX + 310)
    ) {
      endGame();
      break;
    }
  }
});

function drawKitchenBackground() {
  const ctx = render.context;

  Events.on(render, "beforeRender", () => {
    ctx.save();

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

    ctx.restore();
  });
}

function drawCatFace(body) {
  const ctx = render.context;
  const x = body.position.x;
  const y = body.position.y;
  const angle = body.angle;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = "#2b2b2b";

  // ears
  ctx.beginPath();
  ctx.moveTo(-22, -18);
  ctx.lineTo(-12, -34);
  ctx.lineTo(-4, -18);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(4, -18);
  ctx.lineTo(12, -34);
  ctx.lineTo(22, -18);
  ctx.fill();

  // eyes
  ctx.beginPath();
  ctx.arc(-12, -2, 3, 0, Math.PI * 2);
  ctx.arc(12, -2, 3, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = "#ffb3c1";
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-4, 11);
  ctx.lineTo(4, 11);
  ctx.closePath();
  ctx.fill();

  // whiskers
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7, 10);
  ctx.lineTo(-24, 6);
  ctx.moveTo(-7, 13);
  ctx.lineTo(-24, 15);
  ctx.moveTo(7, 10);
  ctx.lineTo(24, 6);
  ctx.moveTo(7, 13);
  ctx.lineTo(24, 15);
  ctx.stroke();

  ctx.restore();
}

function drawOverlayDetails() {
  const ctx = render.context;

  Events.on(render, "afterRender", () => {
    const allBodies = Composite.allBodies(world);

    for (const body of allBodies) {
      if (body.label === "cat") {
        drawCatFace(body);
      }
    }

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(tableX - tableWidth / 2, tableY - 13, tableWidth, 6);
    ctx.restore();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") moveLeft = true;
  if (e.code === "ArrowRight") moveRight = true;

  if (e.code === "Space") {
    e.preventDefault();
    dropCurrentCat();
  }

  if (e.key.toLowerCase() === "r") {
    restartGame();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") moveLeft = false;
  if (e.code === "ArrowRight") moveRight = false;
});

drawKitchenBackground();
drawOverlayDetails();
spawnCat();