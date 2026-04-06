// ─── Stack Da Catz ───────────────────────────────────────────────────────────
// Physics cat stacking game using Matter.js
// ─────────────────────────────────────────────────────────────────────────────

const { Engine, Render, Runner, Bodies, Body, World, Events, Mouse } = Matter;

// ── Canvas sizing ──────────────────────────────────────────────────────────
const UI_HEIGHT = document.getElementById('ui').getBoundingClientRect().height + 8;
const CANVAS_W = Math.min(600, window.innerWidth);
const CANVAS_H = Math.min(window.innerHeight - UI_HEIGHT - 10, 560);

const canvas = document.getElementById('game');
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

// ── Palette ────────────────────────────────────────────────────────────────
const COLORS = {
  orange:    '#FF7043',
  teal:      '#26A69A',
  purple:    '#9C27B0',
  pink:      '#E91E8C',
  blue:      '#1E88E5',
  lime:      '#7CB342',
  yellow:    '#F9A825',
  red:       '#E53935',
};
const COLOR_LIST = Object.values(COLORS);

// ── Game constants ─────────────────────────────────────────────────────────
const TABLE_Y      = CANVAS_H - 80;
const TABLE_W      = CANVAS_W * 0.65;
const TABLE_H      = 18;
const TABLE_X      = CANVAS_W / 2;
const CAT_W        = 52;
const CAT_H        = 38;
const DROP_Y       = 55;
const MOVE_SPEED   = 4;
const FALL_BOUNDARY= CANVAS_H + 120;
const WALL_THICK   = 40;

// ── State ──────────────────────────────────────────────────────────────────
let engine, world, runner;
let bodies   = [];   // { body, color, settled }
let pending  = null; // the cat being aimed
let score    = 0;
let best     = 0;
let gameOver = false;
let keys     = {};
let pendingX = CANVAS_W / 2;
let pendingDir = 1;

// ── Matter.js setup ────────────────────────────────────────────────────────
function initPhysics() {
  engine = Engine.create({ gravity: { x: 0, y: 2.2 } });
  world  = engine.world;
  runner = Runner.create();

  // Table surface (static)
  const table = Bodies.rectangle(TABLE_X, TABLE_Y + TABLE_H / 2, TABLE_W, TABLE_H, {
    isStatic: true,
    label: 'table',
    friction: 0.9,
    restitution: 0.1,
    render: { fillStyle: '#795548' },
  });

  // Invisible floor (catches falls)
  const floor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H + WALL_THICK / 2, CANVAS_W * 3, WALL_THICK, {
    isStatic: true,
    label: 'floor',
    isSensor: true,
  });

  World.add(world, [table, floor]);
}

// ── Cat drawing ────────────────────────────────────────────────────────────
function drawCat(x, y, w, h, color, angle = 0, wobble = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const bw = w * 0.85;
  const bh = h * 0.72;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, bh * 0.1, bw / 2, bh / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Head
  const hx = -bw * 0.18;
  const hy = -bh * 0.42;
  const hr = bh * 0.38;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = shadeColor(color, -25);
  ctx.beginPath();
  ctx.moveTo(hx - hr * 0.7, hy - hr * 0.6);
  ctx.lineTo(hx - hr * 0.3, hy - hr * 1.25);
  ctx.lineTo(hx + hr * 0.05, hy - hr * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(hx + hr * 0.35, hy - hr * 0.65);
  ctx.lineTo(hx + hr * 0.7, hy - hr * 1.2);
  ctx.lineTo(hx + hr * 1.0, hy - hr * 0.5);
  ctx.closePath();
  ctx.fill();

  // Inner ear
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(hx - hr * 0.58, hy - hr * 0.72);
  ctx.lineTo(hx - hr * 0.32, hy - hr * 1.1);
  ctx.lineTo(hx + hr * 0.0, hy - hr * 0.65);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(hx + hr * 0.45, hy - hr * 0.72);
  ctx.lineTo(hx + hr * 0.68, hy - hr * 1.07);
  ctx.lineTo(hx + hr * 0.88, hy - hr * 0.58);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(hx - hr * 0.38, hy - hr * 0.05, hr * 0.26, hr * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.3, hy - hr * 0.05, hr * 0.26, hr * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(hx - hr * 0.34, hy - hr * 0.05, hr * 0.14, hr * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.34, hy - hr * 0.05, hr * 0.14, hr * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(hx - hr * 0.28, hy - hr * 0.1, hr * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + hr * 0.4, hy - hr * 0.1, hr * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#FF8A80';
  ctx.beginPath();
  ctx.moveTo(hx, hy + hr * 0.22);
  ctx.lineTo(hx - hr * 0.12, hy + hr * 0.12);
  ctx.lineTo(hx + hr * 0.12, hy + hr * 0.12);
  ctx.closePath();
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy + hr * 0.22);
  ctx.quadraticCurveTo(hx - hr * 0.22, hy + hr * 0.42, hx - hr * 0.3, hy + hr * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hx, hy + hr * 0.22);
  ctx.quadraticCurveTo(hx + hr * 0.22, hy + hr * 0.42, hx + hr * 0.3, hy + hr * 0.35);
  ctx.stroke();

  // Whiskers
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i += 2) {
    for (let j = 0; j < 3; j++) {
      const wy = hy + hr * (0.1 + j * 0.12);
      ctx.beginPath();
      ctx.moveTo(hx + i * hr * 0.2, wy);
      ctx.lineTo(hx + i * hr * 1.1, wy + (j - 1) * hr * 0.12);
      ctx.stroke();
    }
  }

  // Tail
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bw * 0.42, bh * 0.05);
  ctx.quadraticCurveTo(
    bw * 0.7 + Math.sin(wobble) * 5,
    bh * -0.35,
    bw * 0.55,
    bh * -0.7
  );
  ctx.stroke();

  // Paws
  ctx.fillStyle = shadeColor(color, -15);
  ctx.beginPath();
  ctx.ellipse(-bw * 0.3, bh * 0.46, bw * 0.14, bh * 0.13, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bw * 0.22, bh * 0.48, bw * 0.14, bh * 0.13, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function shadeColor(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── Table drawing ──────────────────────────────────────────────────────────
function drawTable() {
  const tx = TABLE_X - TABLE_W / 2;
  const ty = TABLE_Y;

  // Table shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur  = 12;
  ctx.shadowOffsetY = 4;

  // Tabletop
  const grad = ctx.createLinearGradient(tx, ty, tx, ty + TABLE_H);
  grad.addColorStop(0, '#A1887F');
  grad.addColorStop(1, '#6D4C41');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(tx, ty, TABLE_W, TABLE_H, 4);
  ctx.fill();

  ctx.restore();

  // Table legs
  const legW = 14;
  const legH = CANVAS_H - TABLE_Y - TABLE_H;
  const legY  = TABLE_Y + TABLE_H;
  const legGrad = ctx.createLinearGradient(0, legY, 0, legY + legH);
  legGrad.addColorStop(0, '#8D6E63');
  legGrad.addColorStop(1, '#5D4037');

  ctx.fillStyle = legGrad;
  // Left leg
  ctx.fillRect(tx + 20, legY, legW, legH);
  // Right leg
  ctx.fillRect(tx + TABLE_W - 20 - legW, legY, legW, legH);
}

// ── Background ─────────────────────────────────────────────────────────────
function drawBackground() {
  // Soft gradient bg
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#E8F5E9');
  grad.addColorStop(0.5, '#FFF8E1');
  grad.addColorStop(1, '#FCE4EC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle floor line
  ctx.strokeStyle = 'rgba(121,85,72,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H - 1);
  ctx.lineTo(CANVAS_W, CANVAS_H - 1);
  ctx.stroke();
}

// ── Spawn pending cat ──────────────────────────────────────────────────────
let wobbleTick = 0;
let colorIndex = 0;

function spawnPending() {
  pendingX = CANVAS_W / 2;
  pendingDir = 1;
  pending = {
    x: pendingX,
    y: DROP_Y,
    color: COLOR_LIST[colorIndex % COLOR_LIST.length],
    wobble: 0,
  };
  colorIndex++;
}

// ── Drop cat (add to physics) ──────────────────────────────────────────────
function dropCat() {
  if (!pending || gameOver) return;

  const cat = Bodies.rectangle(pending.x, pending.y, CAT_W * 0.9, CAT_H * 0.8, {
    restitution: 0.15,
    friction:    0.85,
    frictionAir: 0.02,
    density:     0.004,
    label: 'cat',
  });

  cat._color   = pending.color;
  cat._settled = false;

  World.add(world, cat);
  bodies.push(cat);

  pending = null;

  // Wait a beat then spawn next cat
  setTimeout(() => {
    if (!gameOver) {
      score++;
      document.getElementById('score').textContent = score;
      spawnPending();
    }
  }, 700);
}

// ── Check for fallen cats ──────────────────────────────────────────────────
function checkFallen() {
  for (const cat of bodies) {
    if (cat.position.y > FALL_BOUNDARY) {
      triggerGameOver();
      return;
    }
    // Check if fallen off table edges significantly
    const offLeft  = cat.position.x < TABLE_X - TABLE_W / 2 - CAT_W * 2;
    const offRight = cat.position.x > TABLE_X + TABLE_W / 2 + CAT_W * 2;
    if ((offLeft || offRight) && cat.position.y > TABLE_Y) {
      triggerGameOver();
      return;
    }
  }
}

// ── Game over ──────────────────────────────────────────────────────────────
function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  pending = null;

  if (score > best) {
    best = score;
    document.getElementById('best').textContent = best;
  }

  document.getElementById('final-score').textContent = score;
  document.getElementById('overlay').classList.remove('hidden');
}

// ── Restart ────────────────────────────────────────────────────────────────
function restart() {
  // Clear physics world
  World.clear(world);
  Engine.clear(engine);
  bodies = [];
  score  = 0;
  gameOver = false;
  colorIndex = 0;
  document.getElementById('score').textContent = '0';
  document.getElementById('overlay').classList.add('hidden');

  // Re-add static bodies
  const table = Bodies.rectangle(TABLE_X, TABLE_Y + TABLE_H / 2, TABLE_W, TABLE_H, {
    isStatic: true, label: 'table', friction: 0.9, restitution: 0.1,
  });
  const floor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H + WALL_THICK / 2, CANVAS_W * 3, WALL_THICK, {
    isStatic: true, label: 'floor', isSensor: true,
  });
  World.add(world, [table, floor]);

  spawnPending();
}

// ── Aim indicator ──────────────────────────────────────────────────────────
function drawAimLine(x, y) {
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + CAT_H / 2);
  ctx.lineTo(x, TABLE_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Main game loop ─────────────────────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTime, 50);
  lastTime = timestamp;

  // Update physics
  Engine.update(engine, dt);

  // Move pending cat
  if (pending && !gameOver) {
    wobbleTick += 0.07;
    pending.wobble = wobbleTick;

    // Auto-swing or key control
    if (keys['ArrowLeft'])  pendingX -= MOVE_SPEED;
    if (keys['ArrowRight']) pendingX += MOVE_SPEED;

    // Clamp
    const halfCat = CAT_W / 2;
    pendingX = Math.max(halfCat, Math.min(CANVAS_W - halfCat, pendingX));
    pending.x = pendingX;
  }

  checkFallen();

  // ── Draw ──
  drawBackground();
  drawTable();

  // Draw aim line
  if (pending) {
    drawAimLine(pending.x, pending.y);
  }

  // Draw stacked cats (physics bodies)
  for (const cat of bodies) {
    drawCat(
      cat.position.x,
      cat.position.y,
      CAT_W, CAT_H,
      cat._color || '#FF7043',
      cat.angle,
      0
    );
  }

  // Draw pending (floating) cat
  if (pending && !gameOver) {
    drawCat(pending.x, pending.y, CAT_W, CAT_H, pending.color, 0, pending.wobble);
  }

  requestAnimationFrame(gameLoop);
}

// ── Input ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.code] = true;

  if (e.code === 'Space') {
    e.preventDefault();
    dropCat();
  }
  if (e.code === 'KeyR') {
    restart();
  }
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
});

// Touch / click to drop
canvas.addEventListener('click', e => {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  pendingX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  dropCat();
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  pendingX = (touch.clientX - rect.left) * (CANVAS_W / rect.width);
  dropCat();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!pending || gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  pendingX = (touch.clientX - rect.left) * (CANVAS_W / rect.width);
}, { passive: false });

document.getElementById('restart-btn').addEventListener('click', restart);

// ── Boot ───────────────────────────────────────────────────────────────────
initPhysics();
spawnPending();
requestAnimationFrame(gameLoop);