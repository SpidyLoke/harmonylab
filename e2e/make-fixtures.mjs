// Generates test audio played into Chromium as a fake microphone.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 48000
const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((v, i) => buf.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, 44 + i * 2))
  return buf
}

/** Voice-like: harmonics, gentle vibrato. */
function voice(hz, seconds, vibratoCents = 20) {
  const partials = [1, 0.6, 0.4, 0.25, 0.15, 0.1]
  const sum = partials.reduce((a, b) => a + b, 0)
  const out = new Array(Math.round(SR * seconds))
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    const vib = Math.pow(2, (vibratoCents * Math.sin((2 * Math.PI * 5.5 * i) / SR)) / 1200)
    phase += (2 * Math.PI * hz * vib) / SR
    let v = 0
    partials.forEach((a, k) => (v += a * Math.sin(phase * (k + 1))))
    out[i] = (0.35 * v) / sum
  }
  return out
}

function noise(seconds, amp) {
  let seed = 7
  return Array.from({ length: Math.round(SR * seconds) }, () => {
    seed = (seed * 16807) % 2147483647
    return (seed / 2147483647 - 0.5) * 2 * amp
  })
}

mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'a3-voice.wav'), wav(voice(220, 8)))
writeFileSync(join(dir, 'c5-sharp20.wav'), wav(voice(523.25 * Math.pow(2, 20 / 1200), 8, 4)))
writeFileSync(join(dir, 'breath-noise.wav'), wav(noise(8, 0.08)))
console.log('fixtures written to', dir)
