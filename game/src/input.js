// Shadow Ledger — keyboard and mouse. Tracks which movement keys are held,
// and queues one-shot actions (confirm / pause) that the main loop consumes
// once per frame so a single press never fires twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const MOVE_KEYS = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;

  function onKeyDown(event) {
    if (MOVE_KEYS[event.code]) {
      held.add(event.code);
      event.preventDefault();
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.add(event.code);
    } else if (event.code === 'KeyR') {
      held.add(event.code);
    } else if (event.code === 'Space' || event.code === 'Enter') {
      queued |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'Escape' || event.code === 'KeyP') {
      queued |= ACTION_PAUSE;
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerDown() {
    // Clicking the canvas also confirms (start / restart), like Space.
    queued |= ACTION_CONFIRM;
  }

  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    // Normalised movement vector from the keys currently held.
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const m = MOVE_KEYS[code];
        if (m) {
          x += m.x;
          y += m.y;
        }
      }
      return { x, y };
    },
    sneaking() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    running() {
      return held.has('KeyR');
    },
    // Take and clear the queued one-shot actions.
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
