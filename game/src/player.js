// Shadow Ledger — the thief. Controls, also shown on the title screen:
//   WASD / arrows — move     Shift — sneak (slow, quiet, hard to spot)
//   R (hold)      — run (fast, loud: guards hear it)
// Movement slides along walls: X and Y are resolved one axis at a time.
import { PLAYER } from './config.js';
import { pointInRects } from './level.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    radius: PLAYER.radius,
    dirX: 0,
    dirY: -1,
    sneaking: false,
    running: false,
    moving: false,
    stepTimer: 0,
    inShadow: false,
    inBush: false,
  };
}

// Push a circle out of a solid rectangle it overlaps. Returns true on a hit.
function collideCircleRect(p, r) {
  const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= p.radius * p.radius) return false;
  if (d2 === 0) {
    // Centre inside the rectangle: push out along the smallest penetration.
    const left = p.x - r.x;
    const right = r.x + r.w - p.x;
    const top = p.y - r.y;
    const bottom = r.y + r.h - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = r.x - p.radius;
    else if (m === right) p.x = r.x + r.w + p.radius;
    else if (m === top) p.y = r.y - p.radius;
    else p.y = r.y + r.h + p.radius;
    return true;
  }
  const d = Math.sqrt(d2);
  p.x = cx + (dx / d) * p.radius;
  p.y = cy + (dy / d) * p.radius;
  return true;
}

function resolveSolids(p, solids) {
  for (let i = 0; i < solids.length; i += 1) collideCircleRect(p, solids[i]);
}

// Move the player one step. `move` is {x, y} in -1..1, `sneak`/`run` are
// booleans. Returns a small report the world uses for sound and noise.
export function updatePlayer(p, move, sneak, run, dt, level) {
  p.sneaking = sneak;
  p.running = run && !sneak;
  const speed = p.sneaking ? PLAYER.sneakSpeed : p.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(move.x, move.y);
  p.moving = len > 0.01;
  let stepped = false;
  if (p.moving) {
    const nx = move.x / len;
    const ny = move.y / len;
    p.dirX = nx;
    p.dirY = ny;
    // X first, then Y, resolving solids after each axis so the player slides
    // along a wall instead of sticking to it.
    p.x += nx * speed * dt;
    resolveSolids(p, level.solids);
    p.y += ny * speed * dt;
    resolveSolids(p, level.solids);
    // Footstep timing: slow sneaks step rarely, runs step often.
    const interval = p.sneaking ? 0.55 : p.running ? 0.26 : 0.38;
    p.stepTimer += dt;
    if (p.stepTimer >= interval) {
      p.stepTimer = 0;
      stepped = true;
    }
  } else {
    p.stepTimer = 0;
  }
  p.inShadow = pointInRects(p.x, p.y, level.shadows);
  p.inBush = pointInRects(p.x, p.y, level.bushes);
  return {
    stepped,
    noiseRadius: p.running && p.moving ? PLAYER.runNoiseRadius : 0,
  };
}

// Pick up anything the player is standing on. Returns what was collected.
export function collectAt(p, level) {
  const got = { ledger: false, coins: 0 };
  for (let i = 0; i < level.ledgers.length; i += 1) {
    const l = level.ledgers[i];
    if (!l.taken && Math.hypot(l.x - p.x, l.y - p.y) < 30) {
      l.taken = true;
      got.ledger = true;
    }
  }
  for (let i = 0; i < level.coins.length; i += 1) {
    const c = level.coins[i];
    if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y) < 26) {
      c.taken = true;
      got.coins += 1;
    }
  }
  return got;
}

// True when the player stands inside the exit doorway.
export function atExit(p, level) {
  const e = level.exit;
  return p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h;
}
