
// Audio engine for Glacial Breath
// Uses Web Audio API to generate organic breathing sounds without external assets

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

// Initialize or resume the AudioContext
export const initAudio = async () => {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
};

// Create a buffer of white noise to be used as a source for wind/breath sounds
const getNoiseBuffer = (ctx: AudioContext) => {
  if (noiseBuffer) return noiseBuffer;
  const bufferSize = ctx.sampleRate * 2; // 2 seconds is enough to loop
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
};

export const playInhale = (durationMs: number) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const dur = durationMs / 1000;

  // 1. Air Sound (Filtered Noise) - "Filling up"
  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(audioCtx);
  noise.loop = true;
  
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.Q.value = 0.5; // Smooth filter
  
  const noiseGain = audioCtx.createGain();
  
  noise.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination);
  
  // Filter Automation: Opens up to simulate air rushing in
  noiseFilter.frequency.setValueAtTime(100, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(1500, t + dur); 
  
  // Volume Automation: Fade in and hold
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(0.15, t + dur * 0.3);
  noiseGain.gain.setValueAtTime(0.15, t + dur * 0.8);
  noiseGain.gain.linearRampToValueAtTime(0, t + dur); 
  
  noise.start(t);
  noise.stop(t + dur + 0.1);

  // 2. Tonal Guide (Subtle rising drone) - adds a musical "lift"
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(146.83, t); // D3
  osc.frequency.linearRampToValueAtTime(164.81, t + dur); // E3 (Lift)
  
  const oscGain = audioCtx.createGain();
  osc.connect(oscGain).connect(audioCtx.destination);
  
  oscGain.gain.setValueAtTime(0, t);
  oscGain.gain.linearRampToValueAtTime(0.08, t + dur * 0.5);
  oscGain.gain.linearRampToValueAtTime(0, t + dur);
  
  osc.start(t);
  osc.stop(t + dur + 0.1);
};

export const playExhale = (durationMs: number) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const dur = durationMs / 1000;

  // 1. Air Sound - "Releasing"
  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(audioCtx);
  noise.loop = true;
  
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.Q.value = 0.5;
  
  const noiseGain = audioCtx.createGain();
  
  noise.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination);
  
  // Filter Automation: Closes down
  noiseFilter.frequency.setValueAtTime(1500, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(100, t + dur); 
  
  // Volume Automation
  noiseGain.gain.setValueAtTime(0.15, t);
  noiseGain.gain.linearRampToValueAtTime(0, t + dur);
  
  noise.start(t);
  noise.stop(t + dur + 0.1);
  
  // 2. Tonal Guide (Subtle falling drone)
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(164.81, t); // E3
  osc.frequency.linearRampToValueAtTime(146.83, t + dur); // D3 (Fall)
  
  const oscGain = audioCtx.createGain();
  osc.connect(oscGain).connect(audioCtx.destination);
  
  oscGain.gain.setValueAtTime(0.08, t);
  oscGain.gain.linearRampToValueAtTime(0, t + dur);
  
  osc.start(t);
  osc.stop(t + dur + 0.1);
};

export const playBell = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    // Soft Bell Tone
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05); // Fast attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + 3.0); // Long decay
    
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 3.5);
    
    // Optional harmonic for richness
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, t); // C6
    
    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.05, t + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    
    osc2.connect(gain2).connect(audioCtx.destination);
    osc2.start(t);
    osc2.stop(t + 2.5);
};
