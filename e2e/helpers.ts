import { chromium, type Browser, type Page } from '@playwright/test'
import { join } from 'node:path'

export const fixture = (name: string) => join(process.cwd(), 'e2e', 'fixtures', name)
export const BASE = 'http://localhost:4173/#'

export async function launch(file: string | null = fixture('a3-voice.wav')): Promise<Browser> {
  const args = ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream']
  if (file) args.push('--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${file}`)
  // PW_CHROMIUM_PATH lets this run against a preinstalled Chromium.
  return chromium.launch({ args, executablePath: process.env.PW_CHROMIUM_PATH || undefined })
}

/** Opens the app with a set-up profile so tests can skip first-run setup. */
export async function openSetUp(browser: Browser, path: string, opts: { level?: number; range?: [number, number] } = {}): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/welcome`)
  await page.waitForFunction(() => (window as unknown as { __harmonylab?: unknown }).__harmonylab)
  await page.evaluate(async ({ level, range }) => {
    const { db } = (window as unknown as { __harmonylab: { db: { profile: { put: (r: unknown) => Promise<unknown> }; levels: { put: (r: unknown) => Promise<unknown> } } } }).__harmonylab
    await db.profile.put({ id: 'me', onboarded: true, rangeLow: range[0], rangeHigh: range[1], latencyMs: 0, latencyMethod: 'none', headphones: 'ok', placementLevel: level, createdAt: Date.now() })
    for (let l = 1; l <= level; l++) await db.levels.put({ level: l, unlocked: true, passed: false })
  }, { level: opts.level ?? 1, range: opts.range ?? [50, 70] })
  // Fresh load so the app reads the seeded profile from the start.
  await page.goto('about:blank')
  await page.goto(`${BASE}${path}`)
  return { page, errors }
}
