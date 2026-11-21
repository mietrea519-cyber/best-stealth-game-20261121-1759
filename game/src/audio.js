// Shadow Ledger — sound, synthesized with WebAudio, no audio files. The
// context is created lazily on the first user gesture (browsers block audio
// before that), and every call is guarded so the game still runs in a silent
// environment such as a headless screenshot run.
let ctx = null;
let master = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  try {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  if (!ctx || !master) return;
  try {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // A failed blip must never break the game loop.
  }
}

function noiseBurst(dur, vol, lowpass) {
  if (!ctx || !master) return;
  try {
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  } catch {
    // Ignore, as above.
  }
}

// A soft carpeted footstep; quieter and lower while sneaking.
export function playFootstep(sneaking) {
  if (sneaking) noiseBurst(0.07, 0.10, 500);
  else noiseBurst(0.09, 0.22, 900);
}

// A bright two-note chime for a ledger or a coin.
export function playPickup(ledger) {
  if (ledger) {
    tone(660, 0.14, 'sine', 0.5);
    tone(990, 0.22, 'sine', 0.5, 0.09);
    tone(1320, 0.3, 'sine', 0.35, 0.18);
  } else {
    tone(880, 0.1, 'triangle', 0.35);
    tone(1174, 0.16, 'triangle', 0.3, 0.06);
  }
}

// A short dissonant sting the moment a guard gives chase.
export function playAlert() {
  tone(220, 0.35, 'sawtooth', 0.4, 0, 110);
  tone(233, 0.35, 'sawtooth', 0.4, 0, 116);
  noiseBurst(0.25, 0.25, 2400);
}

// A low thud for being caught, then a falling note.
export function playCaught() {
  tone(160, 0.4, 'sawtooth', 0.5, 0, 60);
  tone(98, 0.7, 'triangle', 0.5, 0.25, 49);
}

// A rising little fanfare for slipping out with all three ledgers.
export function playWin() {
  const notes = [523, 659, 784, 1047];
  for (let i = 0; i < notes.length; i += 1) tone(notes[i], 0.28, 'triangle', 0.45, i * 0.11);
}

// A soft click for menu confirms.
export function playClick() {
  tone(700, 0.06, 'square', 0.15);
}
