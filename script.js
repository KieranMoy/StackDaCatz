const { Engine, Render, Runner, World, Bodies, Body, Events, Composite } = Matter;

const canvas = document.getElementById("game");
const scoreEl = document.getElementById("score");

const width = window.innerWidth;
const height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const engine = Engine.create();
const world = engine.world;
world.gravity.y = 1.2;

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
let currentShape = null;
let shapeDropped = false;
let moveLeft = false;
let moveRight = false;

const tableX = width / 2;
const tableWidth = 420;
const tableTopY = height - 170;
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

const table = Bodies.rectangle(tableX, tableTopY, tableWidth, 26, {
  isStatic: true,
  label: "table",
  render: {
    fillStyle: "#7a4e2d",
    strokeStyle: "#5c371f",
    lineWidth: 2
  }
});

const tableLegLeft = Bodies.rectangle(tableX - 150, tableTopY + 70, 28, 140, {
  isStatic: true,
  render: {
    fillStyle: "#6a4125"
  }
});

const tableLegRight = Bodies.rectangle(tableX + 150, tableTopY + 70, 28, 140, {
  isStatic: true,
  render: {
    fillStyle: "#6a4125"
  }
});

World.add(world, [ground, leftWall, rightWall, table, tableLegLeft, tableLegRight]);

function randomShapeColor() {
  const colors = ["#ff9f1c", "#ff595e", "#8ac926", "#1982c4", "#6a4c93"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createShape(x, y, isStatic = false) {
  const color = randomShapeColor();
  const type = Math.floor(Math.random() * 3);

  if (type === 0) {
    return Bodies.rectangle(x, y, 82, 54, {
      isStatic,
      label: "stackShape",
      chamfer: { radius: 10 },
      friction: 1.1,
      restitution: 0.08,
      density: 0.0025,
      render: {
        fillStyle: color,
        strokeStyle: "#2b2b2b",
        lineWidth: 2
      }
    });
  }

  if (type === 1) {
    return Bodies.polygon(x, y, 3, 40, {
      isStatic,
      label: "stackShape",
      friction: 1.1,
      restitution: 0.08,
      density: 0.0025,
      render: {
        fillStyle: color,
        strokeStyle: "#2b2b2b",
        lineWidth: 2
      }
    });
  }

  return Bodies.polygon(x, y, 6, 34, {
    isStatic,
    label: "stackShape",
    friction: 1.1,
    restitution: 0.08,
    density: 0.0025,
    render: {
      fillStyle: color,
      strokeStyle: "#2b2b2b",
      lineWidth: 2
    }
  });
}

function spawnShape() {
  if (gameOver) return;

  currentShape = createShape(tableX, 90, true);
  shapeDropped = false;
  World.add(world, currentShape);
}

function dropCurrentShape() {
  if (!currentShape || shapeDropped || gameOver) return;

  Body.setStatic(currentShape, false);
  Body.setAngle(currentShape, (Math.random() - 0.5) * 0.25);
  Body.setVelocity(currentShape, { x: 0, y: 2.5 });

  shapeDropped = true;
  score += 1;
  scoreEl.textContent = score;

  setTimeout(() => {
    if (!gameOver) {
      spawnShape();
    }
  }, 700);
}

function restartGame() {
  const allBodies = Composite.allBodies(world);

  for (const body of allBodies) {
    if (body.label === "stackShape") {
      World.remove(world, body);
    }
  }

  score = 0;
  scoreEl.textContent = score;
  gameOver = false;
  currentShape = null;
  shapeDropped = false;

  spawnShape();
}

function endGame() {
  if (gameOver) return;
  gameOver = true;

  setTimeout(() => {
    alert("A cat shape fell off the table! Press R to restart.");
  }, 50);
}

Events.on(engine, "beforeUpdate", () => {
  if (!currentShape || shapeDropped || gameOver) return;

  let dx = 0;
  const speed = 3;

  if (moveLeft) dx -= speed;
  if (moveRight) dx += speed;

  const nextX = currentShape.position.x + dx;
  const leftLimit = tableX - 180;
  const rightLimit = tableX + 180;

  if (nextX > leftLimit && nextX < rightLimit) {
    Body.setPosition(currentShape, {
      x: nextX,
      y: currentShape.position.y
    });
  }
});

Events.on(engine, "afterUpdate", () => {
  if (gameOver) return;

  const allBodies = Composite.allBodies(world);

  for (const body of allBodies) {
    if (body.label === "stackShape" && !body.isStatic) {
      if (body.position.y > height + 100) {
        endGame();
        break;
      }

      if (
        body.position.y > tableTopY - 10 &&
        (body.position.x < tableX - 260 || body.position.x > tableX + 260)
      ) {
        endGame();
        break;
      }
    }
  }
});

function drawKitchenBackground() {
  const ctx = render.context;

  Events.on(render, "beforeRender", () => {
    ctx.save();

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

  // ears
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.moveTo(-18, -18);
  ctx.lineTo(-8, -34);
  ctx.lineTo(0, -18);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(8, -34);
  ctx.lineTo(18, -18);
  ctx.fill();

  // eyes
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(-10, -4, 3, 0, Math.PI * 2);
  ctx.arc(10, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = "#ffb3c1";
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(-4, 10);
  ctx.lineTo(4, 10);
  ctx.closePath();
  ctx.fill();

  // whiskers
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(-6, 10);
  ctx.lineTo(-22, 6);
  ctx.moveTo(-6, 12);
  ctx.lineTo(-22, 14);
  ctx.moveTo(6, 10);
  ctx.lineTo(22, 6);
  ctx.moveTo(6, 12);
  ctx.lineTo(22, 14);
  ctx.stroke();

  ctx.restore();
}

function drawFacesOnShapes() {
  const ctx = render.context;

  Events.on(render, "afterRender", () => {
    const allBodies = Composite.allBodies(world);

    for (const body of allBodies) {
      if (body.label === "stackShape") {
        drawCatFace(body);
      }
    }

    // little table edge highlight
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(tableX - tableWidth / 2, tableTopY - 13, tableWidth, 6);
    ctx.restore();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") moveLeft = true;
  if (e.code === "ArrowRight") moveRight = true;

  if (e.code === "Space") {
    e.preventDefault();
    dropCurrentShape();
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
drawFacesOnShapes();
spawnShape();