// Plays generated audio into Chromium as the microphone and checks the app
// hears the right note through the real pipeline: mic, audio thread, gate,
// smoothing, readout.
import { chromium, expect, test, type Browser } from '@playwright/test'
import { join } from 'node:path'

const fixture = (name: string) => join(process.cwd(), 'e2e', 'fixtures', name)

async function launchWithMic(file: string | null): Promise<Browser> {
  const args = ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream']
  if (file) args.push('--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${file}`)
  else args.push('--deny-permission-prompts')
  // PW_CHROMIUM_PATH lets this run against a preinstalled Chromium.
  return chromium.launch({ args, executablePath: process.env.PW_CHROMIUM_PATH || undefined })
}

async function openPractice(browser: Browser) {
  const page = await browser.newPage()
  await page.goto('http://localhost:4173/#/practice')
  await page.getByRole('button', { name: 'Turn on microphone' }).click()
  return page
}

test('hears an A3 voice as A3 and in tune', async () => {
  const browser = await launchWithMic(fixture('a3-voice.wav'))
  const page = await openPractice(browser)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await expect(page.getByTestId('target-note')).toHaveText('A3')
  await expect(page.getByTestId('readout-note')).toHaveText('A3', { timeout: 10_000 })
  await expect(page.getByTestId('readout-state')).toContainText('In tune')
  const cents = Number((await page.getByTestId('readout-cents').innerText()).replace(/[^\d+-]/g, ''))
  expect(Math.abs(cents)).toBeLessThan(25)

  await page.getByRole('button', { name: 'Show engine details' }).click()
  await expect(async () => {
    const rate = Number(await page.getByTestId('readings-per-second').innerText())
    expect(rate).toBeGreaterThan(120)
  }).toPass({ timeout: 5_000 })
  console.log((await page.getByRole('region', { name: 'Engine details' }).innerText()).split('\n').slice(0, 14).join(' | '))

  // Guide sounds run on the shared audio clock without errors.
  await page.getByRole('button', { name: 'Hear it' }).click()
  await page.getByRole('radio', { name: 'Drone' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('radio', { name: 'None' }).click()
  expect(errors).toEqual([])
  await browser.close()
})

test('shows sharp at advanced strictness, in tune at beginner', async () => {
  const browser = await launchWithMic(fixture('c5-sharp20.wav'))
  const page = await openPractice(browser)
  await expect(page.getByTestId('readout-note')).toHaveText('C5', { timeout: 10_000 })
  await page.getByRole('button', { name: "Set to what I'm singing" }).click()
  await expect(page.getByTestId('target-note')).toHaveText('C5')
  await expect(page.getByTestId('readout-state')).toContainText('In tune')
  await page.getByRole('radio', { name: '±15' }).click()
  await expect(page.getByTestId('readout-state')).toContainText('A little high')
  await browser.close()
})

test('ignores breath-like noise', async () => {
  const browser = await launchWithMic(fixture('breath-noise.wav'))
  const page = await openPractice(browser)
  await page.waitForTimeout(2500)
  await expect(page.getByTestId('readout-state')).toContainText('Listening')
  await expect(page.getByTestId('readout-note')).toHaveCount(0)
  await browser.close()
})

test('explains a blocked microphone', async () => {
  const browser = await launchWithMic(null)
  const page = await openPractice(browser)
  await expect(page.getByRole('alert')).toHaveText('The microphone is blocked')
  await browser.close()
})
