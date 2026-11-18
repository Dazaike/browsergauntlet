import { test } from '@playwright/test'
import { expectStatus, openChallenge, targets } from './helpers'

test.describe('Level 5 — dynamic website', () => {
  test('c33 infinite scroll: load batches by scrolling, then click the target item', async ({ page }) => {
    await openChallenge(page, 'infinite-scroll')
    const [label] = await targets(page) // "Item #137"
    const n = label.replace('Item #', '')
    const item = page.getByTestId(`c33-item-${n}`)
    for (let i = 0; i < 40 && !(await item.count()); i++) {
      await page.getByTestId('c33-list').evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
      await page.waitForTimeout(250) // simulated request + render
    }
    await item.scrollIntoViewIfNeeded()
    await item.click()
    await expectStatus(page, 'passed')
  })
})

test.describe('Level 7 — special interactions', () => {
  test('c58 iframe: type inside the frame, parent validates the postMessage', async ({ page }) => {
    await openChallenge(page, 'iframe')
    const [token] = await targets(page)
    const frame = page.frameLocator('#c58-frame')
    await frame.locator('#token-input').fill(token)
    await frame.locator('#verify-btn').click()
    await expectStatus(page, 'passed')
  })

  test('c59 shadow DOM: controls inside an open shadow root', async ({ page }) => {
    await openChallenge(page, 'shadow-dom')
    const [target] = await targets(page)
    // Playwright CSS selectors pierce open shadow roots
    await page.locator('#stepper-input').fill(target)
    await page.locator('#apply').click()
    await expectStatus(page, 'passed')
  })
})
