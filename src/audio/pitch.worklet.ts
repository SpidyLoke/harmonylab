// Runs on the browser's real-time audio thread. Keeps a rolling window of mic
// samples, analyses it every few milliseconds and posts the reading to the UI.
// Nothing here touches the network; samples are discarded once analysed.

import { HOP_BLOCKS, PitchCore } from './pitchCore'

// AudioWorkletGlobalScope is not in TypeScript's DOM lib.
declare const sampleRate: number
declare const currentTime: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

/** Message sent to the main thread for every reading. */
export interface WorkletFrame {
  /** Audio-clock time (seconds) at the end of the analysed window. */
  t: number
  hz: number
  clarity: number
  db: number
}

class PitchProcessor extends AudioWorkletProcessor {
  private core = new PitchCore(sampleRate)
  private blocks = 0

  constructor() {
    super()
    this.port.postMessage({ type: 'ready', sampleRate, windowSize: this.core.windowSize })
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true
    this.core.push(channel)
    this.blocks++
    if (this.blocks >= HOP_BLOCKS && this.core.ready) {
      this.blocks = 0
      const r = this.core.analyse()
      const frame: WorkletFrame = { t: currentTime + channel.length / sampleRate, ...r }
      this.port.postMessage(frame)
    }
    return true
  }
}

registerProcessor('hl-pitch', PitchProcessor)
