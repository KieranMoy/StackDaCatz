const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Body,
  Events
} = Matter;

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
    background: "#f7efe5"
  }
});

Render.run(render);
Runner.run(Runner.create(), engine);

let score = 0;
let gameOver = false;
let currentCat = null;
let catDropped = false;

let moveLeft = false;
let moveRight = false;

const walls = [
  Bodies.rectangle(width / 2, height + 30, width, 60, {
    isStatic: true,
    render: { fillStyle: "#d9c2a3" }
  }),
  Bodies.rectangle(-30, height / 2, 60, height, {
    isStatic: true,
    render: { visible: false }
  }),
  Bodies.rectangle(width + 30, height / 2, 60, height, {
    isStatic: true,
    render: { visible: false }
  })
];

const table = Bodies.rectangle(width / 2, height - 120, 420, 24, {
  isStatic: true,
  label: "table",
  render: { fillStyle: "#8b5e3c" }
});

const tableLegLeft = Bodies.rectangle(width / 2 - 170, height - 45, 24, 140, {
  isStatic: true,
  render: { fillStyle: "#6f4a2d" }
});

const tableLegRight = Bodies.rectangle(width / 2 + 170, height - 45, 24, 140, {
  isStatic: true,
  render: { fillStyle: "#6f4a2d" }
});

World.add(world, [...walls, table, tableLegLeft, tableLegRight]);

function randomCatColor() {
  const colors = ["#f4a261", "#e76f51", "#f6bd60", "#84a59d", "#cdb4db"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createCat(x, y, isStatic = false) {
  const cat = Bodies.rectangle(x, y, 70, 42, {
    isStatic,
    chamfer: { radius: 12 },
    friction: 0.7,
    restitution: 0.05,
    density: 0.0025,
    label: "cat",
    render: {
      fillStyle: randomCatColor()
    }
  });

  return cat;
}

function spawnCat() {
  if (gameOver) return;

  currentCat = createCat(width / 2, 110, true);
  catDropped = false;
  World.add(world, currentCat);
}

function dropCurrentCat() {
  if (!currentCat || catDropped || gameOver) return;

  Body.setStatic(currentCat, false);
  catDropped = true;
  score += 1;
  scoreEl.textContent = score;

  setTimeout(() => {
    if (!gameOver) spawnCat();
  }, 900);
}

function restartGame() {
  const allBodies = Matter.Composite.allBodies(world);
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
  alert("A cat fell! Game over. Press R to restart.");
}

Events.on(engine, "beforeUpdate", () => {
  if (!currentCat || catDropped || gameOver) return;

  let dx = 0;
  const speed = 4;

  if (moveLeft) dx -= speed;
  if (moveRight) dx += speed;

  const nextX = currentCat.position.x + dx;
  const leftLimit = width / 2 - 200;
  const rightLimit = width / 2 + 200;

  if (nextX > leftLimit && nextX < rightLimit) {
    Body.setPosition(currentCat, {
      x: nextX,
      y: currentCat.position.y
    });
  }
});

Events.on(engine, "afterUpdate", () => {
  if (gameOver) return;

  const allBodies = Matter.Composite.allBodies(world);
  for (const body of allBodies) {
    if (body.label === "cat" && !body.isStatic) {
      if (body.position.y > height + 80) {
        endGame();
        break;
      }

      if (body.position.x < width / 2 - 260 || body.position.x > width / 2 + 260) {
        if (body.position.y > height - 180) {
          endGame();
          break;
        }
      }

      if (Math.abs(body.angle) > 1.6 && body.position.y > height - 250) {
        endGame();
        break;
      }
    }
  }
});

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

function drawKitchenDecor() {
  const ctx = render.context;

  Events.on(render, "beforeRender", () => {
    ctx.save();

    // wall
    ctx.fillStyle = "#efe2d0";
    ctx.fillRect(0, 0, width, height * 0.72);

    // floor
    ctx.fillStyle = "#d8c3a5";
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    // window frame
    ctx.fillStyle = "#b08968";
    ctx.fillRect(60, 90, 140, 180);

    // window glass
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(78, 110, 104, 140);

    // fridge body
    ctx.fillStyle = "#adb5bd";
    ctx.fillRect(width - 230, 120, 120, 220);

    // fridge top
    ctx.fillStyle = "#6c757d";
    ctx.fillRect(width - 250, 90, 160, 30);

    ctx.restore();
  });
}

drawKitchenDecor();
spawnCat();