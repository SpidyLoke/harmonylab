// Wraps any screen that needs the mic. Explains why before asking, shows a
// plain fix for every failure, and covers the screen when audio is paused.

import type { ReactNode } from 'react'
import { pitchEngine } from '../../audio/pitchEngine'
import type { MicErrorKind } from '../../audio/mic'
import { useEngineState } from '../../state/engine'
import { Button } from './Button'

const ERRORS: Record<MicErrorKind, { title: string; body: ReactNode }> = {
  denied: {
    title: 'The microphone is blocked',
    body: (
      <>
        <p>HarmonyLab can't hear you until the mic is allowed for this site.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>
            <b className="text-ink">iPhone or iPad:</b> tap <b>aA</b> in the address bar, then Website Settings,
            then Microphone, then Allow. Or Settings, Safari, Microphone.
          </li>
          <li>
            <b className="text-ink">Chrome or Edge:</b> tap the icon to the left of the address, then Permissions,
            then Microphone, then Allow.
          </li>
          <li>
            <b className="text-ink">Firefox:</b> click the crossed-out mic in the address bar and remove the block.
          </li>
        </ul>
        <p className="mt-3">Then reload the page.</p>
      </>
    ),
  },
  notFound: {
    title: 'No microphone found',
    body: <p>Plug in a headset with a mic, or check your device's mic is switched on, then try again.</p>,
  },
  busy: {
    title: 'Your microphone is busy',
    body: <p>Another app is probably using it: a call, Zoom, a voice recorder. Close that app and try again.</p>,
  },
  insecure: {
    title: 'This page needs a secure link',
    body: <p>Browsers only allow the mic on pages opened with https://. Open HarmonyLab from its https link.</p>,
  },
  unsupported: {
    title: "This browser can't use the mic",
    body: <p>Use a current version of Chrome, Safari, Edge or Firefox.</p>,
  },
  disconnected: {
    title: 'The microphone went away',
    body: <p>It was unplugged, switched or taken by another app. Check your mic and try again.</p>,
  },
  unknown: {
    title: 'Something stopped the microphone',
    body: <p>Try again. If it keeps happening, reload the page.</p>,
  },
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-3xl border border-line bg-surface/90 p-6 shadow-2xl backdrop-blur">
      {children}
    </div>
  )
}

export function MicGate({ children }: { children: ReactNode }) {
  const { status, error, detail } = useEngineState()

  if (status === 'idle') {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Let HarmonyLab hear you</h2>
        <p className="mt-3 text-muted">
          To show whether you're on the note, the app listens through your microphone and works out your pitch
          many times a second.
        </p>
        <p className="mt-3 text-muted">
          <b className="text-ink">Your voice stays on this device.</b> Nothing is recorded or uploaded. The sound is
          analysed and thrown away as you sing.
        </p>
        <Button variant="primary" className="mt-6 w-full" onClick={() => void pitchEngine.start()}>
          Turn on microphone
        </Button>
      </Card>
    )
  }

  if (status === 'starting') {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Waiting for permission…</h2>
        <p className="mt-3 text-muted">Your browser should be asking to use the microphone. Choose Allow.</p>
      </Card>
    )
  }

  if (status === 'error' && error) {
    const e = ERRORS[error]
    return (
      <Card>
        <h2 className="text-xl font-semibold" role="alert">
          {e.title}
        </h2>
        <div className="mt-3 text-ink/90">{e.body}</div>
        {detail && (
          <p className="mt-4 break-words font-mono text-xs text-muted" data-testid="mic-error-detail">
            Browser said: {detail}
          </p>
        )}
        <Button variant="primary" className="mt-6 w-full" onClick={() => void pitchEngine.start()}>
          Try again
        </Button>
      </Card>
    )
  }

  return (
    <div className="relative">
      {children}
      {status === 'paused' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-stage/80 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-lg font-semibold">Paused while you were away</p>
            <Button variant="primary" className="mt-4" onClick={() => void pitchEngine.resume()}>
              Tap to carry on
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
