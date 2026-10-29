// Captures key screens for visual review (run in CI; saved to the "screenshots" branch).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE_URL ?? 'http://localhost:4180/'
const OUT = process.env.OUT ?? 'shots'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
async function shoot(name, username, hash, viewport = { width: 1366, height: 900 }, full = false) {
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
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  await ctx.close()
}
await shoot('01-login', null, null, undefined, true)
await shoot('02-ceo-dashboard', 'ceo', null, undefined, true)
await shoot('03-ceo-approvals', 'ceo', '#/approvals?tab=projects')
await shoot('04-admin-dashboard', 'admin')
await shoot('05-admin-partners', 'admin', '#/admin?tab=partners', undefined, true)
await shoot('06-admin-integrations', 'admin', '#/admin?tab=integrations')
await shoot('07-finance-cashflow', 'finance.manager', '#/finance?tab=cashflow')
await shoot('08-finance-ledger', 'finance.accountant', '#/finance?tab=ledger')
await shoot('09-finance-payroll', 'finance.manager', '#/finance?tab=payroll')
await shoot('10-finance-close', 'finance.manager', '#/finance?tab=close')
await shoot('11-hr-dashboard', 'hr.manager')
await shoot('12-hr-recruitment', 'hr.manager', '#/hr?tab=recruitment')
await shoot('13-sales-dashboard', 'sales.exec')
await shoot('14-sales-pipeline', 'sales.exec', '#/sales', undefined, true)
await shoot('15-sales-forecast', 'manager.sales', '#/sales?tab=forecast')
await shoot('16-manager-dashboard', 'manager.engineering', null, undefined, true)
await shoot('17-project-detail', 'manager.engineering', '#/projects/prj_002', undefined, true)
await shoot('18-team', 'manager.engineering', '#/team')
await shoot('19-staff-dashboard', 'staff.engineering', null, undefined, true)
await shoot('20-staff-calendar', 'staff.engineering', '#/workspace?tab=calendar')
await shoot('21-staff-timesheets', 'staff.engineering', '#/workspace?tab=timesheets')
await shoot('22-staff-pay', 'staff.engineering', '#/workspace?tab=pay')
await shoot('23-proposal', 'staff.presales', '#/proposals/prp_002')
await shoot('24-staff-blocked', 'staff.engineering', '#/finance')
await shoot('25-mobile-dashboard', 'ceo', null, { width: 390, height: 844 })
await shoot('26-mobile-workspace', 'staff.projects', '#/workspace', { width: 390, height: 844 })
await browser.close()
