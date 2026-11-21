// Shadow Ledger — the screenshot scenes behind ?shot=start|play|alarm|end.
// Each one plays the real rules forward from a fresh world for a fixed time,
// steered by a simple autopilot (walk the room-to-room waypoints, wait when
// the next step would walk into a guard's cone, sneak when suspicion is
// climbing), so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { STEP } from './config.js';
import { resetWorld, stepWorld } from './main.js';
import { guardSeesPlayer } from './guards.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const END_LIMIT_SECONDS = 420;
const SAMPLE = STEP;

// The thief's route through the manor, door gap by door gap: east along the
// bottom, north through the south-west wall's gap, through the west-wall gap
// to the first ledger, back down, across the hall to the middle ledger,
// through the south-east gap to the third ledger, then around the west end
// of the north-east wall and up to the exit door.
const ROUTE = [
  { x: 400, y: 640 },
  { x: 400, y: 360 },
  { x: 470, y: 360 },
  { x: 470, y: 100 },
  { x: 140, y: 110 },
  { x: 470, y: 100 },
  { x: 470, y: 360 },
  { x: 640, y: 380 },
  { x: 900, y: 380 },
  { x: 1150, y: 380 },
  { x: 1140, y: 620 },
  { x: 1150, y: 380 },
  { x: 800, y: 380 },
  { x: 800, y: 100 },
  { x: 1150, y: 100 },
  { x: 1196, y: 72 },
];

// Would the player be spotted standing at (x, y)? Used to decide whether to
// wait: stepping into a cone is worse than waiting for the patrol to pass.
function wouldBeSeen(world, x, y) {
  const probe = { ...world.player, x, y };
  for (const g of world.guards) {
    if (guardSeesPlayer(g, probe, world.level).sees) return true;
  }
  return false;
}

// One autopilot step: steer toward the current waypoint, but only while no
// guard can see the next step. Seen: slip sideways out of the cone. Chased:
// run back to the previous waypoint, ground already proven safe. Suspicion
// high but unseen: freeze until it fades. Returns true when the route is
// finished.
function autopilotStep(world, route, state) {
  const target = route[state.index];
  if (!target) return true;
  const p = world.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 20) {
    state.index += 1;
    state.stuckTimer = 0;
    return state.index >= route.length;
  }
  // Stuck against a wall? Sidestep perpendicular for a second to slide free.
  if (Math.hypot(p.x - state.lastX, p.y - state.lastY) < 2) state.stuckTimer += STEP;
  else state.stuckTimer = 0;
  state.lastX = p.x;
  state.lastY = p.y;
  let mx = dx / dist;
  let my = dy / dist;
  if (state.stuckTimer > 1.2) {
    const side = state.sideStep > 0 ? 1 : -1;
    const tx = mx;
    mx = -my * side;
    my = tx * side;
    state.sideStep -= STEP;
    if (state.sideStep <= -1) {
      state.sideStep = 1;
      state.stuckTimer = 0;
    }
  }

  // 1. Chased: run back to the previous waypoint, ground already crossed
  // safely, until the hunter loses us and calms down.
  const chaser = world.guards.find((g) => g.state === 'alarmed');
  if (chaser) {
    const retreat = state.index > 0 ? route[state.index - 1] : world.level.spawn;
    const rx = retreat.x - p.x;
    const ry = retreat.y - p.y;
    const rd = Math.hypot(rx, ry) || 1;
    stepWorld(world, STEP, { x: rx / rd, y: ry / rd }, false, true);
    return false;
  }

  // 2. Spotted: slip sideways out of the cone — perpendicular to the
  // guard's facing, on the side that also moves away from the guard. The
  // patrol walks on and the suspicion fades; never run blindly away, that
  // is how a thief ends up cornered.
  const threat = nearestSeeingGuard(world);
  if (threat) {
    const g = threat.g;
    const px = -Math.sin(g.angle);
    const py = Math.cos(g.angle);
    const awayX = p.x - g.x;
    const awayY = p.y - g.y;
    const side = px * awayX + py * awayY >= 0 ? 1 : -1;
    stepWorld(world, STEP, { x: px * side, y: py * side }, true, false);
    return false;
  }

  // 3. Suspicion is climbing but nobody sees us now: freeze until it fades.
  if (world.worstSuspicion > 0.3) {
    stepWorld(world, STEP, { x: 0, y: 0 }, true, false);
    return false;
  }

  // 4. Wait out a patrol if the next step would be seen.
  const nextX = p.x + mx * 12;
  const nextY = p.y + my * 12;
  if (wouldBeSeen(world, nextX, nextY)) {
    stepWorld(world, STEP, { x: 0, y: 0 }, true, false);
    return false;
  }

  // 5. Otherwise advance, sneaking while any guard is at all suspicious.
  const sneak = world.worstSuspicion > 0.15;
  stepWorld(world, STEP, { x: mx, y: my }, sneak, false);
  return false;
}

// The closest guard that can see the player right now, if any.
function nearestSeeingGuard(world) {
  let best = null;
  for (const g of world.guards) {
    const seen = guardSeesPlayer(g, world.player, world.level);
    if (seen.sees && (best === null || seen.dist < best.dist)) best = { g, dist: seen.dist };
  }
  return best;
}

function newPilotState(world) {
  return { index: 0, lastX: world.player.x, lastY: world.player.y, stuckTimer: 0, sideStep: 1 };
}

/**
 * Set `world` to the named scene (start, play, alarm or end; any other name
 * is start) and return the screen to draw over it and the best time to show.
 */
export function stageShot(name, world) {
  resetWorld(world);
  if (name !== 'play' && name !== 'alarm' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      stepWorld(world, STEP, { x: 0, y: 0 }, false, false);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'alarm') {
    // Let the patrols settle, then drop the thief right in front of guard 0
    // and wait for the chase to start — the frame is taken the moment any
    // guard turns alarmed, before he can close the distance.
    for (let i = 0; i < 1 / STEP; i += 1) stepWorld(world, STEP, { x: 0, y: 0 }, false, false);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const g = world.guards[0];
      world.player.x = g.x + Math.cos(g.angle) * 110;
      world.player.y = g.y + Math.sin(g.angle) * 110;
      for (let i = 0; i < 6 / STEP; i += 1) {
        stepWorld(world, STEP, { x: 0, y: 0 }, false, false);
        if (world.status === 'caught') break;
        if (world.guards.some((guard) => guard.state === 'alarmed')) {
          return { screen: SCREEN_PLAY, best: 0 };
        }
      }
      if (world.status === 'caught') break;
      resetWorld(world);
      for (let i = 0; i < 1 / STEP; i += 1) stepWorld(world, STEP, { x: 0, y: 0 }, false, false);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'end') {
    const pilot = newPilotState(world);
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      if (world.status === 'won') break;
      if (world.status === 'caught') break;
      if (autopilotStep(world, ROUTE, pilot)) break;
    }
    if (world.status !== 'won') {
      // The autopilot could not finish the route in the time allowed: put
      // the thief at the door with all three ledgers and let the real win
      // check fire, so the frame is still a genuine win screen.
      for (const l of world.level.ledgers) l.taken = true;
      world.ledgersTaken = 3;
      world.status = 'playing';
      world.player.x = world.level.exit.x + world.level.exit.w / 2;
      world.player.y = world.level.exit.y + world.level.exit.h / 2;
      for (let i = 0; i < 3 / STEP && world.status !== 'won'; i += 1) {
        stepWorld(world, STEP, { x: 0, y: 0 }, false, false);
      }
    }
    return { screen: world.status === 'won' ? SCREEN_WIN : SCREEN_PLAY, best: Math.round(world.time * 1000) };
  }

  // play: sneak the opening of the route, then hold near the north hall
  // while the patrols sweep past — cones, cover and the exit all in frame.
  const pilot = newPilotState(world);
  const playRoute = ROUTE.slice(0, 5);
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    if (world.status !== 'playing') break;
    if (pilot.index >= playRoute.length) {
      stepWorld(world, STEP, { x: 0, y: 0 }, true, false);
    } else {
      autopilotStep(world, playRoute, pilot);
    }
  }
  return { screen: world.status === 'caught' ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
}
