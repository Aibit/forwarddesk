"""Demo fixes smoke (release 0.12): cross-trade locals, China → Jebel Ali pricing, SAMPLE estimates, requested
services, one GP-fallback note, region-neutral demo in all four languages, old saved demo data reset, and a grep of
the built bundle. Usage: python3 scripts/demo-fixes-smoke.py [url]  (default http://localhost:5199/forwarddesk/)
Run `npm run build` first so the bundle grep sees the current code."""
import glob, os, re, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5199/forwarddesk/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []
def check(name, ok):
    print(('PASS ' if ok else 'FAIL ') + name)
    if not ok: fails.append(name)

FORBIDDEN = re.compile(r'\bBandar\b|\bAbbas\b|\bTehran\b|\+98[\s\d]|\bIRR\b|\bIran\b|Shahid Rajaee|build order|Ports Organization|Shipping Association|بندرعباس|بندر عباس|تهران|ایران|سازمان بنادر|انجمن کشتیرانی', re.I)

# ── 1 · built bundle ──
assets = glob.glob(os.path.join(ROOT, 'dist', 'assets', '*.js')) + glob.glob(os.path.join(ROOT, 'dist', '*.html')) + glob.glob(os.path.join(ROOT, 'dist', '*.csv'))
check(f'built bundle found ({len(assets)} files)', len(assets) > 0)
for pat, rx in [('Bandar', r'\bBandar\b'), ('Abbas', r'\bAbbas\b'), ('Tehran', r'\bTehran\b'), ('+98', r'\+98[\s\-\d]'),
                ('IRR', r'\bIRR\b'), ('build order', r'build order'), ('بندرعباس', r'بندر ?عباس'), ('تهران', r'تهران')]:
    hits = []
    for f in assets:
        s = open(f, encoding='utf-8', errors='ignore').read()
        for m in re.finditer(rx, s, re.I):
            ctx = s[max(0, m.start() - 12):m.end() + 12]
            if re.search(r'[A-Za-z0-9+/]{40,}', ctx): continue  # inside base64 data (fonts/images)
            hits.append(os.path.basename(f) + ': ' + ctx)
    check(f'bundle has no {pat!r}' + (f' {hits[:2]}' if hits else ''), not hits)
check('portal step reads "Loading at the port"', any('Loading at the port' in open(f, encoding='utf-8', errors='ignore').read() for f in assets))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    errs = []
    # ── 2 · old saved demo data is reset (demo-data version bump) ──
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?demo', wait_until='networkidle')
    pg.evaluate("""() => { localStorage.removeItem('fd.demodata');
      localStorage.setItem('fd.clients.v1', JSON.stringify([{ id: 'old', name: 'Old client Bandar Abbas', phone: '+98 21 000 0000' }]));
      localStorage.setItem('fd.jobs.extra.v1', JSON.stringify([{ id: 'OLD-1', pol: 'Bandar Abbas' }]));
      localStorage.setItem('fd-ui-lang', 'en'); localStorage.setItem('fd-tariffs-v1', JSON.stringify({ keep: 1 })); }""")
    pg.reload(wait_until='networkidle')
    st = pg.evaluate("() => ({ v: localStorage.getItem('fd.demodata'), c: localStorage.getItem('fd.clients.v1') || '', j: localStorage.getItem('fd.jobs.extra.v1') || '', lang: localStorage.getItem('fd-ui-lang'), t: localStorage.getItem('fd-tariffs-v1') })")
    check('old saved demo data dropped, version set to 2', st['v'] == '2' and 'Bandar' not in st['c'] and 'Bandar' not in st['j'])
    check('settings kept on reset (language, tariffs)', st['lang'] == 'en' and st['t'] == '{"keep":1}')
    if pg.locator('[data-testid=start-demo]').count(): pg.click('[data-testid=start-demo]')
    pg.click('[data-testid=ui-lang-en]')

    # ── 3 · quotes ──
    def quote(text):
        pg.click('[data-testid=nav-quote]'); pg.wait_for_timeout(200)
        pg.locator('textarea').first.fill(text); pg.wait_for_timeout(900)
        summ = pg.locator('[data-testid=quote-summary]').inner_text()
        issues = pg.locator('.q-issues').inner_text() if pg.locator('.q-issues').count() else ''
        lines = pg.locator('.q-table').inner_text() if pg.locator('.q-table').count() else ''
        return summ, issues, lines
    s, i, l = quote('Hi, need price for 1x40 Ningbo to Jebel Ali, general cargo, 20 tons, FOB, ready 25 Nov. Please include cargo insurance, cargo value USD 48,000, and customs clearance in Dubai.')
    check('Ningbo → Jebel Ali 1×40 is priced', 'NOT PRICED' not in s.upper() and 'Ocean freight' in l)
    check('insurance line (% of value, min) present', bool(re.search(r'insurance.*0\.35%.*48,000', l, re.I)))
    check('Dubai customs line (per declaration) present', 'customs clearance, Dubai' in l and 'per declaration' in l)
    check('requested services tagged requested + SAMPLE estimate', pg.locator('[data-testid=quote-line-requested]').count() >= 2 and pg.locator('[data-testid=sample-estimate-tag]').count() >= 2)
    check('SAMPLE estimate note under the table', pg.locator('[data-testid=sample-estimate-note]').count() == 1)
    for eq in ['20GP', '40GP', '40HC']:
        for pol in ['Shanghai', 'Ningbo', 'Qingdao', 'Shenzhen']:
            s, i, l = quote(f'1x{eq} {pol} to Jebel Ali, general cargo 12 tons, FOB, ready 25 Nov')
            ok = 'NOT PRICED' not in s.upper() and 'Ocean freight' in l and pg.locator('[data-testid=sample-estimate-tag]').count() == 0
            if not ok: check(f'{pol} → Jebel Ali {eq} priced from sample rates (no estimate)', False)
    check('China (4 ports) → Jebel Ali 20GP/40GP/40HC priced from sample rates', not any('→ Jebel Ali' in f for f in fails))

    s, i, l = quote('Hi, need price for 2x40HC Shanghai Yangshan to Barcelona, approx 18 tons per container, ready 20 Nov, FOB, general cargo. Thanks')
    check('cross-trade Shanghai → Barcelona priced', 'NOT PRICED' not in s.upper())
    check('cross-trade: no home-port local lines', pg.locator('[data-testid=trade-local-lines]').count() == 0 and 'Jebel Ali' not in l)
    check('cross-trade: says no leg at Jebel Ali', 'cross-trade' in pg.locator('.app').inner_text().lower())

    s, i, l = quote('hi need price 2x40 shanghai - barcelona asap pls')
    check('GP fallback: one message "priced using standard GP rates; confirm with the line"', i.lower().count('standard gp rates') == 1)
    check('no "priced anyway" / "Priced as standard"', not re.search(r'priced anyway|priced as standard', pg.locator('.app').inner_text(), re.I))
    amber = pg.locator('.q-issue', has_text='standard GP rates')
    if amber.count():
        col = amber.first.evaluate("e => getComputedStyle(e).borderColor + ' ' + getComputedStyle(e).backgroundColor + ' ' + e.className")
        check(f'GP fallback shown as to-confirm, not error ({col})', 'missing' not in col)

    s, i, l = quote('1x20GP Qingdao to Rotterdam, 15 tons, FOB, ready 1 Dec')
    check('lane with no sample rate gets a SAMPLE estimate, not "not priced"', 'NOT PRICED' not in s.upper() and pg.locator('[data-testid=sample-estimate-tag]').count() >= 1)

    # ── 4 · no Iranian ports/places/phones/currency on screens, every language ──
    for lang in ['en', 'es', 'fa', 'ar']:
        pg.click(f'[data-testid=ui-lang-{lang}]'); pg.wait_for_timeout(200)
        seen = []
        for nav in ['nav-desk', 'nav-jobs', 'nav-clients', 'nav-quote', 'nav-finance', 'nav-inbox', 'nav-pipeline']:
            if not pg.locator(f'[data-testid={nav}]').count(): continue
            pg.click(f'[data-testid={nav}]'); pg.wait_for_timeout(350)
            t = pg.locator('.app').inner_text()
            for tab in pg.locator('[data-testid^=tab-]').all():
                try: tab.click(); pg.wait_for_timeout(200); t += pg.locator('.app').inner_text()
                except Exception: pass
            m = FORBIDDEN.search(t)
            if m: seen.append(f'{nav}: …{t[max(0, m.start()-25):m.end()+10]}…')
        pg.click('[data-testid=nav-jobs]'); pg.wait_for_timeout(300)
        rows = pg.locator('[data-testid^=job-FD]')
        if rows.count():
            rows.first.click(); pg.wait_for_timeout(300)
            t = pg.locator('.app').inner_text(); m = FORBIDDEN.search(t)
            if m: seen.append(f'booking drawer: …{t[max(0, m.start()-25):m.end()+10]}…')
            pg.keyboard.press('Escape')
        check(f'{lang.upper()}: no Iranian ports/places/+98/IRR/internal notes on screens {seen[:2]}', not seen)
    # portal (client view)
    pg.click('[data-testid=ui-lang-en]'); pg.click('[data-testid=nav-portal]'); pg.wait_for_timeout(200)
    if pg.locator('[data-testid=portal-use-C]').count(): pg.click('[data-testid=portal-use-C]')
    else: pg.locator('[data-testid^=portal-use-]').first.click()
    pg.click('[data-testid=portal-submit]'); pg.wait_for_timeout(400)
    pt = pg.locator('[data-testid=portal]').inner_text()
    check('portal: no Iranian ports/places', not FORBIDDEN.search(pt))
    pg.click('[data-testid=portal-logout]')
    check(f'no page errors {errs[:2]}', not errs)
    b.close()
print(f'\n{len(fails)} failed' if fails else '\nALL PASS')
sys.exit(1 if fails else 0)
