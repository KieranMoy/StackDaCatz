const { Engine, Render, Runner, World, Bodies, Body, Events, Composite } = Matter;

const canvas = document.getElementById("game");
const scoreEl = document.getElementById("score");

const width = window.innerWidth;
const height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const engine = Engine.create();
const world = engine.world;
world.gravity.y = 1.4;

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
const tableY = height - 120;
const tableWidth = 420;

const ground = Bodies.rectangle(width / 2, height + 30, width, 60, {
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

const table = Bodies.rectangle(tableX, tableY, tableWidth, 24, {
  isStatic: true,
  label: "table",
  render: { fillStyle: "#5a3825" }
});

const tableLegLeft = Bodies.rectangle(tableX - 170, height - 45, 24, 140, {
  isStatic: true,
  render: { fillStyle: "#6f4a2d" }
});

const tableLegRight = Bodies.rectangle(tableX + 170, height - 45, 24, 140, {
  isStatic: true,
  render: { fillStyle: "#6f4a2d" }
});

World.add(world, [ground, leftWall, rightWall, table, tableLegLeft, tableLegRight]);

function randomShapeColor() {
  const colors = ["#ff7b00", "#ff3d00", "#ffbe0b", "#3a86ff", "#8338ec"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createShape(x, y, isStatic = false) {
  const color = randomShapeColor();
  const type = Math.floor(Math.random() * 3);

  if (type === 0) {
    return Bodies.rectangle(x, y, 80, 50, {
      isStatic,
      label: "stackShape",
      chamfer: { radius: 8 },
      friction: 1.2,
      restitution: 0.1,
      density: 0.0025,
      render: {
        fillStyle: color,
        strokeStyle: "#222",
        lineWidth: 2
      }
    });
  }

  if (type === 1) {
    return Bodies.polygon(x, y, 3, 40, {
      isStatic,
      label: "stackShape",
      friction: 1.2,
      restitution: 0.1,
      density: 0.0025,
      render: {
        fillStyle: color,
        strokeStyle: "#222",
        lineWidth: 2
      }
    });
  }

  return Bodies.polygon(x, y, 6, 35, {
    isStatic,
    label: "stackShape",
    friction: 1.2,
    restitution: 0.1,
    density: 0.0025,
    render: {
      fillStyle: color,
      strokeStyle: "#222",
      lineWidth: 2
    }
  });
}

function spawnShape() {
  if (gameOver) return;

  currentShape = createShape(tableX, 110, true);
  shapeDropped = false;
  World.add(world, currentShape);
}

function dropCurrentShape() {
  if (!currentShape || shapeDropped || gameOver) return;

  Body.setStatic(currentShape, false);
  Body.setAngle(currentShape, (Math.random() - 0.5) * 0.4);

  shapeDropped = true;
  score += 1;
  scoreEl.textContent = score;

  setTimeout(() => {
    if (!gameOver) {
      spawnShape();
    }
  }, 900);
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
    alert("A shape fell off the table! Press R to restart.");
  }, 50);
}

Events.on(engine, "beforeUpdate", () => {
  if (!currentShape || shapeDropped || gameOver) return;

  let dx = 0;
  const speed = 2.5;

  if (moveLeft) dx -= speed;
  if (moveRight) dx += speed;

  const nextX = currentShape.position.x + dx;
  const leftLimit = tableX - 200;
  const rightLimit = tableX + 200;

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
      if (body.position.y > height + 80) {
        endGame();
        break;
      }

      if (body.position.x < tableX - 260 || body.position.x > tableX + 260) {
        if (body.position.y > height - 180) {
          endGame();
          break;
        }
      }

      if (Math.abs(body.angle) > 1.8 && body.position.y > height - 220) {
        endGame();
        break;
      }
    }
  }
});

function drawKitchenDecor() {
  const ctx = render.context;

  Events.on(render, "afterRender", () => {
    ctx.save();

    // floor strip
    ctx.fillStyle = "#d8c3a5";
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    // window
    ctx.fillStyle = "#b08968";
    ctx.fillRect(60, 90, 140, 180);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(78, 110, 104, 140);

    // fridge
    ctx.fillStyle = "#adb5bd";
    ctx.fillRect(width - 230, 120, 120, 220);
    ctx.fillStyle = "#6c757d";
    ctx.fillRect(width - 250, 90, 160, 30);

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

drawKitchenDecor();
spawnShape();