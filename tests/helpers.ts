import { expect, type Page } from '@playwright/test'

export const SEED = 'e2e'

/** Open a challenge by slug with a fixed seed (same puzzle on every run). */
export async function openChallenge(page: Page, slug: string, seed = SEED) {
  await page.goto(`/challenge/${slug}?seed=${seed}`)
  await expect(page.getByTestId('challenge-body')).toBeVisible()
  await expect(page.getByTestId('task')).toBeVisible()
}

/** Every target value shown in the task banner, in reading order. */
export async function targets(page: Page): Promise<string[]> {
  return page.getByTestId('task-target').allTextContents()
}

export async function expectStatus(page: Page, status: 'idle' | 'active' | 'passed' | 'failed') {
  await expect(page.getByTestId('challenge-status')).toHaveAttribute('data-status', status)
}

export async function failures(page: Page): Promise<number> {
  return Number(await page.getByTestId('challenge-failures').textContent())
}

/** Subset of the report that the tests read. Full shape: src/lib/report.ts */
export interface GauntletReport {
  summary: { completed: number; failed: number; attempts: number; failedAttempts: number; score: number }
  challenges: { id: string; status: string; attempts: number; failures: number }[]
}

/** Read-only report exposed by the app: window.browserGauntlet.getReport() */
export async function report(page: Page): Promise<GauntletReport> {
  return page.evaluate(() => (window as unknown as { browserGauntlet: { getReport: () => GauntletReport } }).browserGauntlet.getReport())
}
