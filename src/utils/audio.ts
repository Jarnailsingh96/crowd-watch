// Web Audio API Synthesizer & Speech Engine for Festival Ops Control Center
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Tactical Radio Squelch & Click
 */
export function playRadioSquelch() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // White noise burst
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.Q.setValueAtTime(3.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);

  // Subsequent radio tone 'beep'
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1760, now + 0.08); // A6
  oscGain.gain.setValueAtTime(0.18, now + 0.08);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  osc.start(now + 0.08);
  osc.stop(now + 0.16);
}

/**
 * Early Warning Amber Chime
 */
export function playEarlyWarningTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.35);
}

/**
 * Powerful Multi-Tone Emergency Siren for Limit Breaches
 * Alternating high-low tactical klaxon sweep with punchy harmonics
 */
export function playCriticalAlarm() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // 5 alternating high-low pulses over ~1.8 seconds (authentic emergency warning siren)
  const tones = [
    { start: 0.00, end: 0.32, freq1: 960, freq2: 720 },
    { start: 0.35, end: 0.67, freq1: 640, freq2: 480 },
    { start: 0.70, end: 1.02, freq1: 960, freq2: 720 },
    { start: 1.05, end: 1.37, freq1: 640, freq2: 480 },
    { start: 1.40, end: 1.75, freq1: 1040, freq2: 800 }
  ];

  tones.forEach(({ start, end, freq1, freq2 }) => {
    // Primary siren oscillator
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq1, now + start);
    osc1.frequency.exponentialRampToValueAtTime(freq2, now + end);

    gain1.gain.setValueAtTime(0.4, now + start);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + end);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now + start);
    osc1.stop(now + end);

    // Harmonic undertone oscillator for emergency bass resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq1 / 2, now + start);
    osc2.frequency.exponentialRampToValueAtTime(freq2 / 2, now + end);

    gain2.gain.setValueAtTime(0.3, now + start);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + end);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + start);
    osc2.stop(now + end);
  });
}

/**
 * Subtle Interface Click
 */
export function playUiClick() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}
