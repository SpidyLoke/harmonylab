// One AudioContext for the whole app. The mic analysis and every guide tone
// share its clock, so scoring compares like with like.

import * as Tone from 'tone'

let ctx: AudioContext | null = null

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

export function getAudioContext(): AudioContext {
  if (!ctx) {
    // Safari 17+: tell iOS we both play and record, so output is not ducked
    // to the earpiece and the mic stays live.
    const nav = navigator as AudioSessionNavigator
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'play-and-record'
      } catch {
        /* older WebKit: ignore */
      }
    }
    ctx = new AudioContext({ latencyHint: 'interactive' })
    Tone.setContext(ctx)
  }
  return ctx
}

/**
 * Must be called from a tap or click. iOS Safari keeps audio locked until a
 * user gesture both resumes the context and starts a sound.
 */
export async function unlockAudio(): Promise<AudioContext> {
  const c = getAudioContext()
  // Kick a silent one-sample buffer through the graph inside the gesture.
  const buffer = c.createBuffer(1, 1, c.sampleRate)
  const src = c.createBufferSource()
  src.buffer = buffer
  src.connect(c.destination)
  src.start()
  if (c.state !== 'running') await c.resume()
  await Tone.start()
  return c
}

export function audioContextIfCreated(): AudioContext | null {
  return ctx
}
