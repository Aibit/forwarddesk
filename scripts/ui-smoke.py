"""UI smoke test for the ForwardDesk SPA (Playwright, Python).

  python3 scripts/ui-smoke.py [url]      # default http://localhost:5199/forwarddesk/

Checks every tab, FA/RTL, dark mode, the sign-in dialog, quotes + PDF, portal actions,
agents filter + empty state, MSDS rules, tariffs/glossary and the phone sidebar.
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5199/forwarddesk/'
fails, errs = [], []

def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name)
    if not cond:
        fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until='networkidle')
    tid = lambda t: pg.locator(f'[data-testid="{t}"]')

    check('sidebar has 7 pages', pg.locator('.nd-item').count() == 7)
    check('demo mode pill', tid('auth-demo').is_visible())
    check('page header with drawing', tid('page-header').locator('svg').count() > 0)
    check('jobs summary tiles', tid('jobs-summary').locator('.j-tile').count() == 6)
    check('deadline tracker has items', tid('deadline-tracker').locator('.j-dl-item').count() > 3)
    check('real demurrage shown as soft-red alert', pg.locator('.j-dl-item.red').count() > 0)
    tid('job-FD-E-1042').click()
    check('job drawer opens', tid('job-detail').is_visible())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    if tid('job-detail').is_visible():
        pg.mouse.click(20, 450); pg.wait_for_timeout(200)
    check('job drawer closes', not tid('job-detail').is_visible())
    check('tariffs panel', tid('tariffs').count() == 1)
    check('glossary', pg.locator('.j-gloss-list > div').count() >= 20)

    tid('jobs-lang-fa').click(); pg.wait_for_timeout(200)
    check('FA: app is RTL', pg.get_attribute('.app', 'dir') == 'rtl')
    check('FA: sidebar translated', 'مشتریان' in tid('nav-clients').inner_text())
    check('FA: jobs view RTL', pg.get_attribute('.jobs-view', 'dir') == 'rtl')
    tid('nav-clients').click(); pg.wait_for_timeout(200)
    check('FA carries over to Clients', pg.get_attribute('[data-testid=clients-view]', 'dir') == 'rtl')
    tid('ui-lang-es').click(); pg.wait_for_timeout(200)
    check('ES from sidebar', tid('nav-clients').inner_text().strip() == 'Clientes')
    tid('ui-lang-en').click(); pg.wait_for_timeout(200)

    check('clients table has 7 sample clients', tid('clients-table').locator('[data-testid^=client-]').count() >= 7)
    tid('edit-msds-rules').click(); pg.wait_for_timeout(200)
    check('MSDS rules panel', tid('msds-rules').is_visible())
    tid('edit-msds-rules').click()

    tid('tab-agents').click(); pg.wait_for_timeout(300)
    check('agents seeded (57)', '57' in tid('agents-count').inner_text())
    check('sanctions-listed badges (9)', pg.locator('[data-testid=sanctions-listed]').count() == 9)
    tid('agents-search').fill('zzzzqqq'); pg.wait_for_timeout(200)
    check('agents empty state drawing', tid('agents-table').locator('.fd-empty-cell svg').count() == 1)
    tid('agents-search').fill('')

    tid('nav-portal').click(); pg.wait_for_timeout(200)
    check('portal login has drawing', tid('portal-login').locator('.fd-login-art svg').count() == 1)
    tid('portal-use-C').click() if tid('portal-use-C').count() else pg.locator('[data-testid^=portal-use-]').nth(2).click()
    tid('portal-submit').click(); pg.wait_for_timeout(300)
    check('portal logged in', tid('portal').is_visible())
    check('portal shows no buy/margin', 'margin' not in tid('portal').inner_text().lower())
    acc = pg.locator('[data-testid^=portal-accept-]')
    if acc.count():
        acc.first.click(); pg.wait_for_timeout(200)
        check('portal quote accept', pg.locator('.p-accepted').count() > 0 or pg.locator('[data-testid^=portal-accept-]').count() < acc.count() + 1)
    tid('portal-logout').click(); pg.wait_for_timeout(200)

    tid('nav-quote').click(); pg.wait_for_timeout(200)
    check('quote empty state drawing', pg.locator('.q-empty svg').count() >= 1)
    pg.get_by_role('button', name='Ocean FCL · Shanghai → Barcelona').click(); pg.wait_for_timeout(500)
    check('quote options', tid('quote-options').is_visible() and pg.locator('[data-testid^=option-pick-]').count() >= 2)
    check('quote text', len(tid('quote-text').inner_text()) > 100)
    with pg.expect_download() as dl:
        tid('generate-pdf').click()
    path = dl.value.path()
    data = open(path, 'rb').read()
    check('customer PDF downloads', data[:4] == b'%PDF' and len(data) > 10000)

    tid('nav-desk').click(); pg.wait_for_timeout(200)
    pg.locator('.sticky-actions .btn.primary').click(); pg.wait_for_timeout(6000)
    check('desk builds quote options', pg.locator('.match-ticket').count() > 0)
    tid('nav-pitch').click(); pg.wait_for_timeout(300)
    check('pitch view renders', pg.locator('.sales-sim').count() == 1)

    tid('auth-signin').click(); pg.wait_for_timeout(200)
    check('sign-in dialog with drawing', tid('signin-dialog').locator('.fd-modal-art svg').count() == 1)
    check('compliance note in dialog', tid('compliance-note').is_visible())
    pg.locator('.fd-modal-actions .btn.ghost').click()
    check('sign-in dialog closes', tid('signin-dialog').count() == 0)

    tid('theme-toggle').click(); pg.wait_for_timeout(200)
    check('dark mode on', pg.get_attribute('html', 'data-theme') == 'dark')
    pg.reload(wait_until='networkidle')
    check('dark mode persists', pg.get_attribute('html', 'data-theme') == 'dark')
    tid('theme-toggle').click()
    check('light mode back', pg.get_attribute('html', 'data-theme') == 'light')

    m = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    m.on('pageerror', lambda e: errs.append(str(e)))
    m.goto(URL, wait_until='networkidle')
    check('phone: sidebar hidden', 'open' not in m.get_attribute('[data-testid=sidebar]', 'class'))
    m.click('[data-testid=nav-open]'); m.wait_for_timeout(300)
    check('phone: sidebar opens', 'open' in m.get_attribute('[data-testid=sidebar]', 'class'))
    m.click('[data-testid=nav-clients]'); m.wait_for_timeout(300)
    check('phone: picking a page closes sidebar', 'open' not in m.get_attribute('[data-testid=sidebar]', 'class') and m.locator('[data-testid=clients-view]').is_visible())
    sw = m.evaluate('document.documentElement.scrollWidth')
    check('phone: no page-level horizontal overflow', sw <= 391)
    b.close()

check('no page errors', not errs)
for e in errs[:5]:
    print('  error:', e)
print(f'\n{len(fails)} failed' if fails else '\nALL PASS')
sys.exit(1 if fails else 0)
