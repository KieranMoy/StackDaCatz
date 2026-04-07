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
const TABLE_Y     = CANVAS_H - 100;
const TABLE_W     = CANVAS_W * 0.45;   // narrower table — more challenging
const TABLE_H     = 18;
const TABLE_X     = CANVAS_W / 2;
const DROP_Y      = 60;
const PHYS_SLAB_H = 60;
const SLAB_CY     = TABLE_Y + PHYS_SLAB_H / 2;

// Edge of the table surface in canvas pixels — used for fall detection
const TABLE_LEFT  = TABLE_X - TABLE_W / 2;
const TABLE_RIGHT = TABLE_X + TABLE_W / 2;

// ── Cat shape definitions ────────────────────────────────────────────────────
// Each variant defines:
//   id       – name used in drawCat switch
//   physW    – physics body width
//   physH    – physics body height
//   label    – shown in the aim indicator tooltip (optional)
//
// Physics dimensions are chosen to match the visual silhouette so stacking
// feels fair but each shape has different balance characteristics:
//   normal   – 52×34  balanced oval, easy starter
//   loaf     – 66×28  wide & flat, stable base but hard to pile on top
//   sitting  – 36×58  tall & narrow, tips sideways easily
//   curled   – 44×44  near-square/round, rolls off edges
//   stretch  – 78×24  very long and low, seesaws on the stack

const CAT_SHAPES = [
  { id: 'normal',  physW: 52, physH: 34 },
  { id: 'loaf',    physW: 66, physH: 28 },
  { id: 'sitting', physW: 36, physH: 58 },
  { id: 'curled',  physW: 44, physH: 44 },
  { id: 'stretch', physW: 78, physH: 24 },
];

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
let shapeIdx   = 0;
let wobbleTick = 0;

// ── Physics setup ───────────────────────────────────────────────────────────
function makeStaticBodies() {
  const table = Bodies.rectangle(TABLE_X, SLAB_CY, TABLE_W, PHYS_SLAB_H, {
    isStatic: true, label: 'table', friction: 0.9, restitution: 0.05,
  });
  const floor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H - 10, CANVAS_W * 4, 40, {
    isStatic: true, label: 'floor',
  });
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
function randomShape() {
  // Shuffle shape order so it feels random but covers all types
  return CAT_SHAPES[Math.floor(Math.random() * CAT_SHAPES.length)];
}

function spawnPending() {
  pendingX = CANVAS_W / 2;
  const shape = randomShape();
  pending = {
    x:      pendingX,
    y:      DROP_Y,
    color:  COLOR_LIST[colorIdx % COLOR_LIST.length],
    shape,
    wobble: 0,
  };
  colorIdx++;
}

function dropCat() {
  if (!pending || gameOver) return;

  const { shape } = pending;
  const cat = Bodies.rectangle(pending.x, pending.y, shape.physW, shape.physH, {
    restitution: 0.1,
    friction:    0.9,
    frictionAir: 0.015,
    density:     0.005,
    label:       'cat',
  });
  cat._color = pending.color;
  cat._shape = shape.id;
  cat._physW = shape.physW;

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
    // Fell through the bottom of the canvas entirely
    if (cat.position.y > CANVAS_H + 60) { triggerGameOver(); return; }

    // Only care about cats that have dropped below the table surface level
    if (cat.position.y < TABLE_Y - 10) continue;

    // Grace = half the cat's own physics width so the edge feels fair
    const halfW = (cat._physW || 30) / 2;
    const offLeft  = cat.position.x + halfW < TABLE_LEFT;
    const offRight = cat.position.x - halfW > TABLE_RIGHT;

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
// Each variant draws a visually distinct cat pose.
// x/y is the centre of the physics body (same as Matter body position).

function drawCatNormal(x, y, color, angle, wobble) {
  // Relaxed cat lying on its side — the original design
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 44, bh = 27;
  const hx = -bw*0.38, hy = -bh*0.3, hr = bh*0.58;

  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, bw/2, bh/2, 0, 0, Math.PI*2); ctx.fill(); // body

  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill(); // head

  // Ears
  ctx.fillStyle = shade(color,-25);
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.7,hy-hr*0.6, hx-hr*0.28,hy-hr*1.25, hx+hr*0.05,hy-hr*0.55],
    [hx+hr*0.3,hy-hr*0.65, hx+hr*0.7,hy-hr*1.2, hx+hr*0.95,hy-hr*0.5],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }

  // Inner ears
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x1,y1,x2,y2,x3,y3] of [
    [hx-hr*0.55,hy-hr*0.7, hx-hr*0.3,hy-hr*1.08, hx,hy-hr*0.62],
    [hx+hr*0.42,hy-hr*0.7, hx+hr*0.65,hy-hr*1.06, hx+hr*0.84,hy-hr*0.56],
  ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); }

  drawFace(hx, hy, hr, color);

  // Tail
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.4, 2);
  ctx.quadraticCurveTo(bw*0.65+Math.sin(wobble)*4, -bh*0.8, bw*0.5, -bh*1.2); ctx.stroke();

  // Paws
  ctx.fillStyle = shade(color,-15);
  ctx.beginPath(); ctx.ellipse(-bw*0.25, bh*0.42, bw*0.13, bh*0.18, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( bw*0.18, bh*0.44, bw*0.13, bh*0.18,  0.3, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawCatLoaf(x, y, color, angle, wobble) {
  // Loaf cat — wide, flat, tucked paws, smug expression
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 58, bh = 22;
  const hx = -bw*0.28, hy = -bh*0.75, hr = bh*0.72;

  // Body: wide rectangle with rounded ends
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-bw/2, -bh/2, bw, bh, bh*0.45); ctx.fill();

  // Head sits on top of the loaf body
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();

  // Ears (short, pointy)
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

  // No visible paws (tucked in) — just two little nubs at the bottom front
  ctx.fillStyle = shade(color,-12);
  ctx.beginPath(); ctx.ellipse(-bw*0.18, bh*0.38, bw*0.11, bh*0.22, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( bw*0.12, bh*0.38, bw*0.11, bh*0.22, 0, 0, Math.PI*2); ctx.fill();

  // Tiny tail tip peeking at back
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.46, 0);
  ctx.quadraticCurveTo(bw*0.58+Math.sin(wobble)*3, -bh*0.6, bw*0.44, -bh*1.0); ctx.stroke();

  ctx.restore();
}

function drawCatSitting(x, y, color, angle, wobble) {
  // Sitting cat — tall and upright, narrow base, easy to topple
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 26, bh = 46;
  const hx = 0, hy = -bh*0.42, hr = bw*0.68;

  // Body: tall oval
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, bh*0.08, bw/2, bh*0.45, 0, 0, Math.PI*2); ctx.fill();

  // Head (larger relative to body)
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();

  // Tall pointy ears
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

  // Front paws on the ground
  ctx.fillStyle = shade(color,-15);
  ctx.beginPath(); ctx.ellipse(-bw*0.3, bh*0.44, bw*0.22, bh*0.1, 0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( bw*0.3, bh*0.44, bw*0.22, bh*0.1, -0.2, 0, Math.PI*2); ctx.fill();

  // Tail curled around side
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.28, bh*0.3);
  ctx.quadraticCurveTo(bw*0.9+Math.sin(wobble)*4, bh*0.1, bw*0.55, bh*0.48); ctx.stroke();

  ctx.restore();
}

function drawCatCurled(x, y, color, angle, wobble) {
  // Curled-up sleeping cat — near-circular, rolls around
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const r = 20; // roughly circular

  // Main curled body — big circle
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();

  // Second body lobe for a "C" curl shape
  ctx.beginPath(); ctx.ellipse(r*0.55, r*0.35, r*0.62, r*0.42, 0.8, 0, Math.PI*2); ctx.fill();

  // Head tucked into the curl (small, at top-right)
  const hx = r*0.52, hy = -r*0.52, hr = r*0.55;
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();

  // Tiny ears (cat is sleepy, ears flat-ish)
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

  // Sleepy face (eyes half-closed)
  drawFaceSleepy(hx, hy, hr, color);

  // Tail wraps around the body
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r*0.5, r*0.2);
  ctx.quadraticCurveTo(-r*1.1+Math.sin(wobble)*3, r*0.8, r*0.1, r*1.0); ctx.stroke();

  ctx.restore();
}

function drawCatStretch(x, y, color, angle, wobble) {
  // Stretched-out cat — very long and low, like mid-yawn stretch
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bw = 68, bh = 18;
  const hx = -bw*0.44, hy = -bh*0.6, hr = bh*0.82;

  // Long stretched body
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(bw*0.05, 0, bw/2, bh/2, 0, 0, Math.PI*2); ctx.fill();

  // Head at the far left (like reaching forward)
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();

  // Ears (flattened back slightly — stretching)
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

  // Two sets of paws (front stretched out, back tucked)
  ctx.fillStyle = shade(color,-15);
  // Front paws reaching forward
  ctx.beginPath(); ctx.ellipse(hx+hr*0.4, bh*0.35, bw*0.1, bh*0.3, -0.4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.9, bh*0.38, bw*0.1, bh*0.3, -0.3, 0, Math.PI*2); ctx.fill();
  // Back paws
  ctx.beginPath(); ctx.ellipse(bw*0.36, bh*0.35, bw*0.09, bh*0.3, 0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(bw*0.46, bh*0.32, bw*0.09, bh*0.3, 0.4, 0, Math.PI*2); ctx.fill();

  // Tail up in the air at the right end
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bw*0.46, -2);
  ctx.quadraticCurveTo(bw*0.6+Math.sin(wobble)*4, -bh*1.4, bw*0.42, -bh*2.0); ctx.stroke();

  ctx.restore();
}

// ── Shared face drawing helpers ───────────────────────────────────────────────
function drawFace(hx, hy, hr, color) {
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
}

function drawFaceSleepy(hx, hy, hr, color) {
  // Half-closed eyes for the curled/sleeping cat
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.36, hy-hr*0.05, hr*0.26, hr*0.14, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.28, hy-hr*0.05, hr*0.26, hr*0.14, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(hx-hr*0.34, hy-hr*0.05, hr*0.13, hr*0.1, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+hr*0.32, hy-hr*0.05, hr*0.13, hr*0.1, 0,0,Math.PI*2); ctx.fill();
  // Droopy eyelid lines
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx-hr*0.62, hy-hr*0.05); ctx.quadraticCurveTo(hx-hr*0.35,hy-hr*0.2,hx-hr*0.1,hy-hr*0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx+hr*0.04, hy-hr*0.05); ctx.quadraticCurveTo(hx+hr*0.3,hy-hr*0.2,hx+hr*0.55,hy-hr*0.05); ctx.stroke();
  // Nose
  ctx.fillStyle = '#FF8A80';
  ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.22); ctx.lineTo(hx-hr*0.12,hy+hr*0.12); ctx.lineTo(hx+hr*0.12,hy+hr*0.12); ctx.closePath(); ctx.fill();
  // Sleepy "zz" mouth (just a small line)
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx-hr*0.18, hy+hr*0.32); ctx.lineTo(hx+hr*0.18, hy+hr*0.32); ctx.stroke();
  // Whiskers
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
  g.addColorStop(0,   '#E8F5E9');
  g.addColorStop(0.5, '#FFF8E1');
  g.addColorStop(1,   '#FCE4EC');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawTable() {
  const tx = TABLE_X - TABLE_W / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(tx, TABLE_Y, tx, TABLE_Y + TABLE_H);
  g.addColorStop(0, '#A1887F'); g.addColorStop(1, '#6D4C41');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(tx, TABLE_Y, TABLE_W, TABLE_H, 4); ctx.fill();
  ctx.restore();
  const legW = 14, legY = TABLE_Y + TABLE_H, legH = CANVAS_H - legY;
  const lg = ctx.createLinearGradient(0, legY, 0, legY + legH);
  lg.addColorStop(0, '#8D6E63'); lg.addColorStop(1, '#5D4037');
  ctx.fillStyle = lg;
  ctx.fillRect(tx + 20, legY, legW, legH);
  ctx.fillRect(tx + TABLE_W - 20 - legW, legY, legW, legH);
}

function drawAimLine(x, y) {
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, TABLE_Y);
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

// Shape label shown above the pending cat so the player knows what's coming
const SHAPE_LABELS = {
  normal:  '😼 Normal',
  loaf:    '🍞 Loaf',
  sitting: '🙀 Tall',
  curled:  '😴 Curled',
  stretch: '😸 Stretch',
};

function drawShapeLabel(x, y, shapeId) {
  const label = SHAPE_LABELS[shapeId] || '';
  ctx.save();
  ctx.font = 'bold 12px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(62,39,35,0.55)';
  ctx.fillText(label, x, y - 38);
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
    pendingX  = Math.max(40, Math.min(CANVAS_W - 40, pendingX));
    pending.x = pendingX;
  }

  checkFallen();

  drawBackground();
  drawTable();

  if (pending) {
    drawAimLine(pending.x, pending.y);
    drawShapeLabel(pending.x, pending.y, pending.shape.id);
  }

  for (const cat of catBodies) {
    drawCat(cat.position.x, cat.position.y, cat._color, cat._shape, cat.angle, 0);
  }
  if (pending && !gameOver) {
    drawCat(pending.x, pending.y, pending.color, pending.shape.id, 0, pending.wobble);
  }

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