// Shadow Ledger — boot and the one loop. The world is plain data: a level, a
// player, four guards, a timer and a score. It advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one) and the renderer paints what
// is there. Screens: title, play, paused, caught, win.
//
// ?seed=N fixes the guard patrol phase. ?shot=start|play|alarm|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, GAME, STEP } from './config.js';
import { createLevel } from './level.js';
import { atExit, collectAt, createPlayer, updatePlayer } from './player.js';
import { createGuard, updateGuard, worstSuspicion } from './guards.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { ensureAudio, playAlert, playCaught, playClick, playFootstep, playPickup, playWin } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

/** Build a fresh world. The seed staggers each guard's starting waypoint so
// no two runs look identical, while a fixed seed replays identically. */
export function createWorld(seedValue) {
  const level = createLevel();
  const player = createPlayer(level.spawn);
  const guards = level.guardDefs.map((def, i) => {
    const g = createGuard(def, i);
    // Stagger: guard i starts one waypoint further along, every other run.
    const shift = (seedValue + i) % 2 === 0 ? 0 : 1;
    if (shift && def.waypoints.length > 1) {
      g.waypointIndex = 1 % def.waypoints.length;
      const wp = def.waypoints[g.waypointIndex];
      g.x = wp.x;
      g.y = wp.y;
    }
    return g;
  });
  return {
    level,
    player,
    guards,
    seed: seedValue,
    time: 0,
    score: 0,
    coins: 0,
    ledgersTaken: 0,
    status: 'playing',
    worstSuspicion: 0,
    alarmed: false,
    noise: null,
    onAlert: null,
  };
}

export function resetWorld(world) {
  const fresh = createWorld(world.seed);
  // Keep the same object identity so the renderer and shots keep working.
  world.level = fresh.level;
  world.player = fresh.player;
  world.guards = fresh.guards;
  world.time = 0;
  world.score = 0;
  world.coins = 0;
  world.ledgersTaken = 0;
  world.status = 'playing';
  world.worstSuspicion = 0;
  world.alarmed = false;
  world.noise = null;
}

/** One fixed step of the real rules. `move` is {x, y} in -1..1. Returns an
// event string: 'caught', 'won', 'ledger', 'coin', or null. */
export function stepWorld(world, dt, move, sneak, run) {
  if (world.status !== 'playing') return null;
  world.time += dt;

  const report = updatePlayer(world.player, move, sneak, run, dt, world.level);
  if (report.stepped) playFootstep(world.player.sneaking);
  world.noise = report.noiseRadius > 0
    ? { x: world.player.x, y: world.player.y, radius: report.noiseRadius }
    : null;

  const got = collectAt(world.player, world.level);
  if (got.ledger) {
    world.ledgersTaken += 1;
    world.score += 250;
    playPickup(true);
  }
  if (got.coins > 0) {
    world.coins += got.coins;
    world.score += GAME.coinScore * got.coins;
    playPickup(false);
  }

  for (const g of world.guards) {
    if (updateGuard(g, dt, world) === 'caught') {
      world.status = 'caught';
      playCaught();
      return 'caught';
    }
  }
  world.noise = null;

  const alert = worstSuspicion(world.guards);
  world.worstSuspicion = alert.worst;
  world.alarmed = alert.alarmed;

  if (world.ledgersTaken >= GAME.ledgersToWin && atExit(world.player, world.level)) {
    world.status = 'won';
    world.score += Math.max(0, GAME.parSeconds - Math.floor(world.time)) * 5;
    playWin();
    return 'won';
  }
  if (got.ledger) return 'ledger';
  if (got.coins > 0) return 'coin';
  return null;
}

const world = createWorld(seed);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  world.onAlert = () => playAlert();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    ensureAudio();
    playClick();
    resetWorld(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal 3 ledgers and reach the exit unseen.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_CAUGHT;
    if (won) {
      const ms = Math.round(world.time * 1000);
      if (best === 0 || ms < best) {
        best = ms;
        saveBest(best);
      }
    }
    announce(won ? `Clean getaway in ${world.time.toFixed(1)} seconds.` : 'Caught. Press Space to try again.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the guards patrol behind the title card.
      stepWorld(world, STEP, { x: 0, y: 0 }, false, false);
      return;
    }
    const event = stepWorld(world, STEP, input.direction(), input.sneaking(), input.running());
    if (event === 'caught') endGame(false);
    else if (event === 'won') endGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadow Ledger. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
