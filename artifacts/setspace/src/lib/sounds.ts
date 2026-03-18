let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone(
  freq: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine"
) {
  const c = getCtx();
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
  } catch {
    /* silently fail if audio is not available */
  }
}

export function playNotificationSound() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    playTone(660, now, 0.15, 0.20);
    playTone(880, now + 0.12, 0.15, 0.18);
    playTone(1108, now + 0.22, 0.25, 0.15);
  } catch {
    /* silently fail if audio is not available */
  }
}
