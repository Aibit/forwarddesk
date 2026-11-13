"""Bookings: New booking has no step picker (starts at the first step), "Update client" in the drawer moves the booking
on and opens the matching client message (wa.me + Inbox), no Jalali year anywhere, phone tariffs (390 px) without
overlap or clipping, and no text under inputs / cut at the screen edge on the main screens at 375/390 px.

  python3 scripts/step-update-smoke.py [url] [shots-dir]
"""
import os, re, sys, json, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5199/forwarddesk/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
DEMO = URL + ('&' if '?' in URL else '?') + 'demo'
fails, errs = [], []
def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name)
    if not cond: fails.append(name)
def shot(pg, name, loc=None, full=False):
    if not SHOTS: return
    os.makedirs(SHOTS, exist_ok=True)
    (loc or pg).screenshot(path=os.path.join(SHOTS, name), **({} if loc else {'full_page': full}))

JAL_YEAR = re.compile(r'1405|1404|۱۴۰[0-9]|١٤٠[0-9]')
# Text under a form control, or cut at the screen edge outside a scroll container / ellipsis.
SCAN = r"""() => {
  const vw = window.innerWidth, out = [];
  const vis = (r) => r.width > 1 && r.height > 1;
  const ctrls = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea')].filter(e => vis(e.getBoundingClientRect()) && e.offsetParent);
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), texts = [];
  while (tw.nextNode()) {
    const t = tw.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el || !el.offsetParent || el.closest('select,textarea,option,[aria-hidden=true],.wa-modal-bg')) continue;
    const rg = document.createRange(); rg.selectNodeContents(t);
    for (const r of rg.getClientRects()) if (vis(r)) texts.push({ r, el, s: t.textContent.trim().slice(0, 40) });
  }
  for (const c of ctrls) { const a = c.getBoundingClientRect();
    for (const t of texts) { if (c.contains(t.el)) continue; const b = t.r;
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) out.push(`"${t.s}" under ${c.tagName.toLowerCase()}`); } }
  for (const t of texts) { if (t.r.right <= vw + 1 && t.r.left >= -1) continue;
    let ok = !!t.el.closest('.nd-side'), p = t.el;
    while (!ok && p && p !== document.body) { const cs = getComputedStyle(p);
      if (((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) || (cs.textOverflow === 'ellipsis' && cs.overflowX === 'hidden')) ok = true; p = p.parentElement; }
    if (!ok) out.push(`"${t.s}" cut at x=${Math.round(t.r.left)}..${Math.round(t.r.right)}`); }
  return [...new Set(out)].slice(0, 10);
}"""
TARIFF_BOXES = r"""() => [...document.querySelectorAll('[data-testid=tariffs] .j-tariff')].map(t => {
  const q = (s) => { const e = t.querySelector(s); const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, sw: e.scrollWidth, cw: e.clientWidth, lh: parseFloat(getComputedStyle(e).lineHeight) || 20 }; };
  return { name: t.querySelector('.j-tariff-name').textContent, n: q('.j-tariff-name'), by: q('.j-tariff-by'), i: q('input'), u: q('.j-unit') };
})"""
def overlap(a, b): return min(a['r'], b['r']) - max(a['l'], b['l']) > 0.5 and min(a['b'], b['b']) - max(a['t'], b['t']) > 0.5

def start(pg, lang='en'):
    pg.goto(DEMO, wait_until='networkidle')
    if pg.locator('[data-testid=start-demo]').count(): pg.click('[data-testid=start-demo]')
    pg.evaluate(f"localStorage.setItem('fd-ui-lang', '{lang}')"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(400)

def nav(pg, v):
    if pg.viewport_size['width'] < 800 and not pg.locator('.nd-side.open').count(): pg.click('[data-testid=nav-open]'); pg.wait_for_timeout(250)
    pg.click(f'[data-testid=nav-{v}]'); pg.wait_for_timeout(450)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 950})
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    tid = lambda t: pg.locator(f'[data-testid="{t}"]')
    pg.goto(DEMO, wait_until='networkidle')
    pg.evaluate("localStorage.removeItem('fd.jobs.moves.v1'); localStorage.removeItem('fd.jobs.extra.v1')")
    start(pg)

    # ── 1. New booking: no step picker, starts at the first step ──
    for L, word in [('en', 'New booking'), ('es', 'Nueva reserva'), ('fa', 'بوکینگ جدید'), ('ar', 'حجز جديد')]:
        tid(f'ui-lang-{L}').click(); pg.wait_for_timeout(150)
        nav(pg, 'jobs'); tid('job-new').click(); pg.wait_for_timeout(250)
        f = tid('job-new-form')
        sels = f.locator('select').evaluate_all('els => els.map(e => e.dataset.testid)')
        check(f'{L.upper()}: New booking form has no step/status select (only {sels})', tid('nj-step').count() == 0 and sels == ['nj-client'] and word in f.inner_text())
        check(f'{L.upper()}: form says it starts at E1', 'E1' in tid('nj-starts').inner_text())
        if L == 'en': shot(pg, 'create-form-en.png', f)
        tid('nj-dir-import').click(); pg.wait_for_timeout(100)
        check(f'{L.upper()}: import booking starts at I1', 'I1' in tid('nj-starts').inner_text())
        if L != 'en': f.locator('button.btn.ghost').first.click()
        else:
            tid('nj-dir-export').click(); tid('nj-pod').fill('Sample port'); tid('nj-commodity').fill('Sample cargo'); tid('nj-create').click(); pg.wait_for_timeout(500)
            d = tid('job-detail')
            check('EN: created booking opens at E1 (Find customers)', d.count() == 1 and d.locator('.j-phases li.cur').inner_text().startswith('E1'))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    tid('ui-lang-en').click(); pg.wait_for_timeout(150)

    # ── 2. Drawer: Update client = next step + matching client message ──
    nav(pg, 'jobs'); tid('job-FD-E-1042').click(); pg.wait_for_timeout(300)
    d = tid('job-detail')
    before = d.locator('.j-phases li.cur bdi').inner_text()
    tid('job-update').click(); pg.wait_for_timeout(200)
    check(f'drawer: "Update client" opens the step panel (now {before})', tid('ju-panel').count() == 1 and before in tid('ju-now').inner_text())
    nxt = 'E' + str(int(before[1:]) + 1)
    check(f'drawer: next step ({nxt}) is the default', tid('ju-step').input_value() == nxt)
    check('drawer: step timeline still visible with the panel open', d.locator('.j-phases').is_visible())
    check('drawer: all steps of the direction can be picked', tid('ju-step').locator('option').count() == 23)
    shot(pg, 'update-panel-en.png')
    tid('ju-apply').click(); pg.wait_for_timeout(400)
    dlg = tid('wa-dialog')
    check('drawer: moving opens the client message (WhatsApp preview)', dlg.count() == 1 and nxt in dlg.locator('h2').inner_text())
    check(f'drawer: booking moved to {nxt} (timeline + log)', d.locator('.j-phases li.cur bdi').inner_text() == nxt and f'{before} → {nxt}' in d.inner_text())
    check('message: draft B/L template for E19, booking reference in the text', tid('wa-tpl').input_value() == 'draftBl' and 'FD-E-1042' in tid('wa-text').input_value())
    tid('wa-lang-en').click(); pg.wait_for_timeout(100)
    msg = tid('wa-text').input_value()
    href = tid('wa-open').get_attribute('href') or ''
    check('message: wa.me link carries the message', href.startswith('https://wa.me/') and urllib.parse.unquote(href.split('text=')[1]) == msg if 'text=' in href else False)
    check('message: "Send from Inbox" offered (conversation linked to this booking)', tid('wa-inbox').count() == 1)
    shot(pg, 'update-message-en.png')
    with ctx.expect_page() as pop: tid('wa-open').click()
    pop.value.close(); pg.wait_for_timeout(300)
    check('client update logged as opened in WhatsApp on the booking', tid('job-wa-log').count() == 1 and 'draft' in tid('job-wa-log').inner_text().lower())
    check('"Moved to" confirmation stays in the drawer', tid('ju-done').count() == 1 and nxt in tid('ju-done').inner_text())
    tid('ju-write').click(); pg.wait_for_timeout(300)
    tid('wa-lang-en').click(); pg.wait_for_timeout(100)
    msg2 = tid('wa-text').input_value()
    tid('wa-inbox').click(); pg.wait_for_timeout(900)
    check('Inbox path: Inbox opens with the client update in the composer', tid('inbox-text').count() == 1 and tid('inbox-text').input_value() == msg2)
    # pick another step, move without a message
    nav(pg, 'jobs'); tid('job-FD-E-1038').click(); pg.wait_for_timeout(300)
    cur = tid('job-detail').locator('.j-phases li.cur bdi').inner_text()
    tid('job-update').click(); tid('ju-step').select_option('E23'); tid('ju-move-only').click(); pg.wait_for_timeout(300)
    check(f'pick another step: {cur} → E23 without a message', tid('wa-dialog').count() == 0 and tid('job-detail').locator('.j-phases li.cur bdi').inner_text() == 'E23')
    tid('ju-write').click(); pg.wait_for_timeout(300); tid('wa-lang-en').click(); pg.wait_for_timeout(100)
    t = tid('wa-text').input_value()
    check('step without its own alert → "Booking update" message naming the step', tid('wa-tpl').input_value() == 'stepUpdate' and 'Now: Docs to buyer (E23)' in t and 'FD-E-1038' in t)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(400); nav(pg, 'jobs')
    tid('job-FD-E-1042').click(); pg.wait_for_timeout(300)
    check('moves are kept after reload (demo: this browser)', tid('job-detail').locator('.j-phases li.cur bdi').inner_text() == nxt)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)

    # ── 3. AR + FA drawer flow ──
    for L, btn, ttl in [('ar', 'تحديث العميل', 'تحديث العميل'), ('fa', 'اطلاع به مشتری', 'اطلاع به مشتری')]:
        tid(f'ui-lang-{L}').click(); pg.wait_for_timeout(200)
        tid('job-FD-I-0877').click(); pg.wait_for_timeout(300)
        d = tid('job-detail'); c0 = d.locator('.j-phases li.cur bdi').inner_text()
        check(f'{L.upper()}: drawer button reads "{btn}"', tid('job-update').inner_text().strip() == btn)
        tid('job-update').click(); pg.wait_for_timeout(200)
        panel = tid('ju-panel').inner_text()
        check(f'{L.upper()}: update panel in {L.upper()} only (no Latin words besides codes)', not re.search(r'[A-Za-z]{3,}', re.sub(r'[EI]\d+|B/L|DO|THC|MSDS|WhatsApp', '', panel)))
        if L == 'ar': shot(pg, 'update-panel-ar.png')
        tid('ju-apply').click(); pg.wait_for_timeout(400)
        c1 = d.locator('.j-phases li.cur bdi').inner_text()
        check(f'{L.upper()}: moved {c0} → {c1} and the message opened', c1 == 'I' + str(int(c0[1:]) + 1) and tid('wa-dialog').count() == 1 and ttl in tid('wa-dialog').locator('h2').inner_text())
        if L == 'ar': shot(pg, 'update-message-ar.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(150); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)

    # ── 4. No Jalali year anywhere (incl. a tariff table saved by an older version) ──
    pg.evaluate("""() => { const k = 'fd-tariffs-v1'; const t = JSON.parse(localStorage.getItem(k) || '{}'); t.year = '1405 (2026/27)'; localStorage.setItem(k, JSON.stringify(t)); }""")
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(300)
    seen = []
    for L in ['en', 'es', 'fa', 'ar']:
        tid(f'ui-lang-{L}').click(); pg.wait_for_timeout(150)
        for v in ['jobs', 'inbox', 'finance', 'clients', 'portal', 'quote', 'pipeline', 'whatsnew']:
            nav(pg, v); txt = pg.inner_text('body')
            m = JAL_YEAR.search(txt)
            if m: seen.append(f'{L}/{v}: {m.group(0)}')
        nav(pg, 'jobs')
        y = tid('tariffs-year').inner_text()
        check(f'{L.upper()}: tariffs title shows 2026/27 only ({y})', y in ('2026/27', '۲۰۲۶/۲۷', '٢٠٢٦/٢٧'))
    check(f'no Jalali year (1405 / ۱۴۰x) on any screen in any language {seen[:4]}', not seen)
    src = urllib.request.urlopen(URL).read().decode('utf-8', 'replace') if URL.startswith('http') else ''
    check('index.html asks browsers not to cache it', 'http-equiv="Cache-Control"' in src and 'no-cache' in src)
    try:
        v = json.loads(urllib.request.urlopen(URL.rstrip('/') + '/version.json').read())
        check('version.json published for the reload notice', bool(v.get('build')))
    except Exception:
        print('SKIP version.json (dev server)')
    ctx.close()

    # ── 5. Phones: tariffs one per row, no overlap / clipping; main screens clean at 375 and 390 ──
    for L in ['en', 'fa']:
        for w in [390, 375]:
            ph = b.new_context(viewport={'width': w, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
            ph.on('pageerror', lambda e: errs.append(str(e)))
            start(ph, L)
            boxes = ph.evaluate(TARIFF_BOXES)
            bad = []
            for t in boxes:
                parts = [t['n'], t['by'], t['i'], t['u']]
                if any(overlap(parts[i], parts[j]) for i in range(4) for j in range(i + 1, 4)): bad.append('overlap ' + t['name'])
                if t['u']['sw'] > t['u']['cw'] + 1 or t['n']['sw'] > t['n']['cw'] + 1: bad.append('clipped ' + t['name'])
                if any(x['r'] > w + 0.5 or x['l'] < -0.5 for x in parts): bad.append('off-screen ' + t['name'])
                if t['n']['b'] - t['n']['t'] > 2.5 * t['n']['lh']: bad.append('label one word per line ' + t['name'])
                if not (t['i']['t'] >= t['n']['b'] - 0.5): bad.append('input not below label ' + t['name'])
            tops = [t['n']['t'] for t in boxes]
            if len(set(round(x) for x in tops)) != len(tops): bad.append('two tariffs share a row')
            check(f'{L.upper()} {w}px: {len(boxes)} tariffs, one per row, label on its own line, no overlap/clipping {bad[:3]}', len(boxes) == 14 and not bad)
            src_ok = ('Lines / agents' in ph.locator('[data-testid=tariffs]').inner_text() and 'Port tariff' in ph.locator('[data-testid=tariffs]').inner_text()) if L == 'en' else ('خطوط / نمایندگان' in ph.locator('[data-testid=tariffs]').inner_text() and 'تعرفه بندر' in ph.locator('[data-testid=tariffs]').inner_text())
            check(f'{L.upper()} {w}px: source labels kept (Lines / agents · Port tariff)', src_ok)
            if w == 390:
                sec = ph.locator('[data-testid=tariffs]'); sec.scroll_into_view_if_needed()
                bb = sec.bounding_box(); sy = ph.evaluate('scrollY')
                if SHOTS:
                    os.makedirs(SHOTS, exist_ok=True)
                    ph.screenshot(path=os.path.join(SHOTS, f'tariffs-phone-{L}.png'), full_page=True, clip={'x': 0, 'y': bb['y'] + sy - 60, 'width': w, 'height': min(bb['height'] + 80, 1500)})
            issues = {}
            for v in ['jobs', 'inbox', 'finance', 'clients', 'portal', 'quote', 'pipeline', 'whatsnew']:
                nav(ph, v)
                sw = ph.evaluate('[document.documentElement.scrollWidth, innerWidth]')
                r = ph.evaluate(SCAN) + ([f'page scrolls sideways {sw}'] if sw[0] > sw[1] else [])
                if r: issues[v] = r[:3]
            check(f'{L.upper()} {w}px: no text under inputs or cut at the edge on the main screens {issues}', not issues)
            ph.context.close()

    check('no page errors' + (f' {errs[:3]}' if errs else ''), not errs)
    b.close()

print('\nALL PASS' if not fails else f'\n{len(fails)} failed')
sys.exit(1 if fails else 0)
