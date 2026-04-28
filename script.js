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
const BASE_TABLE_W  = CANVAS_W * 0.495;
const MIN_TABLE_W   = CANVAS_W * 0.18;
const CATS_PER_LEVEL = 20;

// ── Level state ───────────────────────────────────────────────────────────────
let tableW     = BASE_TABLE_W;
let tableLeft  = TABLE_X - tableW / 2;
let tableRight = TABLE_X + tableW / 2;
let level      = 1;
let catsThisLevel = 0;

// ── Cat shape definitions ─────────────────────────────────────────────────────
const CAT_SHAPES = [
  { id: 'normal',  physW: 52, physH: 34 },
  { id: 'loaf',    physW: 66, physH: 28 },
  { id: 'sitting', physW: 36, physH: 58 },
  { id: 'curled',  physW: 44, physH: 44 },
  { id: 'stretch', physW: 78, physH: 24 },
];

// ── Auto-drop timer ────────────────────────────────────────────────────────────
const AUTO_DROP_BASE_MS  = 4000;
const AUTO_DROP_STEP_MS  = 500;
const AUTO_DROP_MIN_MS   = 500;
let autoDropTimer    = null;
let autoDropStarted  = null;
let autoDropDelay    = AUTO_DROP_BASE_MS;
let levelStarted     = false;

function dropDelayMs() {
  return Math.max(AUTO_DROP_MIN_MS, AUTO_DROP_BASE_MS - (level - 1) * AUTO_DROP_STEP_MS);
}

// ── State ──────────────────────────────────────────────────────────────────
let engine, world;
let catBodies     = [];
let pending       = null;
let pendingX      = CANVAS_W / 2;
let score         = 0;
let best          = parseInt(localStorage.getItem('stackDaCatz_best') || '0', 10);
let gameOver      = false;
let levelClearing = false;
let keys          = {};
let colorIdx      = 0;
let wobbleTick    = 0;

// ── Heart particle effect ─────────────────────────────────────────────────────
let heartParticles = [];

function heartsUnlocked() {
  return score >= 300 || best >= 300;
}

function createHeartParticle(x, y) {
  return {
    x: x + (Math.random() - 0.5) * 26,
    y: y + (Math.random() - 0.5) * 22,
    vx: (Math.random() - 0.5) * 0.45,
    vy: -0.25 - Math.random() * 0.45,
    size: 3 + Math.random() * 3,
    life: 45 + Math.random() * 35,
    maxLife: 80,
    rotation: (Math.random() - 0.5) * 0.8,
    spin: (Math.random() - 0.5) * 0.025,
  };
}

function maybeSpawnHeart(x, y, chance) {
  if (!heartsUnlocked()) return;
  if (heartParticles.length > 180) return;
  if (Math.random() < chance) {
    const p = createHeartParticle(x, y);
    p.maxLife = p.life;
    heartParticles.push(p);
  }
}

function drawHeartShape(x, y, size, rotation, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size, size);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255, 105, 180, 0.9)';
  ctx.beginPath();
  ctx.moveTo(0, 0.35);
  ctx.bezierCurveTo(-1.1, -0.45, -0.95, -1.35, -0.25, -1.35);
  ctx.bezierCurveTo(0.15, -1.35, 0.35, -1.05, 0, -0.7);
  ctx.bezierCurveTo(-0.35, -1.05, -0.15, -1.35, 0.25, -1.35);
  ctx.bezierCurveTo(0.95, -1.35, 1.1, -0.45, 0, 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateAndDrawHearts() {
  for (let i = heartParticles.length - 1; i >= 0; i--) {
    const p = heartParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.002;
    p.rotation += p.spin;
    p.life--;

    if (p.life <= 0) {
      heartParticles.splice(i, 1);
      continue;
    }

    const alpha = Math.max(0, p.life / p.maxLife);
    drawHeartShape(p.x, p.y, p.size, p.rotation, alpha);
  }
}

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

  if (autoDropTimer) { clearTimeout(autoDropTimer); autoDropTimer = null; }
  autoDropStarted = null;

  if (!levelStarted) levelStarted = true;

  const { shape } = pending;
  const spawnWorldY = DROP_Y + cameraY;
  const cat = Bodies.rectangle(pending.x, spawnWorldY, shape.physW, shape.physH, {
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

    if (!isEndlessMode && catsThisLevel >= CATS_PER_LEVEL) {
      triggerLevelClear();
    } else {
      spawnPending();
    }
  }, 650);
}

// ── Endless mode / camera ─────────────────────────────────────────────────────
let isEndlessMode = false;
let cameraY       = 0;

let sweepCats   = [];
let sweepStart  = null;
const SWEEP_MS  = 800;

let bannerText    = '';
let bannerOpacity = 0;
let bannerStart   = null;
const BANNER_MS   = 1200;

function triggerLevelClear() {
  console.log(`triggerLevelClear fired! level=${level}, catsThisLevel=${catsThisLevel}`);
  levelClearing = true;
  pending = null;

  if (autoDropTimer) { clearTimeout(autoDropTimer); autoDropTimer = null; }
  autoDropStarted = null;
  levelStarted    = false;

  bannerText    = `Level ${level} Clear! 🎉`;
  bannerStart   = performance.now();
  bannerOpacity = 1;

  setTimeout(() => {
    sweepCats = catBodies.map(cat => ({
      x: cat.position.x, y: cat.position.y,
      angle: cat.angle,
      color: cat._color, shape: cat._shape,
      vx: (Math.random() - 0.5) * 18,
      vy: -(Math.random() * 10 + 6),
    }));

    for (const cat of catBodies) World.remove(world, cat);
    catBodies = [];

    sweepStart = performance.now();

    setTimeout(() => {
      sweepCats = [];
      level++;
      catsThisLevel = 0;

      if (level >= 4) {
        isEndlessMode = true;
        cameraY       = 0;
        document.getElementById('level-display').textContent = '∞';

        World.clear(world);
        Engine.clear(engine);
        World.add(world, makeStaticBodies());
        registerCollisionEvents();

        bannerText    = '😸 Endless Mode!';
        bannerStart   = performance.now();
        bannerOpacity = 1;

        setTimeout(() => {
          levelClearing = false;
          bannerText    = '';
          levelStarted  = false;
          spawnPending();
        }, 900);

      } else {
        tableW     = Math.max(MIN_TABLE_W, tableW * 0.80);
        tableLeft  = TABLE_X - tableW / 2;
        tableRight = TABLE_X + tableW / 2;
        document.getElementById('level-display').textContent = level;

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
      }

    }, SWEEP_MS + 100);
  }, BANNER_MS);
}

// ── Game over / restart ───────────────────────────────────────────────────────
function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  pending  = null;
  if (score > best) { best = score; localStorage.setItem('stackDaCatz_best', best); document.getElementById('best').textContent = best; }
  document.getElementById('final-score').textContent = score;
  document.getElementById('overlay').classList.remove('hidden');
}

function restart() {
  if (autoDropTimer) { clearTimeout(autoDropTimer); autoDropTimer = null; }
  autoDropStarted = null;
  autoDropDelay   = AUTO_DROP_BASE_MS;
  levelStarted    = false;
  isEndlessMode   = false;
  cameraY         = 0;

  World.clear(world);
  Engine.clear(engine);
  catBodies      = [];
  sweepCats      = [];
  heartParticles = [];
  score          = 0;
  gameOver       = false;
  levelClearing  = false;
  colorIdx       = 0;
  wobbleTick     = 0;
  level          = 1;
  catsThisLevel  = 0;
  tableW         = BASE_TABLE_W;
  tableLeft      = TABLE_X - tableW / 2;
  tableRight     = TABLE_X + tableW / 2;
  bannerText     = '';
  sweepStart     = null;
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

function checkFallen() {
  if (levelClearing) return;
  const lavaWorldY = TABLE_Y + TABLE_H + cameraY;
  for (const cat of catBodies) {
    if (cat.isStatic) continue;
    if (cat.position.y > lavaWorldY + 60) { triggerGameOver(); return; }
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
const LAVA_BUBBLES = Array.from({ length: 9 }, (_, i) => ({
  ox:    (i + 0.5) / 9 + (Math.random() - 0.5) * 0.06,
  speed: 0.28 + Math.random() * 0.32,
  size:  3 + Math.random() * 4,
  phase: Math.random(),
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
  const LAVA_TOP = TABLE_Y + TABLE_H;

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

  for (const b of LAVA_BUBBLES) {
    const phase = ((t * b.speed) + b.phase) % 1;
    if (phase > 0.65) continue;
    const rise = phase / 0.65;
    const bx   = b.ox * CANVAS_W + Math.sin(t * 0.6 + b.ox * 20) * b.drift * rise;
    const by   = LAVA_TOP + 8 + (1 - rise) * (lavaH * 0.35);
    const alpha = rise < 0.85 ? 1 : 1 - (rise - 0.85) / 0.15;
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = 'rgba(255,180,40,0.95)';
    ctx.lineWidth   = 1.8;
    ctx.beginPath(); ctx.arc(bx, by, b.size * (0.5 + 0.5 * rise), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,230,120,${0.35 * alpha})`;
    ctx.fill();
    ctx.restore();
  }

  const crestGrad = ctx.createLinearGradient(0, LAVA_TOP - 2, 0, LAVA_TOP + 8);
  crestGrad.addColorStop(0, 'rgba(255,210,100,0.95)');
  crestGrad.addColorStop(1, 'rgba(255, 80,  0, 0.0)');
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  for (const p of wave) ctx.lineTo(p.x, p.y);
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = crestGrad;
  ctx.fillRect(0, LAVA_TOP - 6, CANVAS_W, 18);
  ctx.restore();

  const heatGrad = ctx.createLinearGradient(0, LAVA_TOP - 55, 0, LAVA_TOP);
  heatGrad.addColorStop(0, 'rgba(255,80,0,0.00)');
  heatGrad.addColorStop(1, 'rgba(255,80,0,0.22)');
  ctx.fillStyle = heatGrad;
  ctx.fillRect(0, LAVA_TOP - 55, CANVAS_W, 55);

  ctx.restore();
}

function drawTable() {
  const tx = TABLE_X - tableW / 2;
  const syTop = TABLE_Y - cameraY;
  const syBot = syTop + TABLE_H;
  if (syTop > CANVAS_H) return;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(tx, syTop, tx, syBot);
  g.addColorStop(0, '#A1887F'); g.addColorStop(1, '#6D4C41');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(tx, syTop, tableW, TABLE_H, 4); ctx.fill();
  ctx.restore();

  const legW = 14;
  const legH = Math.max(0, CANVAS_H - syBot);
  if (legH > 0) {
    const lg = ctx.createLinearGradient(0, syBot, 0, syBot + legH);
    lg.addColorStop(0, '#8D6E63'); lg.addColorStop(1, '#5D4037');
    ctx.fillStyle = lg;
    ctx.fillRect(tx + 20, syBot, legW, legH);
    ctx.fillRect(tx + tableW - 20 - legW, syBot, legW, legH);
  }
}

function drawAimLine(x, y) {
  const tableScreenY = Math.min(CANVAS_H, TABLE_Y - cameraY);
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, tableScreenY);
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawBanner(now) {
  if (!bannerText || !bannerStart) return;
  const age = now - bannerStart;
  let alpha = 1;
  if (age < 200) alpha = age / 200;
  else if (age > BANNER_MS - 300) alpha = Math.max(0, (BANNER_MS - age) / 300);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

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

function updateAndDrawSweepCats(now) {
  if (!sweepCats.length || !sweepStart) return;
  const t = (now - sweepStart) / SWEEP_MS;

  for (const cat of sweepCats) {
    const dt = t * (SWEEP_MS / 1000);
    const sx = cat.x + cat.vx * dt * 60;
    const sy = (cat.y - cameraY) + cat.vy * dt * 60 + 0.5 * 18 * dt * dt * 60;
    const sa = cat.angle + cat.vx * 0.04;
    const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    drawCat(sx, sy, cat.color, cat.shape, sa, 0);
    maybeSpawnHeart(sx, sy, 0.16);
    ctx.restore();
  }
}

function drawLevelIndicator() {
  ctx.save();
  ctx.font = 'bold 13px Nunito, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(62,39,35,0.45)';
  if (isEndlessMode) {
    ctx.fillText(`∞ Endless  —  ${score} cats stacked`, 10, CANVAS_H - 10);
  } else {
    ctx.fillText(`Lv.${level}  ${catsThisLevel}/${CATS_PER_LEVEL} cats`, 10, CANVAS_H - 10);
  }
  ctx.restore();
}

function updateCamera() {
  if (!isEndlessMode) return;

  let highestWorldY = TABLE_Y;
  let hasSettled = false;
  for (const cat of catBodies) {
    if (!cat.isStatic) continue;
    if (cat.position.y < highestWorldY) { highestWorldY = cat.position.y; hasSettled = true; }
  }
  if (!hasSettled) return;

  const screenTarget  = CANVAS_H / 2;
  const targetCameraY = highestWorldY - screenTarget;

  if (targetCameraY < cameraY) {
    cameraY += (targetCameraY - cameraY) * 0.04;
  }
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
    updateCamera();
  }

  drawBackground();
  drawTable();

  for (const cat of catBodies) {
    const sx = cat.position.x;
    const sy = cat.position.y - cameraY;
    drawCat(sx, sy, cat._color, cat._shape, cat.angle, 0);
    maybeSpawnHeart(sx, sy, cat.isStatic ? 0.08 : 0.12);
  }

  drawLava(ts);

  if (pending && !levelClearing) {
    drawAimLine(pending.x, pending.y);

    if (autoDropStarted !== null) {
      const elapsed  = performance.now() - autoDropStarted;
      const fraction = Math.max(0, 1 - elapsed / autoDropDelay);
      const secsLeft = Math.max(0, (autoDropDelay - elapsed) / 1000);
      const cx = pending.x, cy = pending.y;
      const r  = 30;

      ctx.save();

      ctx.strokeStyle = 'rgba(0,0,0,0.13)';
      ctx.lineWidth   = 5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

      const startAngle = -Math.PI / 2;
      const endAngle   = startAngle + fraction * Math.PI * 2;
      const green = Math.round(fraction * 160);
      ctx.strokeStyle = `rgba(255,${green},20,0.90)`;
      ctx.lineWidth   = 5;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, endAngle); ctx.stroke();

      const label = secsLeft.toFixed(1);
      ctx.font         = 'bold 15px Nunito, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle  = 'rgba(255,255,255,0.9)';
      ctx.lineWidth    = 4;
      ctx.strokeText(label, cx + r + 18, cy);
      ctx.fillStyle    = `rgb(255,${green},20)`;
      ctx.fillText(label, cx + r + 18, cy);

      ctx.restore();
    }
  }

  if (pending && !gameOver && !levelClearing) {
    drawCat(pending.x, pending.y, pending.color, pending.shape.id, 0, pending.wobble);
    maybeSpawnHeart(pending.x, pending.y, 0.18);
  }

  updateAndDrawSweepCats(ts);
  updateAndDrawHearts();
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

// ── Start screen ──────────────────────────────────────────────────────────────
function dismissStartScreen() {
  document.getElementById('start-overlay').classList.add('hidden');
}

document.getElementById('play-btn').addEventListener('click', () => {
  dismissStartScreen();
  spawnPending();
});

document.getElementById('endless-btn').addEventListener('click', () => {
  dismissStartScreen();

  isEndlessMode = true;
  tableW        = Math.max(MIN_TABLE_W, BASE_TABLE_W * 0.80 * 0.80);
  tableLeft     = TABLE_X - tableW / 2;
  tableRight    = TABLE_X + tableW / 2;
  level         = 4;
  document.getElementById('level-display').textContent = '∞';

  World.clear(world);
  Engine.clear(engine);
  World.add(world, makeStaticBodies());
  registerCollisionEvents();

  spawnPending();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initPhysics();
document.getElementById('best').textContent = best;

const ENDLESS_UNLOCK_SCORE = 60;
const endlessBtn = document.getElementById('endless-btn');
if (best < ENDLESS_UNLOCK_SCORE) {
  endlessBtn.disabled = true;
  endlessBtn.textContent = `🔒 Endless (reach ${ENDLESS_UNLOCK_SCORE} to unlock)`;
}

requestAnimationFrame(gameLoop);