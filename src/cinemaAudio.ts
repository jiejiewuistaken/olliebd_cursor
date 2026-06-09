let audioContext: AudioContext | null = null;
let projectorHum: {
  stop: () => void;
} | null = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

export async function unlockCinemaAudio() {
  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
}

export function playProjectorStartup() {
  const context = getAudioContext();
  const now = context.currentTime;

  const click = context.createOscillator();
  const clickGain = context.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(180, now);
  click.frequency.exponentialRampToValueAtTime(70, now + 0.08);
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  click.connect(clickGain).connect(context.destination);
  click.start(now);
  click.stop(now + 0.14);

  const whir = context.createOscillator();
  const whirGain = context.createGain();
  whir.type = 'sawtooth';
  whir.frequency.setValueAtTime(42, now + 0.05);
  whir.frequency.linearRampToValueAtTime(58, now + 0.7);
  whirGain.gain.setValueAtTime(0.0001, now + 0.05);
  whirGain.gain.exponentialRampToValueAtTime(0.018, now + 0.18);
  whirGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  whir.connect(whirGain).connect(context.destination);
  whir.start(now + 0.05);
  whir.stop(now + 0.9);
}

export function startProjectorHum() {
  if (projectorHum) {
    return;
  }

  const context = getAudioContext();
  const bufferSize = 2 * context.sampleRate;
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  for (let index = 0; index < bufferSize; index += 1) {
    output[index] = (Math.random() * 2 - 1) * 0.35;
  }

  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 110;
  filter.Q.value = 0.7;

  const gain = context.createGain();
  gain.gain.value = 0.012;

  source.connect(filter).connect(gain).connect(context.destination);
  source.start();

  projectorHum = {
    stop: () => {
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4);
      window.setTimeout(() => {
        source.stop();
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      }, 450);
      projectorHum = null;
    },
  };
}

export function stopProjectorHum() {
  projectorHum?.stop();
}
