// Microphone access with the browser's voice-call processing switched off.
// Echo cancellation, noise suppression and auto gain all bend pitch and
// volume, which wrecks detection, so we ask for the raw signal.

export type MicErrorKind = 'insecure' | 'unsupported' | 'denied' | 'notFound' | 'busy' | 'disconnected' | 'unknown'

export class MicError extends Error {
  readonly kind: MicErrorKind
  constructor(kind: MicErrorKind, message?: string) {
    super(message ?? kind)
    this.kind = kind
  }
}

export const RAW_VOICE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
}

export async function openMic(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) throw new MicError('insecure')
  if (!navigator.mediaDevices?.getUserMedia) throw new MicError('unsupported')
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: RAW_VOICE_CONSTRAINTS, video: false })
  } catch (err) {
    throw toMicError(err)
  }
}

export function toMicError(err: unknown): MicError {
  if (err instanceof MicError) return err
  const name = (err as { name?: string })?.name ?? ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new MicError('denied')
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new MicError('notFound')
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new MicError('busy')
    default:
      return new MicError('unknown', String((err as Error)?.message ?? err))
  }
}

/** Input latency the browser reports for the track, in seconds, where supported (Chrome). */
export function reportedInputLatency(stream: MediaStream): number | null {
  const track = stream.getAudioTracks()[0]
  const settings = track?.getSettings() as MediaTrackSettings & { latency?: number }
  return typeof settings?.latency === 'number' ? settings.latency : null
}
