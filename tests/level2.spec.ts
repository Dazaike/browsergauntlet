import { expect, test } from '@playwright/test'
import { expectStatus, failures, openChallenge, targets } from './helpers'

test.describe('Level 2 — mouse and pointer', () => {
  test('c08 slider: set the exact value, then confirm', async ({ page }) => {
    await openChallenge(page, 'slider')
    const target = Number((await targets(page))[0])
    const slider = page.getByTestId('c08-slider')
    await slider.focus()
    await page.keyboard.press('Home')
    for (let i = 0; i < target; i++) await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('c08-value')).toHaveAttribute('data-value', String(target))
    await page.getByTestId('c08-confirm').click()
    await expectStatus(page, 'passed')
  })

  test('c09 click and hold: an early release fails, a 3s hold passes', async ({ page }) => {
    await openChallenge(page, 'click-hold')
    const btn = page.getByTestId('c09-hold')
    const box = (await btn.boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.waitForTimeout(800)
    await page.mouse.up()
    expect(await failures(page)).toBe(1)

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.waitForTimeout(3200) // real continuous pointer-down time is measured
    await page.mouse.up()
    await expectStatus(page, 'passed')
  })

  test('c10 drag and drop: the drop position is validated on release', async ({ page }) => {
    await openChallenge(page, 'drag-drop')
    const [zoneName] = await targets(page)
    const obj = (await page.getByTestId('c10-object').boundingBox())!
    const zone = (await page.getByTestId(`c10-zone-${zoneName.toLowerCase()}`).boundingBox())!

    await page.mouse.move(obj.x + obj.width / 2, obj.y + obj.height / 2)
    await page.mouse.down()
    await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2, { steps: 12 })
    await page.mouse.up()
    await expectStatus(page, 'passed')
  })
})
