import { test } from '@playwright/test'
import { expectStatus, openChallenge, targets } from './helpers'

test.describe('Level 3 — keyboard', () => {
  test('c17 keyboard shortcut: exact modifiers', async ({ page }) => {
    await openChallenge(page, 'keyboard-shortcuts')
    const [combo] = await targets(page) // e.g. "Ctrl + Shift + K"
    const keys = combo.split(' + ').map((k) => (k === 'Ctrl' ? 'Control' : k))
    await page.getByTestId('c17-pad').focus()
    await page.keyboard.press(keys.join('+'))
    await expectStatus(page, 'passed')
  })

  test('c19 typing accuracy: phrase must match exactly', async ({ page }) => {
    await openChallenge(page, 'typing-accuracy')
    const [phrase] = await targets(page)
    await page.getByTestId('c19-input').click()
    await page.keyboard.type(phrase, { delay: 5 })
    await page.getByTestId('c19-submit').click()
    await expectStatus(page, 'passed')
  })

  test('c21 six separate digit boxes', async ({ page }) => {
    await openChallenge(page, 'otp-code')
    const [code] = await targets(page)
    await page.getByTestId('c21-digit-1').click()
    await page.keyboard.type(code) // boxes auto-advance
    await page.getByTestId('c21-verify').click()
    await expectStatus(page, 'passed')
  })
})
