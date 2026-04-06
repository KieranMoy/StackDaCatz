// ─── Stack Da Catz ───────────────────────────────────────────────────────────

const { Engine, Bodies, Body, World } = Matter;

// ── Canvas ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');

const UI_HEIGHT = document.getElementById('ui').offsetHeight + 8;
const CANVAS_W  = Math.min(600, window.innerWidth);
const CANVAS_H  = Math.min(window.innerHeight - UI_HEIGHT - 10, 560);
canvas.width    = CANVAS_W;
canvas.height   = CANVAS_H;

// ── Colours ────────────────────────────────────────────────────────────────
const COLOR_LIST = [
  '#FF7043','#26A69A','#9C27B0','#E91E8C',
  '#1E88E5','#7CB342','#F9A825','#E53935',
];

// ── Layout ──────────────────────────────────────────────────────────────────
// TABLE_Y = Y pixel of the TOP SURFACE of the drawn table
const TABLE_Y = CANVAS_H - 100;
const TABLE_W = CANVAS_W * 0.65;
const TABLE_H = 18;
const TABLE_X = CANVAS_W / 2;
const CAT_W   = 52;
const CAT_H   = 38;
const DROP_Y  = 60;

// Physics slab is much thicker than the visual table so cats can't tunnel through
const PHYS_SLAB_H = 60;
// The top of the slab must sit exactly at TABLE_Y, so its centre is:
const SLAB_CY     = TABLE_Y + PHYS_SLAB_H / 2;

// ── State ──────────────────────────────────────────────────────────────────
let engine, world;
let catBodies  = [];
let pending    = null;
let pendingX   = CANVAS_W / 2;
let score      = 0;
let best       = 0;
let gameOver   = false;
let keys       = {};
let colorIdx   = 0;
let wobbleTick = 0;

// ── Physics setup ───────────────────────────────────────────────────────────
function makeStaticBodies() {
  // Table: thick physics slab whose top edge aligns with TABLE_Y
  const table = Bodies.rectangle(TABLE_X, SLAB_CY, TABLE_W, PHYS_SLAB_H, {
    isStatic: true, label: 'table', friction: 0.9, restitution: 0.05,
  });

  // Floor: solid, inside the canvas at the bottom
  const floor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H - 10, CANVAS_W * 4, 40, {
    isStatic: true, label: 'floor',
  });

  // Side walls
  const wallL = Bodies.rectangle(-25, CANVAS_H / 2, 50, CANVAS_H * 3, { isStatic: true });
  const wallR = Bodies.rectangle(CANVAS_W + 25, CANVAS_H / 2, 50, CANVAS_H * 3, { isStatic: true });

  return [table, floor, wallL, wallR];
}

function initPhysics() {
  engine = Engine.create({ gravity: { x: 0, y: 2.5 } });
  world  = engine.world;
  World.add(world, makeStaticBodies());
}

// ── Spawn / drop ─────────────────────────────────────────────────────────────
function spawnPending() {
  pendingX = CANVAS_W / 2;
  pending  = {
    x:      pendingX,
    y:      DROP_Y,
    color:  COLOR_LIST[colorIdx % COLOR_LIST.length],
    wobble: 0,
  };
  colorIdx++;
}

function dropCat() {
  if (!pending || gameOver) return;

  const cat = Bodies.rectangle(pending.x, pending.y, CAT_W * 0.88, CAT_H * 0.75, {
    restitution: 0.1,
    friction:    0.9,
    frictionAir: 0.015,
    density:     0.005,
    label:       'cat',
  });
  cat._color = pending.color;

  World.add(world, cat);
  catBodies.push(cat);
  pending = null;

  setTimeout(() => {
    if (!gameOver) {
      score++;
      document.getElementById('score').textContent = score;
      spawnPending();
    }
  }, 650);
}

// ── Game over / restart ──────────────────────────────────────────────────────
function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  pending  = null;
  if (score > best) { best = score; document.getElementById('best').textContent = best; }
  document.getElementById('final-score').textContent = score;
  document.getElementById('overlay').classList.remove('hidden');
}

function restart() {
  World.clear(world);
  Engine.clear(engine);
  catBodies  = [];
  score      = 0;
  gameOver   = false;
  colorIdx   = 0;
  wobbleTick = 0;
  document.getElementById('score').textContent = '0';
  document.getElementById('overlay').classList.add('hidden');
  World.add(world, makeStaticBodies());
  spawnPending();
}

// ── Fall detection ───────────────────────────────────────────────────────────
function checkFallen() {
  for (const cat of catBodies) {
    if (cat.position.y > CANVAS_H + 80) { triggerGameOver(); return; }
    const offLeft  = cat.position.x < TABLE_X - TABLE_W / 2 - CAT_W;
    const offRight = cat.position.x > TABLE_X + TABLE_W / 2 + CAT_W;
    if ((offLeft || offRight) && cat.position.y > TABLE_Y + 30) { triggerGameOver(); return; }
  }
}

// ── Drawing ──────────────────────────────────────────────────────────────────
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0,   '#E8F5E9');
  g.addColorStop(0.5, '#FFF8E1');
  g.addColorStop(1,   '#FCE4EC');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawTable() {
  const tx = TABLE_X - TABLE_W / 2;

  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur    = 10;
  ctx.shadowOffsetY = 4;

  const g = ctx.createLinearGradient(tx, TABLE_Y, tx, TABLE_Y + TABLE_H);
  g.addColorStop(0, '#A1887F');
  g.addColorStop(1, '#6D4C41');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(tx, TABLE_Y, TABLE_W, TABLE_H, 4);
  ctx.fill();
  ctx.restore();

  // Legs
  const legW = 14, legY = TABLE_Y + TABLE_H, legH = CANVAS_H - legY;
  const lg = ctx.createLinearGradient(0, legY, 0, legY + legH);
  lg.addColorStop(0, '#8D6E63');
  lg.addColorStop(1, '#5D4037');
  ctx.fillStyle = lg;
  ctx.fillRect(tx + 20,                  legY, legW, legH);
  ctx.fillRect(tx + TABLE_W - 20 - legW, legY, legW, legH);
}

function drawAimLine(x, y) {
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + CAT_H * 0.5);
  ctx.lineTo(x, TABLE_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function shade(hex, amt) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1,3),16)+amt));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3,5),16)+amt));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5,7),16)+amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function drawCat(x, y, color, angle, wobble) {
  const w = CAT_W, h = CAT_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const bw = w*0.85, bh = h*0.72;
  const hx = -bw*0.18, hy = -bh*0.42, hr = bh*0.38;

  // Body
  ctx.beginPath(); ctx.ellipse(0, bh*0.1, bw/2, bh/2, 0, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();

  // Head
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();

  // Ears
  ctx.fillStyle = shade(color, -25);
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.7,hy-hr*0.6, hx-hr*0.3,hy-hr*1.25, hx+hr*0.05,hy-hr*0.55],
    [hx+hr*0.35,hy-hr*0.65, hx+hr*0.7,hy-hr*1.2, hx+hr*1.0,hy-hr*0.5],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }

  // Inner ears
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.58,hy-hr*0.72, hx-hr*0.32,hy-hr*1.1, hx,hy-hr*0.65],
    [hx+hr*0.45,hy-hr*0.72, hx+hr*0.68,hy-hr*1.07, hx+hr*0.88,hy-hr*0.58],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }

  // Eyes
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.38, hy-hr*0.05, hr*0.26, hr*0.22, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.30, hy-hr*0.05, hr*0.26, hr*0.22, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.34, hy-hr*0.05, hr*0.14, hr*0.18, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.34, hy-hr*0.05, hr*0.14, hr*0.18, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(hx-hr*0.28, hy-hr*0.1, hr*0.06, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx+hr*0.40, hy-hr*0.1, hr*0.06, 0, Math.PI*2); ctx.fill();

  // Nose
  ctx.fillStyle = '#FF8A80';
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.lineTo(hx-hr*0.12,hy+hr*0.12); ctx.lineTo(hx+hr*0.12,hy+hr*0.12); ctx.closePath(); ctx.fill();

  // Mouth
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.quadraticCurveTo(hx-hr*0.22,hy+hr*0.42,hx-hr*0.3,hy+hr*0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.quadraticCurveTo(hx+hr*0.22,hy+hr*0.42,hx+hr*0.3,hy+hr*0.35); ctx.stroke();

  // Whiskers
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
  for (const si of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const wy = hy + hr*(0.1 + j*0.12);
      ctx.beginPath(); ctx.moveTo(hx+si*hr*0.2, wy); ctx.lineTo(hx+si*hr*1.1, wy+(j-1)*hr*0.12); ctx.stroke();
    }
  }

  // Tail
  ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.42, bh*0.05);
  ctx.quadraticCurveTo(bw*0.7+Math.sin(wobble)*5, bh*-0.35, bw*0.55, bh*-0.7); ctx.stroke();

  // Paws
  ctx.fillStyle = shade(color, -15);
  ctx.beginPath(); ctx.ellipse(-bw*0.3, bh*0.46, bw*0.14, bh*0.13, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( bw*0.22, bh*0.48, bw*0.14, bh*0.13,  0.3, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

// ── Game loop ─────────────────────────────────────────────────────────────────
const MOVE_SPEED = 4;
let lastTime = 0;

function gameLoop(ts) {
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  Engine.update(engine, dt);

  if (pending && !gameOver) {
    wobbleTick += 0.07;
    pending.wobble = wobbleTick;
    if (keys['ArrowLeft'])  pendingX -= MOVE_SPEED;
    if (keys['ArrowRight']) pendingX += MOVE_SPEED;
    pendingX  = Math.max(CAT_W/2, Math.min(CANVAS_W - CAT_W/2, pendingX));
    pending.x = pendingX;
  }

  checkFallen();

  drawBackground();
  drawTable();
  if (pending) drawAimLine(pending.x, pending.y);
  for (const cat of catBodies) drawCat(cat.position.x, cat.position.y, cat._color, cat.angle, 0);
  if (pending && !gameOver) drawCat(pending.x, pending.y, pending.color, 0, pending.wobble);

  requestAnimationFrame(gameLoop);
}

// ── Input ─────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); dropCat(); }
  if (e.code === 'KeyR')  restart();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('click', e => {
  if (gameOver) return;
  const r = canvas.getBoundingClientRect();
  pendingX = (e.clientX - r.left) * (CANVAS_W / r.width);
  dropCat();
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameOver) return;
  const r = canvas.getBoundingClientRect();
  pendingX = (e.touches[0].clientX - r.left) * (CANVAS_W / r.width);
  dropCat();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!pending || gameOver) return;
  const r = canvas.getBoundingClientRect();
  pendingX = (e.touches[0].clientX - r.left) * (CANVAS_W / r.width);
}, { passive: false });

document.getElementById('restart-btn').addEventListener('click', restart);

// ── Boot ──────────────────────────────────────────────────────────────────────
initPhysics();
spawnPending();
requestAnimationFrame(gameLoop);