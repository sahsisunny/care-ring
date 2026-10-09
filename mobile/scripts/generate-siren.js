const fs = require('fs');
const path = require('path');

// Generate authentic emergency wailing siren audio in WAV format (PCM 16-bit 44.1kHz)
function generateSirenWav(durationSeconds = 4.0, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const numChannels = 1; // Mono for optimal APK size and loud speaker output
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // 'fmt ' chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample

  // 'data' chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Emergency Siren parameters:
  // Frequency oscillates smoothly between fMin (650Hz) and fMax (1250Hz)
  // Cycle period: 0.8 seconds (5 full wails in 4 seconds)
  const fMin = 650;
  const fMax = 1250;
  const cyclePeriod = 0.8;
  let phase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Normalized oscillation between 0 and 1 using sinusoidal cycle
    const cyclePos = (t % cyclePeriod) / cyclePeriod;
    // Smooth triangle/sine sweep for sharp, penetrating siren pitch
    const pitchMod = 0.5 * (1 - Math.cos(2 * Math.PI * cyclePos));
    const currentFreq = fMin + (fMax - fMin) * pitchMod;

    // Accumulate phase to avoid phase distortion during FM modulation
    phase += (2 * Math.PI * currentFreq) / sampleRate;

    // Harmonic richness: Fundamental + 2nd + 3rd harmonic for rich police/fire alarm texture
    const fundamental = Math.sin(phase);
    const harmonic2 = 0.35 * Math.sin(2 * phase);
    const harmonic3 = 0.15 * Math.sin(3 * phase);
    let sample = fundamental + harmonic2 + harmonic3;

    // Slight soft clipping for aggressive urgency and loudness
    sample = Math.max(-0.95, Math.min(0.95, sample * 0.85));

    // Convert to 16-bit signed integer (-32768 to 32767)
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

const wavBuffer = generateSirenWav(4.0, 44100);

// 1. Assets directory for in-app Expo AV playback
const soundsDir = path.join(__dirname, '..', 'assets', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}
const assetPath = path.join(soundsDir, 'siren.wav');
fs.writeFileSync(assetPath, wavBuffer);
console.log(`Generated in-app siren audio: ${assetPath} (${wavBuffer.length} bytes)`);

// 2. Android native res/raw directory for system notification channel
const androidResRaw = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw');
if (!fs.existsSync(androidResRaw)) {
  fs.mkdirSync(androidResRaw, { recursive: true });
}
const androidSoundPath = path.join(androidResRaw, 'siren.wav');
fs.writeFileSync(androidSoundPath, wavBuffer);
console.log(`Generated Android notification siren audio: ${androidSoundPath} (${wavBuffer.length} bytes)`);
