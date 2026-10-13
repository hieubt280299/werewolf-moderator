/**
 * Optional sound cues synthesised with the Web Audio API — no audio files, no BGM.
 * Kept deliberately soft so they don't startle a dark room.
 */
export type SfxCue = 'wake' | 'sleep' | 'dawn' | 'death' | 'select' | 'vote';

let enabled = true;
let ctx: AudioContext | null = null;

export function setSfxEnabled(value: boolean) {
  enabled = value;
}

type Note = [freq: number, start: number, duration: number];

const CUES: Record<SfxCue, { type: OscillatorType; gain: number; notes: Note[] }> = {
  wake: { type: 'sine', gain: 0.12, notes: [[392, 0, 0.35], [523.25, 0.18, 0.5]] },
  sleep: { type: 'sine', gain: 0.1, notes: [[523.25, 0, 0.35], [392, 0.18, 0.6]] },
  dawn: { type: 'triangle', gain: 0.1, notes: [[392, 0, 0.3], [493.88, 0.15, 0.3], [587.33, 0.3, 0.7]] },
  death: { type: 'sawtooth', gain: 0.05, notes: [[146.83, 0, 0.6], [110, 0.25, 0.9]] },
  select: { type: 'sine', gain: 0.06, notes: [[880, 0, 0.08]] },
  vote: { type: 'square', gain: 0.04, notes: [[220, 0, 0.12], [220, 0.16, 0.12]] },
};

export function playCue(cue: SfxCue) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const { type, gain, notes } = CUES[cue];
    const now = ctx.currentTime;
    for (const [freq, start, duration] of notes) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0, now + start);
      amp.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    }
  } catch {
    /* audio is a nicety; never break the game for it */
  }
}
