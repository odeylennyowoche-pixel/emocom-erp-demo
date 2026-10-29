/**
 * Smoke test run in CI against the production build (vite preview).
 * Signs in as every demo account, checks the landing dashboard, the sidebar
 * modules and that restricted pages are blocked, then runs one approval.
 * Results are reported as GitHub annotations (::notice / ::error).
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4180/'
const PASSWORD = 'emocom2026'
const ALL = ['Dashboard', 'Employees', 'My profile', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports', 'Settings']

// expected landing title and sidebar per account
const EXPECT = {
  ceo: { title: /Executive dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports', 'Settings'] },
  admin: { title: /Executive dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports', 'Settings'] },
  'hod.finance': { title: /Executive dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports'] },
  'hod.sales': { title: /Sales & Business Development dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports'] },
  'hod.engineering': { title: /Solutions Engineering dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports'] },
  'hod.services': { title: /Managed Services & Support dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports'] },
  'hod.projects': { title: /Projects & Delivery dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports'] },
  'hod.hr': { title: /Human Resources & Admin dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports'] },
  'hod.procurement': { title: /Procurement & Logistics dashboard/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement', 'Finance', 'Reports'] },
  'staff.sales': { title: /My workspace/, nav: ['Dashboard', 'My profile', 'Inventory & Assets', 'Procurement', 'Finance'] },
  'staff.engineering': { title: /My workspace/, nav: ['Dashboard', 'My profile', 'Inventory & Assets', 'Procurement'] },
  'staff.services': { title: /My workspace/, nav: ['Dashboard', 'My profile', 'Inventory & Assets', 'Procurement'] },
  'staff.projects': { title: /My workspace/, nav: ['Dashboard', 'My profile', 'Inventory & Assets', 'Procurement'] },
  'staff.finance': { title: /My workspace/, nav: ['Dashboard', 'My profile', 'Inventory & Assets', 'Procurement', 'Finance'] },
  'staff.hr': { title: /My workspace/, nav: ['Dashboard', 'Employees', 'Inventory & Assets', 'Procurement'] },
  'staff.procurement': { title: /My workspace/, nav: ['Dashboard', 'My profile', 'Inventory & Assets', 'Procurement'] },
}
const ROUTES = { Employees: '#/employees', 'Inventory & Assets': '#/inventory', Procurement: '#/procurement', Finance: '#/finance', Reports: '#/reports', Settings: '#/settings' }

let failures = 0
const fail = (msg) => {
  failures++
  console.log(`::error title=Smoke test::${msg}`)
}
const note = (msg) => console.log(`::notice title=Smoke test::${msg}`)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('fonts.g') && errors.push(m.text()))

async function signIn(username) {
  await page.goto(BASE + '#/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.locator('main h1').first().waitFor({ timeout: 10000 })
}
async function signOut() {
  await page.getByLabel('Open profile menu').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('heading', { name: 'Sign in' }).waitFor()
}

// unauthenticated users are sent to the login page
await page.goto(BASE + '#/finance')
await page.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 15000 }).catch(() => fail('Signed-out visitor was not redirected to the login page'))

// wrong password is rejected
await page.getByLabel('Username').fill('ceo')
await page.getByLabel('Password', { exact: true }).fill('wrong')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.getByText('Incorrect username or password.').waitFor({ timeout: 10000 }).catch(() => fail('Wrong password was not rejected'))

for (const [username, exp] of Object.entries(EXPECT)) {
  errors.length = 0
  try {
    await signIn(username)
    const title = (await page.locator('main h1').first().textContent()) ?? ''
    if (!exp.title.test(title)) fail(`${username}: landing title "${title}" did not match ${exp.title}`)
    const nav = await page.locator('nav[aria-label="Main navigation"] a').allTextContents()
    const navNames = ALL.filter((n) => nav.some((t) => t.trim().startsWith(n)))
    const missing = exp.nav.filter((n) => !navNames.includes(n))
    const extra = navNames.filter((n) => !exp.nav.includes(n))
    if (missing.length || extra.length) fail(`${username}: sidebar mismatch. missing=[${missing}] extra=[${extra}]`)
    // every allowed module opens; every other module shows "Access restricted"
    for (const [name, hash] of Object.entries(ROUTES)) {
      await page.goto(BASE + hash)
      await page.locator('main h1').first().waitFor({ timeout: 10000 })
      const h = (await page.locator('main h1').first().textContent()) ?? ''
      const allowed = exp.nav.includes(name) || (name === 'Employees' && exp.nav.includes('My profile'))
      if (allowed && /Access restricted|Something went wrong/.test(h)) fail(`${username}: could not open ${name} ("${h}")`)
      if (!allowed && !/Access restricted/.test(h)) fail(`${username}: ${name} should be restricted but showed "${h}"`)
    }
    if (errors.length) fail(`${username}: console errors: ${errors.slice(0, 3).join(' | ')}`)
    note(`${username}: "${title}" · ${navNames.join(', ')}`)
    await page.goto(BASE + '#/')
    await signOut()
  } catch (e) {
    fail(`${username}: ${e.message.split('\n')[0]}`)
    await page.goto(BASE + '#/login').catch(() => {})
  }
}

// approval flow: a head approves a request from their department
try {
  await signIn('hod.engineering')
  await page.goto(BASE + '#/procurement?awaiting=me')
  await page.locator('main tbody tr').first().click()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByText('Approved', { exact: true }).first().waitFor()
  const status = await page.locator('main h1').first().locator('..').textContent()
  if (!status?.includes('Approved')) fail(`approval flow: status after approving was "${status}"`)
  else note('approval flow: hod.engineering approved a department request')
  // the CEO-only request is blocked for a head of department
  await page.goto(BASE + '#/procurement')
  await page.getByPlaceholder('Search ID, title, requester…').fill('Laptops')
  await page.locator('main tbody tr').first().click()
  const approve = page.getByRole('button', { name: 'Approve', exact: true })
  if (await approve.isEnabled()) fail('approval flow: head of department could approve the ₦24.75m request')
  else note('approval flow: ₦24.75m request correctly blocked for a head of department')
  await signOut()
} catch (e) {
  fail(`approval flow: ${e.message.split('\n')[0]}`)
}

await browser.close()
if (failures) {
  console.log(`${failures} smoke-test failure(s)`)
  process.exit(1)
}
note('All smoke tests passed')
