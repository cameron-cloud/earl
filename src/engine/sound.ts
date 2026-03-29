let audioCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  delay: number = 0,
  volume: number = 0.3
) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + delay + duration / 1000
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration / 1000);
}

function playRisingChirp(
  startFreq: number,
  endFreq: number,
  duration: number,
  volume: number = 0.3
) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration / 1000);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

export function playHopSound(volume: number) {
  playTone(1000, 100, "sine", 0, volume);
  playTone(1200, 80, "sine", 0.12, volume);
}

export function playPickUpSound(volume: number) {
  playRisingChirp(800, 1400, 150, volume);
}

export function playDropSound(volume: number) {
  playTone(400, 200, "triangle", 0, volume * 0.5);
  playTone(600, 100, "sine", 0.1, volume * 0.3);
}

export function playBirthdaySound(volume: number) {
  playTone(800, 150, "sine", 0, volume);
  playTone(1000, 150, "sine", 0.15, volume);
  playTone(1200, 200, "sine", 0.3, volume);
}

export function playFootstep(volume: number) {
  playTone(300, 50, "triangle", 0, volume * 0.15);
}
