// Shadow Ledger — the manor. One level, hand-placed: stone walls that split the
// floor into rooms with door gaps, crates to duck behind, dark shadow patches
// that slow detection, and bushes that hide a crouched thief. Three ledgers
// are spread across the rooms and the exit is the manor door, top right.
// Every coordinate was picked so each room is reachable on foot.
import { VIEW } from './config.js';

const W = VIEW.width;
const H = VIEW.height;

// A solid rectangle: { x, y, w, h, kind } — kind 'wall' or 'crate'. Both block
// movement and sight; crates are just lower and drawn differently.
function rect(x, y, w, h, kind) {
  return { x, y, w, h, kind };
}

export function createLevel() {
  const solids = [
    // Outer shell.
    rect(0, 0, W, 24, 'wall'),
    rect(0, H - 24, W, 24, 'wall'),
    rect(0, 0, 24, H, 'wall'),
    rect(W - 24, 0, 24, H, 'wall'),
    // West wall, upper half: gap at the top (y 24..120) is the door into the
    // north-west room where the first ledger waits.
    rect(420, 120, 24, 180, 'wall'),
    // West wall, lower half: gap y 300..420 is the door between the
    // south-west rooms and the hall.
    rect(420, 420, 24, 252, 'wall'),
    // North-east wall: separates the top-right room; pass underneath it.
    rect(840, 300, 416, 24, 'wall'),
    // South-west wall: separates the bottom-left room; the gap x 300..420
    // is the door out of the spawn room into the middle-west hall.
    rect(24, 460, 276, 24, 'wall'),
    // East wall, lower half: gap y 324..460 is the door into the
    // south-east room where the third ledger waits.
    rect(840, 460, 24, 212, 'wall'),
    // Crates — low cover that still blocks a guard's line of sight.
    rect(560, 110, 64, 56, 'crate'),
    rect(700, 520, 72, 52, 'crate'),
    rect(180, 180, 60, 60, 'crate'),
    rect(950, 170, 60, 60, 'crate'),
    rect(300, 580, 72, 52, 'crate'),
    rect(1060, 420, 60, 60, 'crate'),
    rect(620, 250, 56, 56, 'crate'),
  ];

  // Dark patches: standing in one halves how fast a guard's suspicion fills.
  const shadows = [
    { x: 500, y: 70, w: 190, h: 110 },
    { x: 900, y: 500, w: 190, h: 120 },
    { x: 70, y: 360, w: 140, h: 90 },
    { x: 620, y: 600, w: 170, h: 80 },
    { x: 1080, y: 80, w: 130, h: 90 },
  ];

  // Bushes: stand inside one and guards cannot spot you unless they are
  // almost on top of you.
  const bushes = [
    { x: 480, y: 520, w: 96, h: 64 },
    { x: 1000, y: 90, w: 96, h: 64 },
    { x: 240, y: 300, w: 88, h: 60 },
    { x: 700, y: 380, w: 88, h: 60 },
  ];

  // The three ledgers, one per corner room and one in the hall.
  const ledgers = [
    { x: 140, y: 110, taken: false },
    { x: 640, y: 380, taken: false },
    { x: 1140, y: 620, taken: false },
  ];

  // Six gold coins tucked along the quiet routes, for a score bonus.
  const coins = [
    { x: 90, y: 300, taken: false },
    { x: 540, y: 60, taken: false },
    { x: 760, y: 640, taken: false },
    { x: 1200, y: 380, taken: false },
    { x: 470, y: 340, taken: false },
    { x: 980, y: 270, taken: false },
  ];

  // The manor door, top right. It only opens once all three ledgers are held.
  const exit = { x: 1160, y: 44, w: 72, h: 56 };
  const spawn = { x: 92, y: 640 };

  // Guard routes. Each patrol stays clear of walls so a guard never has to
  // push through one: G1 the north hall, G2 the north-east room, G3 a loop
  // around the middle ledger, G4 the south hall.
  const guardDefs = [
    { waypoints: [{ x: 490, y: 180 }, { x: 900, y: 180 }] },
    { waypoints: [{ x: 1050, y: 90 }, { x: 1050, y: 260 }] },
    { waypoints: [{ x: 560, y: 340 }, { x: 760, y: 340 }, { x: 760, y: 440 }, { x: 560, y: 440 }] },
    { waypoints: [{ x: 500, y: 580 }, { x: 800, y: 580 }] },
  ];

  return { solids, shadows, bushes, ledgers, coins, exit, spawn, guardDefs };
}

// True when the point is inside any rectangle of the list.
export function pointInRects(x, y, list) {
  for (let i = 0; i < list.length; i += 1) {
    const r = list[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}
