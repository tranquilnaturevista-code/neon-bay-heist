// Synthesised sound only: every effect and the music are built with WebAudio oscillators
// and noise, so the game ships no audio files and loads nothing over the network. The
// audio context starts on the first user gesture; M mutes everything.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Call from any user gesture: unlocks audio and starts the engine + music loops. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
    startEngine();
    startSiren();
    startMusic();
  }

  function startEngine() {
    if (engineOsc) return;
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (sirenOsc) return;
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    const lfo = context.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    lfo.start();
  }

  // A slow sunset bassline: A minor, one note a beat, with a soft hat tick on the off-beat.
  const BASS = [55, 0, 55, 65.41, 0, 49, 0, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 0];
  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !context) return;
      const note = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (note > 0) {
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = note;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.14, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.42);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(context.currentTime + 0.45);
      }
    }, 300);
  }

  function blip(frequency, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, volume, lowpass) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock,
    /** The engine follows the driven car's speed; silent on foot. */
    setEngine(speed, driving) {
      if (!context || !engineOsc) return;
      const target = driving ? 0.05 + Math.min(0.11, Math.abs(speed) / 560 * 0.11) : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.16, context.currentTime, 0.08);
    },
    /** The siren swells with the wanted level. */
    setSiren(wanted) {
      if (!context || !sirenOsc) return;
      sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.035 + wanted * 0.008 : 0, context.currentTime, 0.3);
    },
    punch() {
      noise(0.12, 0.5, 900);
      blip(140, 0.1, 'sine', 0.4, 60);
    },
    crash() {
      noise(0.3, 0.7, 500);
      blip(90, 0.25, 'sine', 0.5, 40);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.35);
      window.setTimeout(() => blip(1318, 0.18, 'sine', 0.35), 90);
    },
    click() {
      blip(660, 0.06, 'square', 0.12);
    },
    door() {
      noise(0.08, 0.3, 1400);
    },
    busted() {
      blip(440, 0.5, 'sawtooth', 0.25, 110);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        window.setTimeout(() => blip(frequency, 0.22, 'triangle', 0.35), index * 110);
      });
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
