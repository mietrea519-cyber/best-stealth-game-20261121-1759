// Shadow Ledger — tuning constants. One place for every number that decides
// how the stealth feels: how far a guard can see, how fast suspicion grows,
// how loud running is. Nothing here touches the DOM or the canvas.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const BEST_KEY = 'shadow-ledger-best-ms';

export const PLAYER = {
  radius: 14,
  walkSpeed: 148,
  sneakSpeed: 92,
  runSpeed: 198,
  // Running is heard this far away; walking is silent, sneaking quieter still.
  runNoiseRadius: 190,
  // A guard this close catches the player outright.
  caughtDistance: 26,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 64,
  // A guard walks back to its route a little faster than it patrols.
  returnSpeed: 88,
  chaseSpeed: 172,
  visionRange: 265,
  // Half-angle of the vision cone, in radians (~38 degrees each side).
  halfFov: 0.66,
  // Suspicion 0..1. Fills while the player is seen, drains while hidden.
  fillPerSecondClose: 1.15,
  fillPerSecondFar: 0.42,
  drainPerSecond: 0.55,
  // Above this the guard stops and stares at where it saw you.
  suspiciousAt: 0.35,
  // At full suspicion the guard gives chase.
  alarmedAt: 1.0,
  // How long a guard stares before giving up and resuming its patrol.
  stareSeconds: 1.6,
  // Chase ends after this long without seeing the player.
  loseSightSeconds: 3.5,
  // Standing in a bush hides you unless a guard is almost on top of you.
  bushRevealDistance: 52,
  // Crouching and darkness each roughly halve how fast suspicion fills.
  sneakMultiplier: 0.45,
  shadowMultiplier: 0.5,
};

export const GAME = {
  ledgersToWin: 3,
  coinScore: 100,
  // Finishing fast is worth points: one point per whole second under 5 min.
  parSeconds: 300,
};
