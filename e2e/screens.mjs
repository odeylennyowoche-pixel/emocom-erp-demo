// Captures key screens for visual review (run in CI; saved to the "screenshots" branch).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE_URL ?? 'http://localhost:4180/'
const OUT = process.env.OUT ?? 'shots'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
async function shoot(name, username, hash, viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await page.goto(BASE + '#/login')
  if (username) {
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password', { exact: true }).fill('emocom2026')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.locator('main h1').first().waitFor()
    if (hash) await page.goto(BASE + hash)
    await page.locator('main h1').first().waitFor()
  }
  await page.waitForTimeout(1800) // let charts animate
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  await ctx.close()
}
await shoot('01-login', null)
await shoot('02-ceo-dashboard', 'ceo')
await shoot('03-hod-sales-dashboard', 'hod.sales')
await shoot('04-staff-workspace', 'staff.engineering')
await shoot('05-procurement-hod', 'hod.engineering', '#/procurement')
await shoot('06-request-detail', 'hod.engineering', '#/procurement/requests/pr_0028')
await shoot('07-settings-users', 'admin', '#/settings?tab=users')
await shoot('08-staff-finance-blocked', 'staff.engineering', '#/finance')
await shoot('09-mobile-login', null, null, { width: 390, height: 844 })
await shoot('10-mobile-dashboard', 'hod.finance', null, { width: 390, height: 844 })
await browser.close()
