// Main-thread side of the pitch pipeline: opens the mic, runs the analysis
// processor on the audio thread, gates out breaths and noise, smooths the
// result and keeps a short history the pitch lane draws from.
//
// High-rate data (≈190 readings a second) lives here, outside React state,
// so the UI never re-renders per reading.

import workletUrl from './pitch.worklet.ts?worker&url'
import { getAudioContext, unlockAudio } from './context'
import { openMic, reportedInputLatency, toMicError, type MicErrorKind } from './mic'
import { MedianSmoother } from './smoothing'
import { BLOCK_SIZE, HOP_BLOCKS, windowSizeFor } from './pitchCore'
import type { WorkletFrame } from './pitch.worklet'
import { hzToMidi } from '../music/notes'

export type EngineStatus = 'idle' | 'starting' | 'running' | 'paused' | 'error'

export interface EngineState {
  status: EngineStatus
  error: MicErrorKind | null
  /** Browser's own error name and message, shown in small print for troubleshooting. */
  detail: string | null
}

export interface GateSettings {
  /** Minimum McLeod clarity to count as voice. Breaths and hiss score low. */
  minClarity: number
  /** Minimum loudness in dBFS. */
  minDb: number
}

export const DEFAULT_GATE: GateSettings = { minClarity: 0.88, minDb: -50 }

export interface LiveFrame {
  /** Audio-clock time at the centre of the analysed window, seconds. */
  t: number
  /** Smoothed pitch as fractional MIDI, or null when not singing. */
  midi: number | null
  rawHz: number
  clarity: number
  db: number
}

export interface LatencyBreakdown {
  inputMs: number | null
  analysisMs: number
  deliveryMs: number
  drawMs: number
  totalMs: number
  readingsPerSecond: number
}

const HISTORY = 4096 // ≈ 20 s of readings

export class PitchEngine {
  private state: EngineState = { status: 'idle', error: null, detail: null }
  private listeners = new Set<(s: EngineState) => void>()

  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioWorkletNode | null = null
  private sink: GainNode | null = null
  private moduleLoaded = false

  private smoother = new MedianSmoother()
  gate: GateSettings = { ...DEFAULT_GATE }

  // Ring buffer of frames.
  private times = new Float64Array(HISTORY)
  private midis = new Float32Array(HISTORY)
  private count = 0
  private head = 0
  latest: LiveFrame | null = null
  private latestPerf = 0

  // Latency bookkeeping.
  private windowSeconds = 0.024
  private hopSeconds = (HOP_BLOCKS * BLOCK_SIZE) / 48000
  private deliveryAvg = 0
  private frameIntervalAvg = 1000 / 60
  private readingTimes: number[] = []

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility)
    }
  }

  getState(): EngineState {
    return this.state
  }

  subscribe(fn: (s: EngineState) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(status: EngineStatus, error: MicErrorKind | null = null, detail: string | null = null) {
    this.state = { status, error, detail }
    this.listeners.forEach((fn) => fn(this.state))
  }

  /** Call from a tap or click (iOS needs the gesture). */
  async start(): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting') return
    if (this.state.status === 'paused' && this.node) return this.resume()
    this.set('starting')
    try {
      const ctx = await unlockAudio()
      if (!this.moduleLoaded) {
        await ctx.audioWorklet.addModule(workletUrl)
        this.moduleLoaded = true
      }
      this.stream = await openMic()
      const track = this.stream.getAudioTracks()[0]
      track.addEventListener('ended', this.onTrackEnded)
      track.addEventListener('mute', this.onTrackMute)
      track.addEventListener('unmute', this.onTrackUnmute)

      this.source = ctx.createMediaStreamSource(this.stream)
      this.node = new AudioWorkletNode(ctx, 'hl-pitch', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      this.node.port.onmessage = this.onMessage
      // Some browsers (Safari) only run a processor that reaches the speakers,
      // so route it through a muted gain. Nothing is audible.
      this.sink = ctx.createGain()
      this.sink.gain.value = 0
      this.source.connect(this.node).connect(this.sink).connect(ctx.destination)

      this.windowSeconds = windowSizeFor(ctx.sampleRate) / ctx.sampleRate
      this.hopSeconds = (HOP_BLOCKS * BLOCK_SIZE) / ctx.sampleRate
      ctx.addEventListener('statechange', this.onContextState)
      this.set('running')
    } catch (err) {
      this.teardown()
      const e = toMicError(err)
      this.set('error', e.kind, e.detail)
    }
  }

  stop(): void {
    this.teardown()
    this.set('idle')
  }

  /** Resume after a pause. Call from a tap so iOS allows it. */
  async resume(): Promise<void> {
    const ctx = getAudioContext()
    try {
      await ctx.resume()
    } catch {
      /* stays paused */
    }
    if (ctx.state === 'running' && this.stream?.active) {
      this.smoother.reset()
      this.set('running')
    } else if (!this.stream?.active) {
      this.teardown()
      this.set('error', 'disconnected')
    }
  }

  private pause() {
    if (this.state.status !== 'running') return
    this.smoother.reset()
    this.set('paused')
  }

  private teardown() {
    this.stream?.getTracks().forEach((t) => {
      t.removeEventListener('ended', this.onTrackEnded)
      t.removeEventListener('mute', this.onTrackMute)
      t.removeEventListener('unmute', this.onTrackUnmute)
      t.stop()
    })
    this.source?.disconnect()
    this.node?.disconnect()
    this.sink?.disconnect()
    if (this.node) this.node.port.onmessage = null
    this.stream = null
    this.source = null
    this.node = null
    this.sink = null
    this.smoother.reset()
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (this.state.status === 'running') {
        this.pause()
        void getAudioContext().suspend()
      }
    } else if (this.state.status === 'paused') {
      // Desktop browsers allow this without a tap; iOS may not, in which
      // case the UI shows a "tap to carry on" button.
      void this.resume()
    }
  }

  private onContextState = () => {
    const s = getAudioContext().state as AudioContextState | 'interrupted'
    if ((s === 'suspended' || s === 'interrupted') && this.state.status === 'running') this.pause()
  }

  private onTrackEnded = () => {
    this.teardown()
    this.set('error', 'disconnected')
  }

  private onTrackMute = () => this.pause()
  private onTrackUnmute = () => {
    if (this.state.status === 'paused' && document.visibilityState === 'visible') void this.resume()
  }

  private onMessage = (e: MessageEvent<WorkletFrame | { type: 'ready' }>) => {
    const d = e.data
    if (!('t' in d)) return
    if (this.state.status !== 'running') return

    const voiced = d.hz > 0 && d.clarity >= this.gate.minClarity && d.db >= this.gate.minDb
    const midi = this.smoother.push(voiced ? hzToMidi(d.hz) : null)
    const t = d.t - this.windowSeconds / 2

    this.times[this.head] = t
    this.midis[this.head] = midi ?? NaN
    this.head = (this.head + 1) % HISTORY
    this.count = Math.min(HISTORY, this.count + 1)

    const now = performance.now()
    this.latest = { t, midi, rawHz: d.hz, clarity: d.clarity, db: d.db }
    this.latestPerf = now

    // Delivery delay: how far the audio clock has moved on since the window ended.
    const ctx = getAudioContext()
    const delivery = Math.max(0, (ctx.currentTime - d.t) * 1000)
    this.deliveryAvg = this.deliveryAvg * 0.95 + delivery * 0.05
    this.readingTimes.push(now)
    while (this.readingTimes.length && this.readingTimes[0] < now - 1000) this.readingTimes.shift()
  }

  /** The audio-clock "now" for drawing, interpolated between readings. */
  displayNow(): number {
    if (!this.latest) return 0
    const since = (performance.now() - this.latestPerf) / 1000
    return this.latest.t + Math.min(since, 0.1)
  }

  /** Visit frames newer than `since`, oldest first. */
  forEachSince(since: number, fn: (t: number, midi: number) => void): void {
    const start = (this.head - this.count + HISTORY) % HISTORY
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % HISTORY
      const t = this.times[idx]
      if (t >= since) fn(t, this.midis[idx])
    }
  }

  /** Called by the pitch lane each frame so draw time is part of the estimate. */
  noteDrawInterval(ms: number): void {
    if (ms > 0 && ms < 200) this.frameIntervalAvg = this.frameIntervalAvg * 0.9 + ms * 0.1
  }

  /**
   * Estimated voice-to-screen delay. Input latency is what the browser reports
   * (Chrome only). Analysis is half the window plus half a hop. Draw is half a
   * display frame plus one frame for the compositor. Phase 2 adds a measured
   * calibration on top of this.
   */
  latency(): LatencyBreakdown {
    const input = this.stream ? reportedInputLatency(this.stream) : null
    const inputMs = input === null ? null : input * 1000
    const analysisMs = (this.windowSeconds / 2 + this.hopSeconds / 2) * 1000
    const deliveryMs = this.deliveryAvg
    const drawMs = this.frameIntervalAvg * 1.5
    return {
      inputMs,
      analysisMs,
      deliveryMs,
      drawMs,
      totalMs: (inputMs ?? 0) + analysisMs + deliveryMs + drawMs,
      readingsPerSecond: this.readingTimes.length,
    }
  }

  sampleRate(): number | null {
    return this.node ? getAudioContext().sampleRate : null
  }
}

export const pitchEngine = new PitchEngine()
