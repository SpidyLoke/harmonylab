// Walks the main sections with a fake microphone and checks nothing breaks.
import { expect, test } from '@playwright/test'
import { BASE, launch, openSetUp } from './helpers'

test('first visit lands on the welcome page and setup starts with the mic', async () => {
  const browser = await launch()
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/`)
  await expect(page).toHaveURL(/#\/welcome/)
  await page.getByRole('link', { name: /Set up/ }).click()
  await page.getByRole('button', { name: 'Turn on microphone' }).click()
  await expect(page.getByText('Microphone on')).toBeVisible()
  await page.getByRole('button', { name: 'Next: headphones' }).click()
  await page.getByRole('button', { name: 'Run the check' }).click()
  // The fake mic plays a voice, not the guide: either verdict is fine, it must finish.
  await expect(page.getByText(/All clear|heard the guide/)).toBeVisible({ timeout: 10_000 })
  expect(errors).toEqual([])
  await browser.close()
})

test('a curriculum drill runs a take and shows a scored result', async () => {
  test.setTimeout(90_000)
  const browser = await launch()
  const { page, errors } = await openSetUp(browser, '/learn/2/l2-unison', { level: 2 })
  await page.getByRole('button', { name: 'Turn on microphone' }).click()
  await page.getByTestId('start-take').click()
  await expect(page.getByTestId('result-card')).toBeVisible({ timeout: 45_000 })
  await expect(page.getByTestId('result-score')).toHaveText(/\d+%/)
  await expect(page.getByTestId('result-tip')).not.toBeEmpty()
  await expect(page.getByTestId('verdict')).toBeVisible()
  // The take is saved and shows on the progress page.
  await page.goto(`${BASE}/progress`)
  await expect(page.getByRole('cell', { name: /Blend with the drone/ })).toBeVisible()
  expect(errors).toEqual([])
  await browser.close()
})

test('an A3 voice scores well on an A3 drone hold', async () => {
  test.setTimeout(90_000)
  const browser = await launch()
  // Range A2..E4: drills centre on A3, so the hold lands on the voice's note.
  const { page, errors } = await openSetUp(browser, '/learn/2/l2-long', { level: 2, range: [45, 69] })
  await page.getByRole('button', { name: 'Turn on microphone' }).click()
  await page.getByTestId('start-take').click()
  await expect(page.getByTestId('result-card')).toBeVisible({ timeout: 60_000 })
  const score = Number((await page.getByTestId('result-score').innerText()).replace('%', ''))
  expect(score).toBeGreaterThan(80)
  expect(errors).toEqual([])
  await browser.close()
})

test('ear training round: answer, feedback, next', async () => {
  const browser = await launch()
  const { page, errors } = await openSetUp(browser, '/ear/interval-up')
  await page.getByTestId('ear-start').click()
  await page.getByRole('button', { name: /perfect 5th/i }).click()
  await expect(page.getByText(/Right|Not quite/)).toBeVisible()
  await page.getByTestId('ear-next').click()
  await expect(page.getByText('Question 2 of 10')).toBeVisible()
  expect(errors).toEqual([])
  await browser.close()
})

test('add a built-in song, see the piano roll, open practice', async () => {
  const browser = await launch()
  const { page, errors } = await openSetUp(browser, '/songs/new')
  await page.getByRole('radio', { name: 'Built-in' }).click()
  await page.getByRole('button', { name: 'Add' }).first().click()
  await expect(page.getByRole('application', { name: 'Piano roll editor' })).toBeVisible()
  await expect(page.getByLabel('Song title')).toHaveValue('Neon Summer')
  await page.getByLabel('Which part to edit').selectOption('thirdAbove')
  await page.getByRole('button', { name: 'Practise' }).click()
  await page.getByRole('button', { name: 'Turn on microphone' }).click()
  await expect(page.getByTestId('start-take')).toHaveText('Start looping')
  expect(errors).toEqual([])
  await browser.close()
})

test("today's session builds four steps", async () => {
  const browser = await launch()
  const { page, errors } = await openSetUp(browser, '/')
  await page.getByTestId('start-session').click()
  await expect(page.getByRole('list', { name: 'Session steps' }).getByRole('listitem')).toHaveCount(4)
  await page.getByRole('button', { name: 'Turn on microphone' }).click()
  await page.getByTestId('session-next').click()
  await expect(page.getByRole('heading', { name: /^Level 1:/ })).toBeVisible()
  expect(errors).toEqual([])
  await browser.close()
})

test('progress page exports a backup file', async () => {
  const browser = await launch()
  const { page, errors } = await openSetUp(browser, '/progress')
  await expect(page.getByText('Daily streak')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^harmonylab-backup-\d{4}-\d{2}-\d{2}\.json$/)
  expect(errors).toEqual([])
  await browser.close()
})

test('sing along: a library song opens with words on screen and the melody part', async () => {
  const browser = await launch()
  const { page, errors } = await openSetUp(browser, '/songs')
  await page.getByTestId('singalong-twinkle').click()
  await expect(page).toHaveURL(/#\/songs\/\d+\/practice/)
  await expect(page.getByRole('combobox').first()).toHaveValue('melody')
  await page.getByRole('button', { name: 'Turn on microphone' }).click()
  await expect(page.getByTestId('lyrics')).toContainText('Twinkle twinkle little star')
  await expect(page.getByTestId('lyrics')).toContainText('how I wonder what you are')
  // Adding it again opens the same copy rather than a duplicate.
  await page.goto(`${BASE}/songs`)
  await page.getByTestId('singalong-twinkle').click()
  await page.goto(`${BASE}/songs`)
  await expect(page.getByRole('link', { name: /Twinkle, Twinkle, Little Star/ })).toHaveCount(1)
  expect(errors).toEqual([])
  await browser.close()
})

test('rounds offer the second voice', async () => {
  const browser = await launch()
  const { page, errors } = await openSetUp(browser, '/songs')
  await page.getByTestId('singalong-frere-jacques').click()
  await expect(page.getByRole('combobox').first()).toHaveValue('round')
  expect(errors).toEqual([])
  await browser.close()
})
