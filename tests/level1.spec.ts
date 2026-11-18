import { expect, test } from '@playwright/test'
import { expectStatus, failures, openChallenge, report, targets } from './helpers'

test.describe('Level 1 — basic interactions', () => {
  test('c01 button click: wrong button counts a failure, right button passes', async ({ page }) => {
    await openChallenge(page, 'button-click')
    const [target] = await targets(page)
    const choices = page.getByTestId('c01-choices').getByRole('button')
    const wrong = choices.filter({ hasNotText: new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first()

    await wrong.click()
    expect(await failures(page)).toBe(1)
    await expectStatus(page, 'active')

    await page.getByTestId('c01-choices').getByRole('button', { name: target, exact: true }).click()
    await expectStatus(page, 'passed')
  })

  test('c02 text input: exact string required', async ({ page }) => {
    await openChallenge(page, 'text-input')
    const [target] = await targets(page)

    await page.getByTestId('c02-input').fill(target.toLowerCase() + ' ')
    await page.getByTestId('c02-submit').click()
    await expectStatus(page, 'active')
    expect(await failures(page)).toBe(1)

    await page.getByTestId('c02-input').fill(target)
    await page.getByTestId('c02-submit').click()
    await expectStatus(page, 'passed')
  })

  test('c03 checkboxes: only matching words', async ({ page }) => {
    await openChallenge(page, 'checkboxes')
    const [criterion] = await targets(page)
    const tests: Record<string, (w: string) => boolean> = {
      'start with a vowel (a, e, i, o, u)': (w) => /^[aeiou]/.test(w),
      'contain the letter "r"': (w) => w.includes('r'),
      'have 6 or more letters': (w) => w.length >= 6,
      'end with the letter "e" or "t"': (w) => /[et]$/.test(w),
      'contain the letter "o"': (w) => w.includes('o'),
    }
    const match = tests[criterion]
    expect(match, `unknown criterion: ${criterion}`).toBeTruthy()

    const boxes = page.getByRole('checkbox')
    const n = await boxes.count()
    for (let i = 0; i < n; i++) {
      const word = (await boxes.nth(i).getAttribute('data-testid'))!.replace('c03-check-', '')
      if (match(word)) await boxes.nth(i).click()
    }
    await page.getByTestId('c03-submit').click()
    await expectStatus(page, 'passed')
  })

  test('reset returns the challenge to idle without losing the attempt count', async ({ page }) => {
    await openChallenge(page, 'text-input')
    await page.getByTestId('c02-input').fill('definitely wrong')
    await page.getByTestId('c02-submit').click()
    expect(await failures(page)).toBe(1)
    await page.getByTestId('reset-button').click()
    await expectStatus(page, 'idle')
    await expect(page.getByTestId('c02-input')).toHaveValue('')
    expect(await failures(page)).toBe(1)
  })
})

test('results report reflects only real completions', async ({ page }) => {
  await openChallenge(page, 'text-input')
  let r = await report(page)
  expect(r.summary.completed).toBe(0)

  const [target] = await targets(page)
  await page.getByTestId('c02-input').fill(target)
  await page.getByTestId('c02-submit').click()
  await expectStatus(page, 'passed')

  r = await report(page)
  expect(r.summary.completed).toBe(1)
  expect(r.challenges.find((c) => c.id === 'c02')?.status).toBe('passed')

  await page.goto('/report')
  await expect(page.locator('#report-json')).toContainText('"completed": 1')
})
