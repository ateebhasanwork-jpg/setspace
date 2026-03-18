let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Call once — wires a one-time user-gesture handler to unlock the AudioContext. */
export function initAudio() {
  const unlock = async () => {
    if (unlocked) return;
    try {
      const c = getCtx();
      // Play a silent buffer to satisfy the browser's autoplay policy
      const buf = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
      await c.resume();
      unlocked = true;
    } catch { /* best-effort */ }
    document.removeEventListener("click", unlock);
    document.removeEventListener("keydown", unlock);
    document.removeEventListener("pointerdown", unlock);
  };
  document.addEventListener("click", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });
  document.addEventListener("pointerdown", unlock, { once: true });
}

function playTone(
  freq: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine"
) {
  const c = getCtx();
  if (!unlocked && c.state !== "running") return;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.connect(env);
  env.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playMessageSound() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    playTone(880, now, 0.18, 0.25);
    playTone(1108, now + 0.09, 0.22, 0.20);
  } catch { /* silently fail */ }
}

export function playNotificationSound() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    playTone(660, now, 0.15, 0.20);
    playTone(880, now + 0.12, 0.15, 0.18);
    playTone(1108, now + 0.22, 0.25, 0.15);
  } catch { /* silently fail */ }
}
