'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Comet (Estrella Fugaz) ─────────────────────────────────────────────────────
// Asteroide especial: muy rápido, con estela, TTL limitado. Se divide al morir.
const COMET_RADII  = [0, 8, 14];      // tamaño 1 (hija) y 2 (grande)
const COMET_SPEED  = 180;             // px/s (~5x asteroide tamaño 3)
const COMET_TTL    = [0, 5, 8];        // segundos de vida por tamaño (hijas viven menos)
const COMET_PERIOD = 15;             // cada 15s aparece una nueva
const COMET_POINTS = [0, 100, 200];   // puntos por tamaño (hija=100, grande=200)
const COMET_TRAIL_RATE = 40;          // partículas/segundo de estela

class Comet {
  constructor(x, y, size = 2) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = COMET_RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = COMET_SPEED + rand(-20, 20);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-2.5, 2.5);
    this.rot = rand(0, Math.PI * 2);

    this.ttl = COMET_TTL[size];
    this.life = this.ttl;     // para parpadeo al final
    this.trailAcc = 0;        // acumulador para emitir estela

    // Polígono irregular (como asteroide): solo borde, sin relleno
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) { this.dead = true; return; }

    // Estela: emite partículas en el array global `particles`
    this.trailAcc += dt * COMET_TRAIL_RATE;
    while (this.trailAcc >= 1) {
      this.trailAcc -= 1;
      particles.push(new Particle(this.x, this.y, {
        angle: Math.atan2(-this.vy, -this.vx) + rand(-0.3, 0.3),
        speed: rand(10, 40),
        life:  rand(0.25, 0.55),
        color: '#ffcc44',
      }));
    }
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Comet(this.x, this.y, this.size - 1),
      new Comet(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    // Parpadeo en el último segundo de vida
    if (this.ttl < 1 && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#ffcc44';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── PowerUp (Velocidad / Escudo) ──────────────────────────────────────────────
const POWERUP_DROP_CHANCE  = 0.08;  // probabilidad de drop por asteroide destruido
const POWERUP_BOOST_TIME   = 5;     // duración del boost Velocidad en segundos
const POWERUP_THRUST_MULT  = 2;     // multiplicador de empuje durante el boost
const POWERUP_SHIELD_TIME  = 5;     // duración del escudo en segundos
const SHIELD_RADIUS        = 22;    // radio del escudo alrededor de la nave
const POWERUP_SHIELD_DROP  = 0.5;   // probabilidad de que un drop sea Escudo (resto: Velocidad)

// Devuelve un power-up aleatorio en (x, y): 50/50 entre Velocidad y Escudo
function spawnRandomPowerUp(x, y) {
  const type = Math.random() < POWERUP_SHIELD_DROP ? 'shield' : 'speed';
  return new PowerUp(x, y, type);
}

class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 11;
    this.rot = 0;
    this.rotSpeed = 1.5;
    this.bob = rand(0, Math.PI * 2);
    this.dead = false;
  }

  apply(ship) {
    if (this.type === 'shield') ship.applyShield();
    else                         ship.applyBoost();
  }

  update(dt) {
    this.rot += this.rotSpeed * dt;
    this.bob += dt * 3;
  }

  draw() {
    // Parpadeo suave
    if (Math.floor(this.bob * 4) % 2 === 0) return;
    const color = this.type === 'shield' ? '#5fc8ff' : '#7fffd4';
    const label = this.type === 'shield' ? 'E'      : 'V';
    const oy = Math.sin(this.bob) * 3;
    ctx.save();
    ctx.translate(this.x, this.y + oy);
    ctx.rotate(this.rot);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    if (this.type === 'shield') {
      // Hexágono
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * 11;
        const py = Math.sin(a) * 11;
        if (i === 0) ctx.moveTo(px, py);
        else         ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      // Rombo
      ctx.beginPath();
      ctx.moveTo( 11,  0);
      ctx.lineTo(  0, 11);
      ctx.lineTo(-11,  0);
      ctx.lineTo(  0,-11);
      ctx.closePath();
      ctx.stroke();
    }
    // Letra
    ctx.rotate(-this.rot);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.boost         = 0;   // timer restante del power-up Velocidad (0 = inactivo)
    this.shield        = 0;   // timer restante del power-up Escudo  (0 = inactivo)
    this.dead          = false;
  }

  applyBoost()  { this.boost  = POWERUP_BOOST_TIME;  }   // refresca, no apila
  applyShield() { this.shield = POWERUP_SHIELD_TIME; }   // refresca, no apila

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    if (this.boost  > 0) this.boost  -= dt;
    if (this.shield > 0) this.shield -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260 * (this.boost > 0 ? POWERUP_THRUST_MULT : 1);  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;

    // Anillo de escudo: se dibuja antes del parpadeo de invencibilidad para que
    // también sea visible durante el respawn.
    if (this.shield > 0) {
      const t = performance.now() / 1000;
      const pulse = 0.45 + 0.25 * Math.sin(t * 6);
      const alpha = (this.shield < 1 ? Math.max(0.2, this.shield) : 1) * pulse;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = `rgba(95, 200, 255, ${alpha.toFixed(2)})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      // Halo interior sutil
      ctx.strokeStyle = `rgba(95, 200, 255, ${(alpha * 0.35).toFixed(2)})`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_RADIUS - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y, opts = {}) {
    this.x  = x;
    this.y  = y;
    const angle = (opts.angle !== undefined) ? opts.angle : rand(0, Math.PI * 2);
    const speed = (opts.speed !== undefined) ? opts.speed : rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = opts.life !== undefined ? opts.life : rand(0.4, 1.1);
    this.ttl  = this.life;
    this.color = opts.color || '#fff';   // color base para la estela de cometa
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = Math.max(0, this.ttl / this.life);
    // Convierte color hex a rgba respetando alpha
    const hex = this.color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups, comets;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let cometTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups = [];
  comets   = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  cometTimer = 0;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  comets    = [];
  cometTimer = 0;
  ship.reset();
  spawnAsteroids(3 + level);
}

function spawnComet() {
  const SAFE_DIST = 130;
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - ship.x, y - ship.y) < SAFE_DIST);
  comets.push(new Comet(x, y, 2));
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead  = true;
  ship.boost = 0;   // el power-up Velocidad se cancela al morir
  ship.shield = 0;  // el power-up Escudo se cancela al morir
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));
  comets.forEach(c => c.update(dt));

  // Spawn periódico de estrella fugaz
  cometTimer += dt;
  if (cometTimer >= COMET_PERIOD) {
    cometTimer = 0;
    spawnComet();
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerups  = powerups.filter(p => !p.dead);
  comets    = comets.filter(c => !c.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        if (Math.random() < POWERUP_DROP_CHANCE) powerups.push(spawnRandomPowerUp(a.x, a.y));
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);

  // Bala vs cometa (estrella fugaz)
  const newComets = [];
  for (const b of bullets) {
    for (const c of comets) {
      if (!c.dead && !b.dead && dist(b, c) < c.radius) {
        b.dead = true;
        c.dead = true;
        score += COMET_POINTS[c.size];
        // Explosión amarilla de la fugaz
        for (let i = 0; i < c.size * 6; i++)
          particles.push(new Particle(c.x, c.y, { color: '#ffcc44', life: rand(0.3, 0.8) }));
        newComets.push(...c.split());
      }
    }
  }
  comets = comets.filter(c => !c.dead).concat(newComets);
  bullets   = bullets.filter(b => !b.dead);

  // Escudo vs asteroide: destruye el asteroide al contacto (da puntos, split y drop)
  if (ship.shield > 0 && !ship.dead) {
    const splits = [];
    for (const a of asteroids) {
      if (!a.dead && dist(ship, a) < SHIELD_RADIUS + a.radius * 0.82) {
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        if (Math.random() < POWERUP_DROP_CHANCE) powerups.push(spawnRandomPowerUp(a.x, a.y));
        splits.push(...a.split());
      }
    }
    asteroids = asteroids.filter(a => !a.dead).concat(splits);
  }

  // Escudo vs cometa: destruye el cometa al contacto (da puntos, split y explosión amarilla)
  if (ship.shield > 0 && !ship.dead) {
    const splits = [];
    for (const c of comets) {
      if (!c.dead && dist(ship, c) < SHIELD_RADIUS + c.radius * 0.82) {
        c.dead = true;
        score += COMET_POINTS[c.size];
        for (let i = 0; i < c.size * 6; i++)
          particles.push(new Particle(c.x, c.y, { color: '#ffcc44', life: rand(0.3, 0.8) }));
        splits.push(...c.split());
      }
    }
    comets = comets.filter(c => !c.dead).concat(splits);
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nave vs cometa (igual que asteroide: daña la nave)
  if (!ship.dead && ship.invincible <= 0) {
    for (const c of comets) {
      if (dist(ship, c) < ship.radius + c.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nave vs power-up (V: Velocidad / E: Escudo)
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      p.apply(ship);
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicador del power-up Velocidad
  if (ship.boost > 0) {
    const barW = 120;
    const barH = 6;
    const bx = 14;
    const by = 34;
    ctx.fillStyle = '#7fffd4';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`VELOCIDAD ${ship.boost.toFixed(1)}s`, bx, by);
    // Barra de progreso
    ctx.fillStyle = 'rgba(127, 255, 212, 0.25)';
    ctx.fillRect(bx, by + 4, barW, barH);
    ctx.fillStyle = '#7fffd4';
    ctx.fillRect(bx, by + 4, barW * (ship.boost / POWERUP_BOOST_TIME), barH);
  }

  // Indicador del power-up Escudo
  if (ship.shield > 0) {
    const barW = 120;
    const barH = 6;
    const bx = 14;
    const by = ship.boost > 0 ? 52 : 34;
    ctx.fillStyle = '#5fc8ff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`ESCUDO ${ship.shield.toFixed(1)}s`, bx, by);
    ctx.fillStyle = 'rgba(95, 200, 255, 0.25)';
    ctx.fillRect(bx, by + 4, barW, barH);
    ctx.fillStyle = '#5fc8ff';
    ctx.fillRect(bx, by + 4, barW * (ship.shield / POWERUP_SHIELD_TIME), barH);
  }

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  comets.forEach(c => c.draw());
  powerups.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
