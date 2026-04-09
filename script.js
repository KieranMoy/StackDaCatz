// ─── Stack Da Catz ───────────────────────────────────────────────────────────

const { Engine, Bodies, Body, World, Events } = Matter;

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

// ── Layout constants (fixed) ─────────────────────────────────────────────────
const TABLE_Y       = CANVAS_H - 100;
const TABLE_H       = 18;
const TABLE_X       = CANVAS_W / 2;
const DROP_Y        = 60;
const PHYS_SLAB_H   = 60;
const SLAB_CY       = TABLE_Y + PHYS_SLAB_H / 2;
const BASE_TABLE_W  = CANVAS_W * 0.495; // starting width (10% wider than original)
const MIN_TABLE_W   = CANVAS_W * 0.18;  // never shrink below this
const CATS_PER_LEVEL = 20;

// ── Level state (mutable — changes each level) ────────────────────────────────
let tableW     = BASE_TABLE_W;
let tableLeft  = TABLE_X - tableW / 2;
let tableRight = TABLE_X + tableW / 2;
let level      = 1;
let catsThisLevel = 0;   // how many cats placed in the current level

// ── Cat shape definitions ─────────────────────────────────────────────────────
const CAT_SHAPES = [
  { id: 'normal',  physW: 52, physH: 34 },
  { id: 'loaf',    physW: 66, physH: 28 },
  { id: 'sitting', physW: 36, physH: 58 },
  { id: 'curled',  physW: 44, physH: 44 },
  { id: 'stretch', physW: 78, physH: 24 },
];

// ── Auto-drop timer ────────────────────────────────────────────────────────────
const AUTO_DROP_BASE_MS  = 4000; // level-1 delay (ms)
const AUTO_DROP_STEP_MS  =  500; // gets this much faster each level
const AUTO_DROP_MIN_MS   =  500; // never faster than this
let autoDropTimer    = null;  // setTimeout handle
let autoDropStarted  = null;  // performance.now() when countdown began
let autoDropDelay    = AUTO_DROP_BASE_MS; // actual delay used for current cat
let levelStarted     = false; // false until the first spacebar drop of a level

// Returns the auto-drop delay for the current level
function dropDelayMs() {
  return Math.max(AUTO_DROP_MIN_MS, AUTO_DROP_BASE_MS - (level - 1) * AUTO_DROP_STEP_MS);
}

// ── State ──────────────────────────────────────────────────────────────────
let engine, world;
let catBodies     = [];
let pending       = null;
let pendingX      = CANVAS_W / 2;
let score         = 0;
let best          = 0;
let gameOver      = false;
let levelClearing = false;   // true during the clear animation — blocks input
let keys          = {};
let colorIdx      = 0;
let wobbleTick    = 0;

// ── Physics setup ─────────────────────────────────────────────────────────────
function makeStaticBodies() {
  const table = Bodies.rectangle(TABLE_X, SLAB_CY, tableW, PHYS_SLAB_H, {
    isStatic: true, label: 'table',
    friction: 100, frictionStatic: 100, restitution: 0.0, slop: 0.05,
  });
  const floor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H - 10, CANVAS_W * 4, 40, {
    isStatic: true, label: 'floor',
    friction: 100, frictionStatic: 100, restitution: 0.0,
  });
  const wallL = Bodies.rectangle(-25, CANVAS_H / 2, 50, CANVAS_H * 3, { isStatic: true });
  const wallR = Bodies.rectangle(CANVAS_W + 25, CANVAS_H / 2, 50, CANVAS_H * 3, { isStatic: true });
  return [table, floor, wallL, wallR];
}

function registerCollisionEvents() {
  Events.on(engine, 'collisionStart', e => {
    for (const pair of e.pairs) {
      const { bodyA, bodyB } = pair;
      const catHitsTable = (bodyA.label === 'cat' && bodyB.label === 'table')
                        || (bodyB.label === 'cat' && bodyA.label === 'table');
      if (catHitsTable) {
        const cat = bodyA.label === 'cat' ? bodyA : bodyB;
        if (!cat.isStatic) {
          const x = cat.position.x, y = cat.position.y, angle = cat.angle;
          Body.setStatic(cat, true);
          Body.setPosition(cat, { x, y });
          Body.setAngle(cat, angle);
          cat._frozen = true;
        }
      }
    }
  });
}

function initPhysics() {
  engine = Engine.create({
    gravity:              { x: 0, y: 2.5 },
    positionIterations:   30,
    velocityIterations:   20,
    constraintIterations: 6,
  });
  world = engine.world;
  World.add(world, makeStaticBodies());
  registerCollisionEvents();
}

// ── Spawn / drop ──────────────────────────────────────────────────────────────
function randomShape() {
  return CAT_SHAPES[Math.floor(Math.random() * CAT_SHAPES.length)];
}

function spawnPending() {
  const margin = CANVAS_W * 0.15;
  pendingX = margin + Math.random() * (CANVAS_W - margin * 2);
  const shape = randomShape();
  pending = {
    x: pendingX, y: DROP_Y,
    color: COLOR_LIST[colorIdx % COLOR_LIST.length],
    shape, wobble: 0,
  };
  colorIdx++;

  // After the first cat of a level, subsequent cats auto-drop after dropDelayMs()
  if (levelStarted) {
    autoDropDelay   = dropDelayMs();
    autoDropStarted = performance.now();
    autoDropTimer   = setTimeout(() => {
      autoDropTimer   = null;
      autoDropStarted = null;
      dropCat();
    }, autoDropDelay);
  }
}

function dropCat() {
  if (!pending || gameOver || levelClearing) return;

  // Cancel any running auto-drop countdown
  if (autoDropTimer) { clearTimeout(autoDropTimer); autoDropTimer = null; }
  autoDropStarted = null;

  // The first cat of every level/game must be started by the player
  if (!levelStarted) levelStarted = true;

  const { shape } = pending;
  const cat = Bodies.rectangle(pending.x, pending.y, shape.physW, shape.physH, {
    restitution: 0.0, friction: 1.5, frictionAir: 0.05,
    frictionStatic: 2.0, slop: 0.05, density: 0.005, label: 'cat',
  });
  cat._color = pending.color;
  cat._shape = shape.id;
  cat._physW = shape.physW;

  World.add(world, cat);
  catBodies.push(cat);
  pending = null;

  setTimeout(() => {
    if (gameOver || levelClearing) return;
    score++;
    catsThisLevel++;
    document.getElementById('score').textContent = score;

    if (catsThisLevel >= CATS_PER_LEVEL) {
      triggerLevelClear();
    } else {
      spawnPending();
    }
  }, 650);
}

// ── Level clear sequence ──────────────────────────────────────────────────────
// The animation has three phases driven by setTimeout:
//   1. Flash "Level Complete!" banner for 1.2s while cats are still visible
//   2. Sweep cats off the table (animate them flying away) over 0.8s
//   3. Show the new (smaller) table and resume play

// Snapshot of cats for the sweep animation — stored as plain objects so we
// can animate them independently after the physics world is cleared.
let sweepCats   = [];   // [{ x, y, angle, color, shape, vx, vy }]
let sweepStart  = null; // timestamp when sweep animation began
const SWEEP_MS  = 800;

let bannerText    = '';
let bannerOpacity = 0;
let bannerStart   = null;
const BANNER_MS   = 1200;

function triggerLevelClear() {
  console.log(`triggerLevelClear fired! level=${level}, catsThisLevel=${catsThisLevel}`);
  levelClearing = true;
  pending = null;

  // Cancel any auto-drop and reset the level-started gate
  if (autoDropTimer) { clearTimeout(autoDropTimer); autoDropTimer = null; }
  autoDropStarted = null;
  levelStarted    = false;

  bannerText    = `Level ${level} Clear! 🎉`;
  bannerStart   = performance.now();
  bannerOpacity = 1;

  // After banner has shown, sweep the cats away
  setTimeout(() => {
    // Snapshot all cat positions for the sweep animation
    sweepCats = catBodies.map(cat => ({
      x: cat.position.x, y: cat.position.y,
      angle: cat.angle,
      color: cat._color, shape: cat._shape,
      // random outward velocity for the sweep
      vx: (Math.random() - 0.5) * 18,
      vy: -(Math.random() * 10 + 6),
    }));

    // Clear the physics world of cat bodies
    for (const cat of catBodies) World.remove(world, cat);
    catBodies = [];

    sweepStart = performance.now();

    // After sweep finishes, set up next level
    setTimeout(() => {
      sweepCats = [];

      // Shrink the table
      level++;
      catsThisLevel = 0;
      tableW     = Math.max(MIN_TABLE_W, tableW * 0.80);
      tableLeft  = TABLE_X - tableW / 2;
      tableRight = TABLE_X + tableW / 2;
      document.getElementById('level-display').textContent = level;

      // Rebuild physics world with new table size
      World.clear(world);
      Engine.clear(engine);
      World.add(world, makeStaticBodies());
      registerCollisionEvents();

      bannerText    = `Level ${level}`;
      bannerStart   = performance.now();
      bannerOpacity = 1;

      setTimeout(() => {
        levelClearing = false;
        bannerText    = '';
        spawnPending();
      }, 900);

    }, SWEEP_MS + 100);
  }, BANNER_MS);
}

// ── Game over / restart ───────────────────────────────────────────────────────
function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  pending  = null;
  if (score > best) { best = score; document.getElementById('best').textContent = best; }
  document.getElementById('final-score').textContent = score;
  document.getElementById('overlay').classList.remove('hidden');
}

function restart() {
  if (autoDropTimer) { clearTimeout(autoDropTimer); autoDropTimer = null; }
  autoDropStarted = null;
  autoDropDelay   = AUTO_DROP_BASE_MS;
  levelStarted    = false;

  World.clear(world);
  Engine.clear(engine);
  catBodies     = [];
  sweepCats     = [];
  score         = 0;
  gameOver      = false;
  levelClearing = false;
  colorIdx      = 0;
  wobbleTick    = 0;
  level         = 1;
  catsThisLevel = 0;
  tableW        = BASE_TABLE_W;
  tableLeft     = TABLE_X - tableW / 2;
  tableRight    = TABLE_X + tableW / 2;
  bannerText    = '';
  sweepStart    = null;
  document.getElementById('score').textContent = '0';
  document.getElementById('level-display').textContent = '1';
  document.getElementById('overlay').classList.add('hidden');
  World.add(world, makeStaticBodies());
  registerCollisionEvents();
  spawnPending();
}

// ── Settle & freeze ───────────────────────────────────────────────────────────
const SETTLE_MS = 2000;

function checkSettle(now) {
  const frozenIds = new Set(catBodies.filter(c => c.isStatic).map(c => c.id));
  for (const cat of catBodies) {
    if (cat.isStatic) continue;
    const pairs = engine.pairs.list || [];
    let touchingStable = false;
    for (const pair of pairs) {
      if (!pair.isActive) continue;
      const { bodyA, bodyB } = pair;
      if (bodyA !== cat && bodyB !== cat) continue;
      const other = bodyA === cat ? bodyB : bodyA;
      if (other.label === 'table' || other.label === 'floor' || frozenIds.has(other.id)) {
        touchingStable = true; break;
      }
    }
    if (touchingStable) {
      if (!cat._contactSince) cat._contactSince = now;
      if (now - cat._contactSince >= SETTLE_MS) {
        const { x, y } = cat.position;
        const angle = cat.angle;
        Body.setStatic(cat, true);
        Body.setPosition(cat, { x, y });
        Body.setAngle(cat, angle);
        cat._frozen = true;
      }
    } else {
      cat._contactSince = null;
    }
  }
}

// ── Fall detection ────────────────────────────────────────────────────────────
function checkFallen() {
  if (levelClearing) return;
  for (const cat of catBodies) {
    if (cat.position.y > CANVAS_H + 60) { triggerGameOver(); return; }
    if (cat.position.y < TABLE_Y - 10) continue;
    const halfW   = (cat._physW || 30) / 2;
    const offLeft  = cat.position.x + halfW < tableLeft;
    const offRight = cat.position.x - halfW > tableRight;
    if (offLeft || offRight) { triggerGameOver(); return; }
  }
}

// ── Colour utility ────────────────────────────────────────────────────────────
function shade(hex, amt) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1,3),16)+amt));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3,5),16)+amt));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5,7),16)+amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── Cat drawing ───────────────────────────────────────────────────────────────
function drawCatNormal(x, y, color, angle, wobble) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 44, bh = 27;
  const hx = -bw*0.38, hy = -bh*0.3, hr = bh*0.58;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, bw/2, bh/2, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = shade(color,-25);
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.7,hy-hr*0.6, hx-hr*0.28,hy-hr*1.25, hx+hr*0.05,hy-hr*0.55],
    [hx+hr*0.3,hy-hr*0.65, hx+hr*0.7,hy-hr*1.2, hx+hr*0.95,hy-hr*0.5],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.55,hy-hr*0.7, hx-hr*0.3,hy-hr*1.08, hx,hy-hr*0.62],
    [hx+hr*0.42,hy-hr*0.7, hx+hr*0.65,hy-hr*1.06, hx+hr*0.84,hy-hr*0.56],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  drawFace(hx, hy, hr, color);
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.4, 2);
  ctx.quadraticCurveTo(bw*0.65+Math.sin(wobble)*4, -bh*0.8, bw*0.5, -bh*1.2); ctx.stroke();
  ctx.fillStyle = shade(color,-15);
  ctx.beginPath(); ctx.ellipse(-bw*0.25, bh*0.42, bw*0.13, bh*0.18, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( bw*0.18, bh*0.44, bw*0.13, bh*0.18,  0.3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawCatLoaf(x, y, color, angle, wobble) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 58, bh = 22;
  const hx = -bw*0.28, hy = -bh*0.75, hr = bh*0.72;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-bw/2, -bh/2, bw, bh, bh*0.45); ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = shade(color,-25);
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.65,hy-hr*0.55, hx-hr*0.2,hy-hr*1.15, hx+hr*0.1,hy-hr*0.5],
    [hx+hr*0.25,hy-hr*0.6, hx+hr*0.65,hy-hr*1.1, hx+hr*0.9,hy-hr*0.48],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.52,hy-hr*0.65, hx-hr*0.22,hy-hr*1.02, hx+hr*0.04,hy-hr*0.58],
    [hx+hr*0.34,hy-hr*0.66, hx+hr*0.6,hy-hr*1.0, hx+hr*0.8,hy-hr*0.54],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  drawFace(hx, hy, hr, color);
  ctx.fillStyle = shade(color,-12);
  ctx.beginPath(); ctx.ellipse(-bw*0.18, bh*0.38, bw*0.11, bh*0.22, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( bw*0.12, bh*0.38, bw*0.11, bh*0.22, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.46, 0);
  ctx.quadraticCurveTo(bw*0.58+Math.sin(wobble)*3, -bh*0.6, bw*0.44, -bh*1.0); ctx.stroke();
  ctx.restore();
}

function drawCatSitting(x, y, color, angle, wobble) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 26, bh = 46;
  const hx = 0, hy = -bh*0.42, hr = bw*0.68;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, bh*0.08, bw/2, bh*0.45, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = shade(color,-25);
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.7,hy-hr*0.5, hx-hr*0.25,hy-hr*1.35, hx+hr*0.1,hy-hr*0.45],
    [hx+hr*0.25,hy-hr*0.55, hx+hr*0.7,hy-hr*1.3, hx+hr*0.95,hy-hr*0.42],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.58,hy-hr*0.6, hx-hr*0.28,hy-hr*1.18, hx+hr*0.05,hy-hr*0.52],
    [hx+hr*0.33,hy-hr*0.62, hx+hr*0.65,hy-hr*1.15, hx+hr*0.84,hy-hr*0.5],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  drawFace(hx, hy, hr, color);
  ctx.fillStyle = shade(color,-15);
  ctx.beginPath(); ctx.ellipse(-bw*0.3, bh*0.44, bw*0.22, bh*0.1, 0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( bw*0.3, bh*0.44, bw*0.22, bh*0.1, -0.2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.28, bh*0.3);
  ctx.quadraticCurveTo(bw*0.9+Math.sin(wobble)*4, bh*0.1, bw*0.55, bh*0.48); ctx.stroke();
  ctx.restore();
}

function drawCatCurled(x, y, color, angle, wobble) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const r = 20;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r*0.55, r*0.35, r*0.62, r*0.42, 0.8, 0, Math.PI*2); ctx.fill();
  const hx = r*0.52, hy = -r*0.52, hr = r*0.55;
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = shade(color,-25);
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.6,hy-hr*0.5, hx-hr*0.15,hy-hr*1.05, hx+hr*0.15,hy-hr*0.42],
    [hx+hr*0.2,hy-hr*0.55, hx+hr*0.6,hy-hr*1.0, hx+hr*0.82,hy-hr*0.4],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.48,hy-hr*0.58, hx-hr*0.18,hy-hr*0.93, hx+hr*0.08,hy-hr*0.5],
    [hx+hr*0.28,hy-hr*0.62, hx+hr*0.55,hy-hr*0.9, hx+hr*0.73,hy-hr*0.47],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  drawFaceSleepy(hx, hy, hr, color);
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r*0.5, r*0.2);
  ctx.quadraticCurveTo(-r*1.1+Math.sin(wobble)*3, r*0.8, r*0.1, r*1.0); ctx.stroke();
  ctx.restore();
}

function drawCatStretch(x, y, color, angle, wobble) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 68, bh = 18;
  const hx = -bw*0.44, hy = -bh*0.6, hr = bh*0.82;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(bw*0.05, 0, bw/2, bh/2, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = shade(color,-25);
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.5,hy-hr*0.5, hx-hr*0.05,hy-hr*1.15, hx+hr*0.28,hy-hr*0.42],
    [hx+hr*0.3,hy-hr*0.55, hx+hr*0.72,hy-hr*1.1, hx+hr*0.95,hy-hr*0.4],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.4,hy-hr*0.58, hx-hr*0.07,hy-hr*1.02, hx+hr*0.22,hy-hr*0.5],
    [hx+hr*0.38,hy-hr*0.62, hx+hr*0.68,hy-hr*0.98, hx+hr*0.85,hy-hr*0.47],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }
  drawFace(hx, hy, hr, color);
  ctx.fillStyle = shade(color,-15);
  ctx.beginPath(); ctx.ellipse(hx+hr*0.4, bh*0.35, bw*0.1, bh*0.3, -0.4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.9, bh*0.38, bw*0.1, bh*0.3, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(bw*0.36, bh*0.35, bw*0.09, bh*0.3, 0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(bw*0.46, bh*0.32, bw*0.09, bh*0.3, 0.4, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.46, -2);
  ctx.quadraticCurveTo(bw*0.6+Math.sin(wobble)*4, -bh*1.4, bw*0.42, -bh*2.0); ctx.stroke();
  ctx.restore();
}

function drawFace(hx, hy, hr, color) {
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.38, hy-hr*0.05, hr*0.26, hr*0.22, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.30, hy-hr*0.05, hr*0.26, hr*0.22, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.34, hy-hr*0.05, hr*0.14, hr*0.18, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.34, hy-hr*0.05, hr*0.14, hr*0.18, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(hx-hr*0.28, hy-hr*0.1, hr*0.06, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx+hr*0.40, hy-hr*0.1, hr*0.06, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#FF8A80';
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.lineTo(hx-hr*0.12,hy+hr*0.12); ctx.lineTo(hx+hr*0.12,hy+hr*0.12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.quadraticCurveTo(hx-hr*0.22,hy+hr*0.42,hx-hr*0.3,hy+hr*0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.quadraticCurveTo(hx+hr*0.22,hy+hr*0.42,hx+hr*0.3,hy+hr*0.35); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
  for (const si of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const wy = hy + hr*(0.1 + j*0.12);
      ctx.beginPath(); ctx.moveTo(hx+si*hr*0.2, wy); ctx.lineTo(hx+si*hr*1.1, wy+(j-1)*hr*0.12); ctx.stroke();
    }
  }
}

function drawFaceSleepy(hx, hy, hr, color) {
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.36, hy-hr*0.05, hr*0.26, hr*0.14, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.28, hy-hr*0.05, hr*0.26, hr*0.14, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.34, hy-hr*0.05, hr*0.13, hr*0.1, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.32, hy-hr*0.05, hr*0.13, hr*0.1, 0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx-hr*0.62, hy-hr*0.05); ctx.quadraticCurveTo(hx-hr*0.35,hy-hr*0.2,hx-hr*0.1,hy-hr*0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx+hr*0.04, hy-hr*0.05); ctx.quadraticCurveTo(hx+hr*0.3,hy-hr*0.2,hx+hr*0.55,hy-hr*0.05); ctx.stroke();
  ctx.fillStyle = '#FF8A80';
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.lineTo(hx-hr*0.12,hy+hr*0.12); ctx.lineTo(hx+hr*0.12,hy+hr*0.12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx-hr*0.18, hy+hr*0.32); ctx.lineTo(hx+hr*0.18, hy+hr*0.32); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
  for (const si of [-1, 1]) {
    for (let j = 0; j < 2; j++) {
      const wy = hy + hr*(0.14 + j*0.14);
      ctx.beginPath(); ctx.moveTo(hx+si*hr*0.2, wy); ctx.lineTo(hx+si*hr*1.05, wy+(j-0.5)*hr*0.1); ctx.stroke();
    }
  }
}

function drawCat(x, y, color, shape, angle, wobble) {
  switch (shape) {
    case 'loaf':    drawCatLoaf(x, y, color, angle, wobble);    break;
    case 'sitting': drawCatSitting(x, y, color, angle, wobble); break;
    case 'curled':  drawCatCurled(x, y, color, angle, wobble);  break;
    case 'stretch': drawCatStretch(x, y, color, angle, wobble); break;
    default:        drawCatNormal(x, y, color, angle, wobble);  break;
  }
}

// ── Scene drawing ─────────────────────────────────────────────────────────────
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0,    '#E8F5E9');
  g.addColorStop(0.45, '#FFF8E1');
  g.addColorStop(0.72, '#FFE0CC');
  g.addColorStop(1,    '#FF9966');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// ── Lava drawing ──────────────────────────────────────────────────────────────
// Persistent bubble state so they animate smoothly across frames
const LAVA_BUBBLES = Array.from({ length: 9 }, (_, i) => ({
  ox:    (i + 0.5) / 9 + (Math.random() - 0.5) * 0.06,
  speed: 0.28 + Math.random() * 0.32,
  size:  3 + Math.random() * 4,
  phase: Math.random(),   // starting phase offset (0-1)
  drift: (Math.random() - 0.5) * 28,
}));

const LAVA_HOT_SPOTS = [
  { ox: 0.12, freq: 0.55 },
  { ox: 0.38, freq: 0.82 },
  { ox: 0.61, freq: 0.48 },
  { ox: 0.84, freq: 0.70 },
];

function drawLava(now) {
  const t = now / 1000;
  const LAVA_TOP = TABLE_Y + TABLE_H;  // lava surface sits just below table

  // ── Surface wave points ──────────────────────────────────────────────────
  const NUM_PTS = 48;
  const wave = [];
  for (let i = 0; i <= NUM_PTS; i++) {
    const x = (i / NUM_PTS) * CANVAS_W;
    const y = LAVA_TOP
      + Math.sin(x * 0.038 + t * 1.7)  * 4.5
      + Math.sin(x * 0.071 - t * 2.4)  * 2.5
      + Math.sin(x * 0.019 + t * 0.85) * 3.0;
    wave.push({ x, y });
  }

  ctx.save();

  // ── Main lava body ───────────────────────────────────────────────────────
  const bodyGrad = ctx.createLinearGradient(0, LAVA_TOP, 0, CANVAS_H);
  bodyGrad.addColorStop(0,    '#FF5500');
  bodyGrad.addColorStop(0.15, '#CC2200');
  bodyGrad.addColorStop(0.45, '#991100');
  bodyGrad.addColorStop(1,    '#550000');
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  for (const p of wave) ctx.lineTo(p.x, p.y);
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // ── Dark cooling crust patches ───────────────────────────────────────────
  const crustSeeds = [
    { ox: 0.18, oy: 0.25, rx: 0.13, ry: 0.06, rot: -0.3 },
    { ox: 0.55, oy: 0.40, rx: 0.10, ry: 0.05, rot:  0.5 },
    { ox: 0.78, oy: 0.20, rx: 0.09, ry: 0.04, rot: -0.2 },
    { ox: 0.38, oy: 0.60, rx: 0.12, ry: 0.04, rot:  0.1 },
  ];
  const lavaH = CANVAS_H - LAVA_TOP;
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#330000';
  for (const c of crustSeeds) {
    const cx = c.ox * CANVAS_W + Math.sin(t * 0.18 + c.ox * 5) * 10;
    const cy = LAVA_TOP + c.oy * lavaH + Math.sin(t * 0.12 + c.oy * 4) * 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(c.rot + Math.sin(t * 0.1) * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, c.rx * CANVAS_W, c.ry * lavaH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ── Hot glowing spots ────────────────────────────────────────────────────
  for (const s of LAVA_HOT_SPOTS) {
    const bx = s.ox * CANVAS_W + Math.sin(t * s.freq + s.ox * 8) * 22;
    const by = LAVA_TOP + 20 + Math.sin(t * s.freq * 1.3 + s.ox * 6) * 12;
    const pulse = 0.6 + 0.4 * Math.sin(t * s.freq * 2.1);
    const br = (28 + 16 * pulse);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0,   `rgba(255,220,60,${0.80 * pulse})`);
    g.addColorStop(0.35,`rgba(255,100, 0,${0.50 * pulse})`);
    g.addColorStop(1,   'rgba(180,  0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }

  // ── Rising bubbles ───────────────────────────────────────────────────────
  for (const b of LAVA_BUBBLES) {
    const phase = ((t * b.speed) + b.phase) % 1;
    // Visible in top 35% of the rise cycle; pops at surface
    if (phase > 0.65) continue;
    const rise = phase / 0.65;                            // 0 → 1 as it rises
    const bx   = b.ox * CANVAS_W + Math.sin(t * 0.6 + b.ox * 20) * b.drift * rise;
    const by   = LAVA_TOP + 8 + (1 - rise) * (lavaH * 0.35);
    const alpha = rise < 0.85 ? 1 : 1 - (rise - 0.85) / 0.15;  // pop fade
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = 'rgba(255,180,40,0.95)';
    ctx.lineWidth   = 1.8;
    ctx.beginPath(); ctx.arc(bx, by, b.size * (0.5 + 0.5 * rise), 0, Math.PI * 2);
    ctx.stroke();
    // Bright highlight inside
    ctx.fillStyle = `rgba(255,230,120,${0.35 * alpha})`;
    ctx.fill();
    ctx.restore();
  }

  // ── Bright glowing wave crest ────────────────────────────────────────────
  const crestGrad = ctx.createLinearGradient(0, LAVA_TOP - 2, 0, LAVA_TOP + 8);
  crestGrad.addColorStop(0, 'rgba(255,210,100,0.95)');
  crestGrad.addColorStop(1, 'rgba(255, 80,  0, 0.0)');
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  for (const p of wave) ctx.lineTo(p.x, p.y);
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();
  // Clip to only the top 10px of the lava to paint the crest glow
  ctx.save();
  ctx.clip();
  ctx.fillStyle = crestGrad;
  ctx.fillRect(0, LAVA_TOP - 6, CANVAS_W, 18);
  ctx.restore();

  // ── Ambient heat glow above lava surface ────────────────────────────────
  const heatGrad = ctx.createLinearGradient(0, LAVA_TOP - 55, 0, LAVA_TOP);
  heatGrad.addColorStop(0, 'rgba(255,80,0,0.00)');
  heatGrad.addColorStop(1, 'rgba(255,80,0,0.22)');
  ctx.fillStyle = heatGrad;
  ctx.fillRect(0, LAVA_TOP - 55, CANVAS_W, 55);

  ctx.restore();
}

function drawTable() {
  const tx = TABLE_X - tableW / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(tx, TABLE_Y, tx, TABLE_Y + TABLE_H);
  g.addColorStop(0, '#A1887F'); g.addColorStop(1, '#6D4C41');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(tx, TABLE_Y, tableW, TABLE_H, 4); ctx.fill();
  ctx.restore();
  const legW = 14, legY = TABLE_Y + TABLE_H, legH = CANVAS_H - legY;
  const lg = ctx.createLinearGradient(0, legY, 0, legY + legH);
  lg.addColorStop(0, '#8D6E63'); lg.addColorStop(1, '#5D4037');
  ctx.fillStyle = lg;
  ctx.fillRect(tx + 20, legY, legW, legH);
  ctx.fillRect(tx + tableW - 20 - legW, legY, legW, legH);
}

function drawAimLine(x, y) {
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, TABLE_Y);
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

const SHAPE_LABELS = {
  normal: '😼 Normal', loaf: '🍞 Loaf', sitting: '🙀 Tall',
  curled: '😴 Curled', stretch: '😸 Stretch',
};
function drawShapeLabel(x, y, shapeId) {
  ctx.save();
  ctx.font = 'bold 12px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(62,39,35,0.55)';
  ctx.fillText(SHAPE_LABELS[shapeId] || '', x, y - 38);
  ctx.restore();
}

// ── Banner overlay (level clear / level start) ────────────────────────────────
function drawBanner(now) {
  if (!bannerText || !bannerStart) return;
  const age = now - bannerStart;
  // Fade in for 200ms, hold, fade out over last 300ms of BANNER_MS
  let alpha = 1;
  if (age < 200) alpha = age / 200;
  else if (age > BANNER_MS - 300) alpha = Math.max(0, (BANNER_MS - age) / 300);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Semi-transparent pill
  const tw = Math.min(CANVAS_W - 40, 360);
  const th = 72;
  const tx = (CANVAS_W - tw) / 2;
  const ty = CANVAS_H / 2 - th / 2 - 30;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 18); ctx.fill();
  ctx.strokeStyle = '#FF7043'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 18); ctx.stroke();

  ctx.fillStyle = '#FF7043';
  ctx.font = 'bold 26px Fredoka One, cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bannerText, CANVAS_W / 2, ty + th / 2);

  ctx.restore();
}

// ── Sweep animation ───────────────────────────────────────────────────────────
function updateAndDrawSweepCats(now) {
  if (!sweepCats.length || !sweepStart) return;
  const t = (now - sweepStart) / SWEEP_MS; // 0 → 1

  for (const cat of sweepCats) {
    // Simple projectile: apply velocity + gravity over time
    const dt = t * (SWEEP_MS / 1000);
    const sx = cat.x + cat.vx * dt * 60;
    const sy = cat.y + cat.vy * dt * 60 + 0.5 * 18 * dt * dt * 60;
    const sa = cat.angle + cat.vx * 0.04;
    // Fade out in second half
    const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    drawCat(sx, sy, cat.color, cat.shape, sa, 0);
    ctx.restore();
  }
}

// ── Level indicator ───────────────────────────────────────────────────────────
function drawLevelIndicator() {
  ctx.save();
  ctx.font = 'bold 13px Nunito, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(62,39,35,0.45)';
  ctx.fillText(`Lv.${level}  ${catsThisLevel}/${CATS_PER_LEVEL} cats`, 10, CANVAS_H - 10);
  ctx.restore();
}

// ── Game loop ─────────────────────────────────────────────────────────────────
const MOVE_SPEED    = 4;
const FIXED_STEP_MS = 1000 / 60;
let lastTime     = 0;
let physicsAccum = 0;

function gameLoop(ts) {
  const frameDt = Math.min(ts - lastTime, 100);
  lastTime      = ts;
  physicsAccum += frameDt;

  while (physicsAccum >= FIXED_STEP_MS) {
    Engine.update(engine, FIXED_STEP_MS);
    physicsAccum -= FIXED_STEP_MS;
  }

  if (pending && !gameOver && !levelClearing) {
    wobbleTick += 0.07;
    pending.wobble = wobbleTick;
    if (keys['ArrowLeft'])  pendingX -= MOVE_SPEED;
    if (keys['ArrowRight']) pendingX += MOVE_SPEED;
    pendingX  = Math.max(40, Math.min(CANVAS_W - 40, pendingX));
    pending.x = pendingX;
  }

  if (!levelClearing) {
    checkSettle(ts);
    checkFallen();
  }

  // Draw
  drawBackground();
  drawLava(ts);
  drawTable();

  if (pending && !levelClearing) {
    drawAimLine(pending.x, pending.y);
    // Countdown — only shown when auto-drop timer is running
    if (autoDropStarted !== null) {
      const elapsed  = performance.now() - autoDropStarted; // use perf.now directly
      const fraction = Math.max(0, 1 - elapsed / autoDropDelay); // 1→0
      const secsLeft = Math.max(0, (autoDropDelay - elapsed) / 1000);
      const cx = pending.x, cy = pending.y;
      const r  = 30;

      ctx.save();

      // Background ring
      ctx.strokeStyle = 'rgba(0,0,0,0.13)';
      ctx.lineWidth   = 5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

      // Sweeping arc (orange → red as time runs out)
      const startAngle = -Math.PI / 2;
      const endAngle   = startAngle + fraction * Math.PI * 2;
      const green = Math.round(fraction * 160);
      ctx.strokeStyle = `rgba(255,${green},20,0.90)`;
      ctx.lineWidth   = 5;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, endAngle); ctx.stroke();

      // Numeric countdown text (e.g. "3.7")
      const label = secsLeft.toFixed(1);
      ctx.font         = 'bold 15px Nunito, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      // White outline for readability
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth   = 4;
      ctx.strokeText(label, cx + r + 18, cy);
      // Colored fill — matches arc color
      ctx.fillStyle = `rgb(255,${green},20)`;
      ctx.fillText(label, cx + r + 18, cy);

      ctx.restore();
    }
  }

  for (const cat of catBodies) {
    drawCat(cat.position.x, cat.position.y, cat._color, cat._shape, cat.angle, 0);
  }
  if (pending && !gameOver && !levelClearing) {
    drawCat(pending.x, pending.y, pending.color, pending.shape.id, 0, pending.wobble);
  }

  updateAndDrawSweepCats(ts);
  drawBanner(ts);
  drawLevelIndicator();

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
  if (gameOver || levelClearing) return;
  const r = canvas.getBoundingClientRect();
  pendingX = (e.clientX - r.left) * (CANVAS_W / r.width);
  dropCat();
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameOver || levelClearing) return;
  const r = canvas.getBoundingClientRect();
  pendingX = (e.touches[0].clientX - r.left) * (CANVAS_W / r.width);
  dropCat();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!pending || gameOver || levelClearing) return;
  const r = canvas.getBoundingClientRect();
  pendingX = (e.touches[0].clientX - r.left) * (CANVAS_W / r.width);
}, { passive: false });

document.getElementById('restart-btn').addEventListener('click', restart);

// ── Boot ──────────────────────────────────────────────────────────────────────
initPhysics();
spawnPending();
requestAnimationFrame(gameLoop);