"""Real-mode end-to-end on the Firebase emulators (auth + firestore).
  npm run emulators  &  npm run dev:emulator -- --port 5399
  python3 scripts/realmode-e2e.py [url] [shots_dir]
Sign up -> verify email (emulator OOB link) -> onboarding -> empty account -> add agent -> invite staff ->
staff joins by link -> second, unrelated account cannot see the first account's data."""
import json, sys, time, urllib.request
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5399/forwarddesk/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/workspace/realmode-shots'
AUTH = 'http://127.0.0.1:9099/emulator/v1/projects/demo-forwarddesk'
fails, errs = [], []
def check(n, c):
    print(('PASS ' if c else 'FAIL ') + n)
    if not c: fails.append(n)
def verify(email):
    codes = json.load(urllib.request.urlopen(f'{AUTH}/oobCodes'))['oobCodes']
    link = [c for c in codes if c['email'] == email and c['requestType'] == 'VERIFY_EMAIL'][-1]['oobLink']
    urllib.request.urlopen(link).read()
stamp = str(int(time.time()))
OWNER, STAFF, OTHER = f'owner{stamp}@example.com', f'staff{stamp}@example.com', f'other{stamp}@example.com'
PW = 'harbour-pass-2026'

def signup(pg, email, name, shot=None):
    t = lambda x: pg.locator(f'[data-testid="{x}"]')
    if t('signin-dialog').count() == 0: t('start-create').click()
    pg.wait_for_selector('[data-testid=signin-dialog]')
    check('google button hidden by default', t('signin-google').count() == 0)
    t('signup-name').fill(name); t('signin-email').fill(email); t('signin-password').fill(PW)
    if shot: pg.screenshot(path=f'{SHOTS}/{shot}')
    t('signin-submit').click()
    pg.wait_for_selector('[data-testid=verify-screen]', timeout=15000)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def page():
        pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        return pg
    # ── owner signs up ──
    a = page(); t = lambda x: a.locator(f'[data-testid="{x}"]')
    a.goto(URL, wait_until='load')
    check('start screen', t('start-screen').is_visible() and t('start-create').is_enabled())
    a.screenshot(path=f'{SHOTS}/01-start-screen-emulator.png')
    signup(a, OWNER, 'Owner A', '02-sign-up.png')
    check('verify screen shows email', OWNER in t('verify-email').inner_text())
    a.screenshot(path=f'{SHOTS}/03-verify-email.png')
    t('verify-continue').click(); a.wait_for_timeout(1500)
    check('unverified cannot continue', t('verify-msg').is_visible() and t('verify-screen').is_visible())
    verify(OWNER)
    t('verify-continue').click(); a.wait_for_selector('[data-testid=onboarding]', timeout=15000)
    check('onboarding after verification', t('onb-step').inner_text().endswith('2'))
    t('onb-name').fill('Gulf Line Forwarding'); t('onb-country').fill('United Arab Emirates')
    t('onb-currency').select_option('AED'); t('onb-ports').fill('Jebel Ali, Khalifa Port')
    a.screenshot(path=f'{SHOTS}/04-onboarding-step1.png')
    t('onb-next').click(); a.wait_for_timeout(200)
    check('review step', 'Gulf Line Forwarding' in t('onb-review').inner_text() and 'Jebel Ali, Khalifa Port' in t('onb-review').inner_text())
    a.screenshot(path=f'{SHOTS}/05-onboarding-review.png')
    t('onb-create').click(); a.wait_for_selector('[data-testid=auth-live]', timeout=15000)
    check('live as owner', 'owner' in t('auth-live').inner_text() and 'Gulf Line Forwarding' in t('auth-live').inner_text())
    a.wait_for_timeout(800)
    check('getting started shown', t('getting-started').is_visible())
    check('no sample jobs in real account', a.locator('[data-testid^=job-FD-]').count() == 0 and t('jobs-sample').count() == 0)
    a.screenshot(path=f'{SHOTS}/06-real-account-jobs-empty.png')
    t('gs-agents').click(); a.wait_for_timeout(600)
    check('agents empty state', t('agents-empty').is_visible() and t('agents-count').inner_text().startswith('0 / 0'))
    check('no SAMPLE badge in real agents', t('agents-sample').count() == 0)
    a.screenshot(path=f'{SHOTS}/07-agents-empty-state.png')
    t('agents-empty-add').click(); a.wait_for_selector('[data-testid=agent-form]')
    a.locator('[data-testid=agent-form] input').first.fill('Caspian Sea Logistics')
    t('af-save').click(); a.wait_for_timeout(1500)
    check('agent saved to account', t('agents-count').inner_text().startswith('1 / 1'))
    a.reload(wait_until='load'); a.wait_for_selector('[data-testid=auth-live]', timeout=15000)
    t('tab-agents').click(); a.wait_for_timeout(1200)
    check('agent persists after reload (Firestore)', 'Caspian Sea Logistics' in t('agents-db').inner_text())
    a.locator('[data-testid^=agent-drawer]').count() and a.keyboard.press('Escape')
    a.screenshot(path=f'{SHOTS}/08-emulator-signed-in-agents.png')
    t('nav-account').click(); a.wait_for_timeout(1000)
    check('account page', t('account-view').is_visible() and OWNER in t('team-members').inner_text())
    t('invite-email').fill(STAFF.upper()); t('invite-role').select_option('staff'); t('invite-send').click()
    a.wait_for_selector('[data-testid=invite-link]', timeout=10000)
    link = t('invite-link').first.inner_text().strip()
    check('invite link created (email lower-cased)', '#join=' in link and STAFF in t('invites').inner_text())
    a.screenshot(path=f'{SHOTS}/09-account-team-invite.png')
    # ── staff joins via link ──
    s = page(); ts = lambda x: s.locator(f'[data-testid="{x}"]')
    s.goto(link.replace('http://localhost:5399/forwarddesk/', URL), wait_until='load')
    check('invite link opens sign-up with invite note', ts('signin-invited').is_visible() and s.get_attribute('[data-testid=signin-dialog]', 'data-tab') == 'create')
    signup(s, STAFF, 'Staff B')
    verify(STAFF); ts('verify-continue').click(); s.wait_for_selector('[data-testid=onboarding]', timeout=15000)
    check('join code prefilled', '.' in ts('onb-join-code').input_value())
    ts('onb-join').click(); s.wait_for_selector('[data-testid=auth-live]', timeout=15000)
    check('staff joined the account', 'staff' in ts('auth-live').inner_text() and 'Gulf Line Forwarding' in ts('auth-live').inner_text())
    ts('tab-agents').click(); s.wait_for_timeout(1200)
    check('staff sees the account agents', 'Caspian Sea Logistics' in ts('agents-db').inner_text())
    ts('nav-account').click(); s.wait_for_timeout(800)
    check('staff cannot invite staff (client only)', s.locator('[data-testid=invite-role] option[value=staff]').count() == 0)
    check('staff cannot remove owner', ts(f'member-remove-{OWNER}').count() == 0)
    a.wait_for_timeout(800)
    check('owner sees staff member, invite used', STAFF in t('team-members').inner_text() and t('invites-none').is_visible())
    # ── unrelated account: no cross-tenant data ──
    o = page(); to = lambda x: o.locator(f'[data-testid="{x}"]')
    o.goto(URL, wait_until='load'); signup(o, OTHER, 'Other C'); verify(OTHER)
    to('verify-continue').click(); o.wait_for_selector('[data-testid=onboarding]', timeout=15000)
    to('onb-lang-fa').click(); o.wait_for_timeout(200)
    check('FA onboarding RTL', to('onboarding').get_attribute('dir') == 'rtl')
    to('onb-name').fill('شرکت حمل نمونه'); o.screenshot(path=f'{SHOTS}/10-onboarding-fa.png')
    to('onb-next').click(); to('onb-create').click(); o.wait_for_selector('[data-testid=auth-live]', timeout=15000)
    to('tab-agents').click(); o.wait_for_timeout(1200)
    check('second account sees none of the first account agents', 'Caspian' not in to('agents-db').inner_text() and to('agents-empty').is_visible())
    o.screenshot(path=f'{SHOTS}/11-fa-second-account-agents-empty.png')
    to('nav-account').click(); o.wait_for_timeout(800)
    check('second account team = only itself', OWNER not in to('team-members').inner_text() and STAFF not in to('team-members').inner_text())
    # Owner removes staff -> staff loses access
    a.once('dialog', lambda d: d.accept()); t(f'member-remove-{STAFF}').click(); a.wait_for_timeout(1200)
    check('owner removed staff', STAFF not in t('team-members').inner_text())
    s.reload(wait_until='load'); s.wait_for_timeout(2500)
    check('removed staff is out of the account', ts('auth-live').count() == 0)
    b.close()
real_errs = [e for e in errs if 'permission' not in e.lower()]
check('no page errors', not real_errs)
for e in real_errs[:5]: print('  error:', e)
print(f'\n{len(fails)} failed' if fails else '\nALL PASS')
sys.exit(1 if fails else 0)
