"""App ↔ self-hosted accounts API, end to end in a real browser (nothing leaves the machine).

  cd server && ACCOUNTS=on WA_PROVIDER=mock PORT=8788 FD_DB_PATH=/tmp/fdacc/fd.sqlite WA_DB_PATH=/tmp/fdacc/wa.sqlite \
     APP_URL=http://localhost:5301/forwarddesk/ WA_CORS_ORIGINS=http://localhost:5301 ADMIN_EMAILS=owner@acme-freight.test \
     npx tsx src/index.ts > /tmp/fdacc/server.log
  VITE_API_URL=http://localhost:8788 npx vite --port 5301
  python3 scripts/accounts-e2e.py http://localhost:5301/forwarddesk/ http://localhost:8788 /tmp/fdacc/server.log [shot-dir]
"""
import json, re, sys, time, urllib.request
from playwright.sync_api import sync_playwright

APP, SRV, LOG = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
SHOTS = sys.argv[4] if len(sys.argv) > 4 else None
OWNER, PW = 'owner@acme-freight.test', 'quay-side-crane-7'
fails = []
def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name)
    if not cond: fails.append(name)
def call(method, path, body=None, tok=None):
    req = urllib.request.Request(SRV + path, data=None if body is None else json.dumps(body).encode(), method=method,
                                 headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {tok}'} if tok else {})})
    try: return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e: return {'status': e.code, **json.loads(e.read() or b'{}')}
def shot(pg, name, full=False):
    if SHOTS: pg.screenshot(path=f'{SHOTS}/{name}.png', full_page=full)
FORBIDDEN = re.compile(r'iran|bandar|tehran|\+98', re.I)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def ctx(w=1440, h=900, lang='en', mobile=False):
        c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
        c.add_init_script(f"if (!localStorage.getItem('fd-ui-lang')) localStorage.setItem('fd-ui-lang','{lang}')")
        return c
    errs = []
    c1 = ctx(); pg = c1.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    t = lambda x, page=None: (page or pg).locator(f'[data-testid="{x}"]')
    pg.goto(APP, wait_until='networkidle')
    check('start screen offers Create account / Sign in (enabled because an API is configured)', t('start-create').is_enabled() and t('start-signin').is_enabled() and t('start-accounts-soon').count() == 0)
    shot(pg, '01-start-screen')

    # ── sign up → onboarding → company workspace ──
    t('start-create').click()
    t('signup-name').fill('Ana Ruiz'); t('signin-email').fill(OWNER); t('signin-password').fill('short')
    t('signin-submit').click(); pg.wait_for_timeout(300)
    check('short password refused in the form (8+ characters)', t('signin-password').evaluate('e => !e.checkValidity()') and t('onb-name').count() == 0)
    t('signin-password').fill(PW); shot(pg, '02-create-account')
    t('signin-submit').click()
    t('onb-name').wait_for(timeout=8000)
    check('new login goes straight to company setup (no Firebase verify step)', t('onb-name').count() == 1)
    t('onb-name').fill('Acme Freight (sample)'); t('onb-country').fill('Spain'); t('onb-currency').select_option('EUR'); t('onb-ports').fill('Valencia, Barcelona')
    shot(pg, '03-company-setup')
    t('onb-next').click(); pg.wait_for_timeout(300); shot(pg, '04-company-review')
    t('onb-create').click()
    t('auth-live').wait_for(timeout=10000)
    check('live session pill shows company, email and owner', 'Acme Freight' in t('auth-live').inner_text() and OWNER in t('auth-live').inner_text())
    check('a new account starts empty (no SAMPLE bookings)', pg.locator('[data-testid^="job-FD-"]').count() == 0)
    tok = pg.evaluate("localStorage.getItem('fd.token')")
    me = call('GET', '/api/auth/me', tok=tok)
    ws = me['workspace']['id']
    check('server has the workspace with the owner', me['member']['role'] == 'owner' and me['workspace']['name'] == 'Acme Freight (sample)' and me['workspace']['baseCurrency'] == 'EUR')
    shot(pg, '05-live-empty-bookings')

    # ── data written in the UI lands in this workspace on the server ──
    t('nav-clients').click(); pg.wait_for_timeout(500)
    t('add-client').click(); pg.wait_for_timeout(300)
    form = t('client-form'); form.locator('input').first.fill('Sample Customer One')
    t('cf-save').click(); pg.wait_for_timeout(1500)
    docs = call('GET', '/api/ws/docs', tok=tok)['docs']
    cl = [d for d in docs if d['path'].startswith('clients/')]
    check('new client saved to the server (clients/ + clientPublic/ + agentPrefs/ docs)', len(cl) == 1 and cl[0]['data']['name'] == 'Sample Customer One'
          and any(d['path'].startswith('clientPublic/') for d in docs) and any(d['path'].startswith('agentPrefs/') for d in docs))
    cid = cl[0]['data']['id'] if cl else ''

    # a booking opened in the UI is saved as a workspace document
    t('nav-jobs').click(); pg.wait_for_timeout(500)
    t('job-new').click(); t('nj-pol').fill('Valencia'); t('nj-pod').fill('Jebel Ali'); t('nj-commodity').fill('Ceramic tiles (sample)')
    t('nj-line').fill('Line A (sample)'); t('nj-equip').fill('2x40HC'); t('nj-create').click(); pg.wait_for_timeout(1500)
    jobs = [d for d in call('GET', '/api/ws/docs', tok=tok)['docs'] if d['path'].startswith('jobs/') and d['data']]
    check(f"new booking saved on the server ({jobs[0]['path'] if jobs else '-'})", len(jobs) == 1 and jobs[0]['data']['pol'] == 'Valencia' and jobs[0]['data'].get('clientId') == cid)
    # a booking added by a colleague in another browser (here: straight through the API) appears by polling
    if jobs:
        j2 = dict(jobs[0]['data']); j2['id'] = j2['id'][:-1] + ('9' if j2['id'][-1] != '9' else '8'); j2['pod'] = 'Mundra'
        call('POST', '/api/ws/write', {'ops': [{'path': f"jobs/{j2['id']}", 'data': j2}]}, tok=tok)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(7000)
        check(f"booking {j2['id']} written elsewhere shows up within one poll", j2['id'] in pg.inner_text('body'))
        JOB = jobs[0]['data']['id']
    shot(pg, '06-live-booking-synced')

    # ── account settings: team + invite by link ──
    t('nav-account').click(); t('account-view').wait_for(timeout=5000); pg.wait_for_timeout(800)
    t('invite-role').select_option('client'); t('invite-client').select_option(cid)
    t('invite-send').click(); pg.wait_for_timeout(1200)
    link = t('invite-link').first.inner_text()
    check('client invite link created without an email (anyone with the link, once)', f'#join={ws}.' in link and 'Anyone with the link' in t('invites').inner_text())
    shot(pg, '07-account-team-invite', full=True)

    # ── client joins with the link in another browser ──
    c2 = ctx(); p2 = c2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)))
    p2.goto(link, wait_until='networkidle')
    check('join link opens Create account with the invite note', t('signin-invited', p2).count() == 1)
    t('signin-email', p2).fill('buyer@customer-one.test'); t('signin-password', p2).fill('container-yard-3'); t('signin-submit', p2).click()
    t('onb-join', p2).wait_for(timeout=8000)
    check('invite code is pre-filled on the join step', ws in t('onb-join-code', p2).input_value())
    t('onb-join', p2).click()
    t('auth-live', p2).wait_for(timeout=10000)
    check('client lands in the portal, role client', 'client' in t('auth-live', p2).inner_text().lower())
    p2.wait_for_timeout(800)
    check('client sees its booking in the portal', JOB in p2.inner_text('body'))
    shot(p2, '08-client-portal')
    ctok = p2.evaluate("localStorage.getItem('fd.token')")
    check('client token cannot read the full client record (margin/notes)', call('GET', f'/api/ws/doc?path=clients/{cid}', tok=ctok).get('status') == 403)
    check('client token cannot read the team', call('GET', '/api/workspace/team', tok=ctok).get('status') == 403)

    # ── waitlist (landing form posts here) + admin view ──
    call('POST', '/api/waitlist', {'email': 'ops@sample-forwarder.test', 'company': 'Sample Forwarder LLC', 'role': 'Operations', 'country': 'United Arab Emirates', 'shipments': '10-50', 'note': 'Jebel Ali and Mundra lanes, mostly FCL.', 'consent': True, 'source': 'hero', 'lang': 'en'})
    call('POST', '/api/waitlist', {'email': 'hola@ejemplo-transitos.test', 'company': 'Ejemplo Tránsitos SL', 'country': 'Spain', 'shipments': '50-200', 'consent': True, 'source': 'cta', 'lang': 'es'})
    pg.reload(wait_until='networkidle'); t('auth-live').wait_for(timeout=10000)
    t('nav-account').click(); t('waitlist-table').wait_for(timeout=6000)
    check('admin sees the waitlist with both sign-ups', t('wl-ops@sample-forwarder.test').count() == 1 and t('wl-hola@ejemplo-transitos.test').count() == 1)
    t('wl-ops@sample-forwarder.test').locator('[data-testid=wl-status]').select_option('contacted'); pg.wait_for_timeout(800)
    check('status change saved', [e for e in call('GET', '/api/admin/waitlist', tok=pg.evaluate("localStorage.getItem('fd.token')"))['entries'] if e['email'].startswith('ops@')][0]['status'] == 'contacted')
    t('waitlist-admin').scroll_into_view_if_needed(); shot(pg, '09-waitlist-admin')

    # ── sign out → sign in → wrong password ──
    t('auth-signout').click(); pg.wait_for_timeout(800)
    check('signed out → start screen again, token removed', t('start-screen').count() == 1 and pg.evaluate("localStorage.getItem('fd.token')") is None)
    t('start-signin').click(); t('signin-email').fill(OWNER); t('signin-password').fill('wrong-password'); t('signin-submit').click(); pg.wait_for_timeout(800)
    check('wrong password → amber "not recognised"', 'not recognised' in t('signin-error').inner_text())
    shot(pg, '10-signin-wrong-password')

    # ── forgot password → console mail link → new password ──
    t('signin-forgot').click(); t('signin-email').fill(OWNER); t('signin-submit').click(); pg.wait_for_timeout(1200)
    check('reset request answers the same for any email', t('signin-note').count() == 1)
    link = re.findall(r'(http\S+#reset=[A-Za-z0-9_-]+)', open(LOG).read())
    check('console mail adapter logged a reset link', bool(link))
    pg.goto(link[-1], wait_until='networkidle'); t('reset-screen').wait_for(timeout=5000)
    t('reset-pw').fill('new-harbour-pass-1'); t('reset-pw2').fill('different-pass-1'); t('reset-submit').click(); pg.wait_for_timeout(300)
    check('mismatched passwords refused', 'different' in t('reset-error').inner_text())
    t('reset-pw2').fill('new-harbour-pass-1'); shot(pg, '11-reset-password')
    t('reset-submit').click(); t('auth-live').wait_for(timeout=10000)
    check('new password saved and signed straight in', OWNER in t('auth-live').inner_text())
    check('old password no longer works', call('POST', '/api/auth/signin', {'email': OWNER, 'password': PW}).get('status') == 401)

    # ── languages: Spanish, Persian and Arabic sign-in dialogs, Gregorian dates ──
    for lang in ['es', 'fa', 'ar']:
        c3 = ctx(lang=lang); p3 = c3.new_page()
        p3.goto(APP, wait_until='networkidle'); t('start-signin', p3).click(); p3.wait_for_timeout(300)
        d = t('signin-dialog', p3)
        check(f'{lang}: dialog in {lang} and {"RTL" if lang != "es" else "LTR"}', d.get_attribute('lang') == lang and d.get_attribute('dir') == ('ltr' if lang == 'es' else 'rtl'))
        shot(p3, f'12-signin-{lang}')
        c3.close()

    # ── phone width ──
    c4 = ctx(390, 844, mobile=True); p4 = c4.new_page()
    p4.goto(APP, wait_until='networkidle'); t('start-signin', p4).click()
    t('signin-email', p4).fill(OWNER); t('signin-password', p4).fill('new-harbour-pass-1'); t('signin-submit', p4).click()
    t('auth-live', p4).wait_for(state='attached', timeout=10000); p4.wait_for_timeout(600)
    check('phone: no horizontal scroll when signed in', p4.evaluate('document.documentElement.scrollWidth') <= 391)
    shot(p4, '13-phone-live')
    p4.locator('[data-testid=nav-open]').click(); p4.wait_for_timeout(300); t('nav-account', p4).click(); p4.wait_for_timeout(1500)
    shot(p4, '14-phone-account', full=True)
    check('phone: account page fits 390 px', p4.evaluate('document.documentElement.scrollWidth') <= 391)
    t('waitlist-admin', p4).scroll_into_view_if_needed(); p4.wait_for_timeout(300); shot(p4, '15-phone-waitlist')
    check('phone: waitlist card fits 390 px', t('waitlist-admin', p4).evaluate('e => e.getBoundingClientRect().right') <= 391)

    allt = pg.inner_text('body') + p2.inner_text('body')
    hit = FORBIDDEN.search(allt)
    check('no Iran/Bandar/Tehran/+98 on these screens' + (f" ({allt[max(0, hit.start()-30):hit.end()+10]!r})" if hit else ''), not hit)
    check(f'no page errors ({errs[:2]})', not errs)
    b.close()

print(f'\n{len(fails)} failed' if fails else '\nALL PASS')
sys.exit(1 if fails else 0)
