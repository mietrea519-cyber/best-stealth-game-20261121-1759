// Shadow Ledger — the guards. Each one walks its waypoints, looks around with
// a vision cone, and keeps a suspicion meter for the player:
//   calm       — patrolling, suspicion draining.
//   suspicious — saw something briefly: stops, stares at the last seen spot.
//   alarmed    — suspicion full: chases the player until sight is lost.
//   search     — lost the player while chasing: checks the last seen spot,
//                then walks back to its route and calms down.
// Noise (a running player) also makes a calm guard suspicious and sends it
// to investigate the sound.
import { GUARD } from './config.js';
import { hasLineOfSight, inCone } from './vision.js';

export function createGuard(def, index) {
  const start = def.waypoints[0];
  const second = def.waypoints[1] ?? start;
  return {
    index,
    x: start.x,
    y: start.y,
    radius: GUARD.radius,
    angle: Math.atan2(second.y - start.y, second.x - start.x),
    waypoints: def.waypoints,
    waypointIndex: 1 % def.waypoints.length,
    state: 'calm',
    suspicion: 0,
    lastSeen: null,
    loseTimer: 0,
    stareTimer: 0,
    searchTimer: 0,
    investigate: null,
  };
}

function angleTowards(g, tx, ty) {
  return Math.atan2(ty - g.y, tx - g.x);
}

// Turn toward `target` at most `rate` radians per second; returns true when
// the guard is now facing it.
function turnTowards(g, target, rate, dt) {
  let diff = target - g.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  g.angle += step;
  return Math.abs(diff - step) < 0.02;
}

function moveTowards(g, tx, ty, speed, dt, solids) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  g.x += (dx / dist) * step;
  g.y += (dy / dist) * step;
  // Guards patrol open floor, so a nudge out of a solid is enough; they are
  // never asked to path around a wall.
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    const cx = Math.max(r.x, Math.min(g.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(g.y, r.y + r.h));
    const ox = g.x - cx;
    const oy = g.y - cy;
    const d2 = ox * ox + oy * oy;
    if (d2 < g.radius * g.radius && d2 > 0) {
      const d = Math.sqrt(d2);
      g.x = cx + (ox / d) * g.radius;
      g.y = cy + (oy / d) * g.radius;
    }
  }
  return dist - step < 2;
}

// Can this guard see the player right now? Range, cone angle, a clear line,
// and the player's cover all matter.
export function guardSeesPlayer(g, player, level) {
  const seen = inCone(g.x, g.y, g.angle, GUARD.visionRange, GUARD.halfFov, player.x, player.y);
  if (!seen.inside) return { sees: false, dist: seen.dist };
  if (!hasLineOfSight(g.x, g.y, player.x, player.y, level.solids)) return { sees: false, dist: seen.dist };
  // A bush hides the player unless the guard is almost touching them.
  if (player.inBush && seen.dist > GUARD.bushRevealDistance) return { sees: false, dist: seen.dist };
  return { sees: true, dist: seen.dist };
}

// How fast suspicion fills while the player is seen: closer is worse,
// sneaking and darkness both slow it down.
function fillRate(g, player, dist) {
  const closeness = 1 - dist / GUARD.visionRange;
  let rate = GUARD.fillPerSecondFar + (GUARD.fillPerSecondClose - GUARD.fillPerSecondFar) * closeness;
  if (player.sneaking) rate *= GUARD.sneakMultiplier;
  if (player.inShadow) rate *= GUARD.shadowMultiplier;
  return rate;
}

// One guard, one step. `world` carries the player, the level and the noise
// the player just made ({x, y, radius} or null). Returns 'caught' when this
// guard reaches the player while alarmed, else null.
export function updateGuard(g, dt, world) {
  const { player, level } = world;
  const seen = guardSeesPlayer(g, player, level);

  if (seen.sees) {
    g.lastSeen = { x: player.x, y: player.y };
    g.loseTimer = 0;
    g.suspicion = Math.min(1, g.suspicion + fillRate(g, player, seen.dist) * dt);
  } else {
    g.suspicion = Math.max(0, g.suspicion - GUARD.drainPerSecond * dt);
  }

  if (g.suspicion >= GUARD.alarmedAt && g.state !== 'alarmed') {
    g.state = 'alarmed';
    g.investigate = null;
    world.onAlert?.(g);
  } else if (g.suspicion >= GUARD.suspiciousAt && g.state === 'calm') {
    // Spotted something: stop patrolling and stare at where it was seen.
    g.state = 'suspicious';
    g.stareTimer = GUARD.stareSeconds;
  }

  // A loud noise pulls a calm guard over to listen.
  if (world.noise && g.state === 'calm') {
    const d = Math.hypot(world.noise.x - g.x, world.noise.y - g.y);
    if (d < world.noise.radius) {
      g.state = 'suspicious';
      g.stareTimer = GUARD.stareSeconds;
      g.investigate = { x: world.noise.x, y: world.noise.y };
      g.lastSeen = { x: world.noise.x, y: world.noise.y };
    }
  }

  if (g.state === 'alarmed') {
    if (seen.sees) {
      g.loseTimer = 0;
    } else {
      g.loseTimer += dt;
      if (g.loseTimer > GUARD.loseSightSeconds) {
        g.state = 'search';
        g.searchTimer = 2.2;
      }
    }
    // Chase the player's live position while seen, else the last seen spot.
    const target = seen.sees ? player : g.lastSeen ?? player;
    turnTowards(g, angleTowards(g, target.x, target.y), 6, dt);
    moveTowards(g, target.x, target.y, GUARD.chaseSpeed, dt, level.solids);
    if (Math.hypot(player.x - g.x, player.y - g.y) < 26) return 'caught';
    return null;
  }

  if (g.state === 'suspicious') {
    // Stare at the spot — either because the meter is high or because a
    // noise sent this guard to listen. A mere glimpse fades: if the meter
    // drops back down and there is no noise to check, go back to patrol.
    if (g.suspicion >= GUARD.suspiciousAt || g.investigate) {
      const spot = g.lastSeen ?? { x: player.x, y: player.y };
      if (turnTowards(g, angleTowards(g, spot.x, spot.y), 4, dt)) {
        g.stareTimer -= dt;
      }
      if (g.stareTimer <= 0) {
        if (g.investigate) {
          g.state = 'search';
          g.searchTimer = 2.5;
        } else {
          g.state = 'calm';
        }
      }
    } else {
      g.state = 'calm';
    }
    return null;
  }

  if (g.state === 'search') {
    const spot = g.investigate ?? g.lastSeen;
    if (spot) {
      turnTowards(g, angleTowards(g, spot.x, spot.y), 4, dt);
      const arrived = moveTowards(g, spot.x, spot.y, GUARD.returnSpeed, dt, level.solids);
      if (arrived) {
        g.searchTimer -= dt;
        if (g.searchTimer <= 0) {
          g.state = 'calm';
          g.investigate = null;
        }
      }
    } else {
      g.state = 'calm';
    }
    return null;
  }

  // Calm: walk the waypoints, pausing a beat at each one to look around.
  const target = g.waypoints[g.waypointIndex];
  if (turnTowards(g, angleTowards(g, target.x, target.y), 5, dt)) {
    const arrived = moveTowards(g, target.x, target.y, GUARD.patrolSpeed, dt, level.solids);
    if (arrived) g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
  }
  return null;
}

// The worst suspicion across all guards — what the HUD's alert bar shows.
export function worstSuspicion(guards) {
  let worst = 0;
  let alarmed = false;
  for (let i = 0; i < guards.length; i += 1) {
    worst = Math.max(worst, guards[i].suspicion);
    if (guards[i].state === 'alarmed') alarmed = true;
  }
  return { worst, alarmed };
}
