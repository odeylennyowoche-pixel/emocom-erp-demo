/**
 * Smoke test run in CI against the production build (vite preview).
 * Signs in as every demo account, checks the landing dashboard, the sidebar
 * modules and that restricted pages are blocked, then runs key workflows.
 * Results are reported as GitHub annotations (::notice / ::error).
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4180/'
const PASSWORD = 'emocom2026'

// sidebar label → route
const ROUTES = {
  Approvals: '#/approvals',
  'My workspace': '#/workspace',
  'Proposals & quotes': '#/proposals',
  'Sales & CRM': '#/sales',
  Projects: '#/projects',
  'My team': '#/team',
  'Human resources': '#/hr',
  Employees: '#/employees',
  Finance: '#/finance',
  Purchasing: '#/procurement',
  'Inventory & assets': '#/inventory',
  Reports: '#/reports',
  Administration: '#/admin',
  Settings: '#/settings',
}
const ALL = ['Dashboard', 'My profile', ...Object.keys(ROUTES)]

const MANAGER = ['Dashboard', 'Approvals', 'My workspace', 'Proposals & quotes', 'Projects', 'My team', 'Employees', 'Finance', 'Purchasing', 'Inventory & assets', 'Reports']
const STAFF = ['Dashboard', 'My workspace', 'Proposals & quotes', 'My profile']
const EXPECT = {
  ceo: { title: /Executive overview/, nav: ['Dashboard', 'Approvals', 'Proposals & quotes', 'Sales & CRM', 'Projects', 'Human resources', 'Employees', 'Finance', 'Purchasing', 'Inventory & assets', 'Reports', 'Administration', 'Settings'] },
  admin: { title: /System administration/, nav: ['Dashboard', 'My workspace', 'Employees', 'Purchasing', 'Inventory & assets', 'Reports', 'Administration', 'Settings'] },
  'finance.manager': { title: /Finance dashboard/, nav: ['Dashboard', 'Approvals', 'My workspace', 'My profile', 'Finance', 'Purchasing', 'Inventory & assets', 'Reports'] },
  'finance.accountant': { title: /Finance dashboard/, nav: ['Dashboard', 'My workspace', 'My profile', 'Finance', 'Purchasing', 'Inventory & assets', 'Reports'] },
  'hr.manager': { title: /People overview/, nav: ['Dashboard', 'Approvals', 'My workspace', 'Human resources', 'Employees', 'Reports'] },
  'sales.exec': { title: /My sales/, nav: ['Dashboard', 'My workspace', 'Proposals & quotes', 'Sales & CRM', 'My profile'] },
  'sales.bd': { title: /My sales/, nav: ['Dashboard', 'My workspace', 'Proposals & quotes', 'Sales & CRM', 'My profile'] },
  'manager.sales': { title: /Sales & Business Development/, nav: [...MANAGER.slice(0, 4), 'Sales & CRM', ...MANAGER.slice(4)] },
  'manager.engineering': { title: /Solutions Engineering/, nav: MANAGER },
  'manager.services': { title: /Managed Services & Support/, nav: MANAGER },
  'manager.projects': { title: /Projects & Delivery/, nav: MANAGER },
  'staff.presales': { title: /My dashboard/, nav: STAFF },
  'staff.engineering': { title: /My dashboard/, nav: STAFF },
  'staff.services': { title: /My dashboard/, nav: STAFF },
  'staff.projects': { title: /My dashboard/, nav: STAFF },
}

let failures = 0
const fail = (msg) => {
  failures++
  console.log(`::error title=Smoke test::${msg}`)
}
// GitHub shows only 10 notices per step, so passes are collected and printed together.
const passed = []
const note = (msg) => passed.push(msg)
let step = ''

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
  await page.goto(BASE + '#/')
  await page.getByLabel('Open profile menu').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('heading', { name: 'Sign in' }).waitFor()
}
async function h1() {
  await page.locator('main h1').first().waitFor({ timeout: 10000 })
  return (await page.locator('main h1').first().textContent()) ?? ''
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
    const title = await h1()
    if (!exp.title.test(title)) fail(`${username}: landing title "${title}" did not match ${exp.title}`)
    const nav = (await page.locator('nav[aria-label="Main navigation"] a').allTextContents()).map((t) => t.replace(/\d+$/, '').trim())
    const navNames = ALL.filter((n) => nav.includes(n))
    const missing = exp.nav.filter((n) => !navNames.includes(n))
    const extra = navNames.filter((n) => !exp.nav.includes(n))
    if (missing.length || extra.length) fail(`${username}: sidebar mismatch. missing=[${missing}] extra=[${extra}]`)
    // every allowed module opens; every other module shows "Access restricted"
    for (const [name, hash] of Object.entries(ROUTES)) {
      await page.goto(BASE + hash)
      const h = await h1()
      const allowed = exp.nav.includes(name) || (name === 'Employees' && exp.nav.includes('My profile'))
      if (allowed && /Access restricted|Something went wrong|not found/i.test(h)) fail(`${username}: could not open ${name} ("${h}")`)
      if (!allowed && !/Access restricted/.test(h)) fail(`${username}: ${name} should be restricted but showed "${h}"`)
      // open every tab of tabbed modules to catch render errors
      if (allowed) {
        const tabs = page.locator('main [role="tab"]')
        const n = await tabs.count()
        for (let i = 1; i < n; i++) {
          await tabs.nth(i).click()
          await page.waitForTimeout(60)
        }
      }
    }
    if (errors.length) fail(`${username}: console errors: ${errors.slice(0, 3).join(' | ')}`)
    note(`${username}: "${title}" · ${navNames.join(', ')}`)
    await signOut()
  } catch (e) {
    fail(`${username}: ${e.message.split('\n')[0]}`)
    await page.goto(BASE + '#/login').catch(() => {})
  }
}

async function flow(name, fn) {
  errors.length = 0
  try {
    await fn()
    if (errors.length) fail(`${name}: console errors: ${errors.slice(0, 3).join(' | ')}`)
  } catch (e) {
    fail(`${name} [${step}]: ${e.message.split('\n')[0]}`)
    await page.goto(BASE + '#/login').catch(() => {})
  }
}

// 1. a manager approves a team purchase request; the ₦24.75m request is blocked for them
await flow('purchase approval', async () => {
  await signIn('manager.engineering')
  await page.goto(BASE + '#/procurement?awaiting=me')
  await page.locator('main tbody tr').first().click()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByText('Approved', { exact: true }).first().waitFor()
  note('purchase approval: manager.engineering approved a team request')
  await page.goto(BASE + '#/procurement')
  await page.getByPlaceholder('Search ID, title, requester…').fill('Laptops')
  await page.locator('main tbody tr').first().click()
  if (await page.getByRole('button', { name: 'Approve', exact: true }).isEnabled()) fail('purchase approval: a manager could approve the ₦24.75m request')
  else note('purchase approval: ₦24.75m request correctly reserved for the CEO')
  await signOut()
})

// 2. staff completes an assigned task
await flow('task completion', async () => {
  await signIn('staff.engineering')
  await page.goto(BASE + '#/workspace')
  await page.getByRole('button', { name: 'Mark complete' }).first().click()
  await page.getByLabel('Completion note').fill('Configured and tested on site.')
  await page.getByRole('dialog').getByRole('button', { name: 'Mark complete' }).click()
  await page.getByText('Task completed').first().waitFor()
  note('task completion: staff.engineering completed a task')
  await signOut()
})

// 3. manager approves leave for their team
await flow('leave approval', async () => {
  await signIn('manager.engineering')
  await page.goto(BASE + '#/approvals?tab=leave')
  await page.locator('main li').getByRole('button', { name: 'Approve' }).first().click()
  await page.getByText('Leave approved').first().waitFor()
  note('leave approval: manager.engineering approved team leave')
  await signOut()
})

// 4. CEO gives final approval to a large project
await flow('project approval', async () => {
  await signIn('ceo')
  await page.goto(BASE + '#/approvals?tab=projects')
  await page.locator('main li').getByRole('button', { name: 'Approve' }).first().click()
  await page.getByText('Project approved').first().waitFor()
  note('project approval: CEO approved the ₦96m project')
  await signOut()
})

// 5. staff logs time and requests leave
await flow('timesheet & leave', async () => {
  await signIn('staff.services')
  step = 'log time'
  await page.goto(BASE + '#/workspace?tab=timesheets')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByText('Time logged').first().waitFor()
  step = 'open leave form'
  await page.goto(BASE + '#/workspace?tab=leave')
  await page.getByRole('button', { name: 'Request leave' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  step = 'fill reason'
  await dialog.getByLabel('Reason').fill('Family visit')
  const d = new Date()
  d.setDate(d.getDate() + 70 + ((8 - d.getDay()) % 7)) // a Monday about ten weeks out
  const iso = (x) => x.toISOString().slice(0, 10)
  const end = new Date(d)
  end.setDate(end.getDate() + 2)
  step = 'fill dates'
  await dialog.locator('input[type="date"]').nth(0).fill(iso(d))
  await dialog.locator('input[type="date"]').nth(1).fill(iso(end))
  step = 'submit'
  await dialog.getByRole('button', { name: 'Submit request' }).click()
  await page.getByText('Leave requested').first().waitFor()
  note('timesheet & leave: staff.services logged time and requested leave')
  await signOut()
})

await browser.close()
console.log(`::notice title=Smoke test passes::${passed.join(' || ')}`)
if (failures) {
  console.log(`${failures} smoke-test failure(s)`)
  process.exit(1)
}
console.log('::notice title=Smoke test::All smoke tests passed')
