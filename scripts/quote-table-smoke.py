"""Quote options comparison table: render, sorting, badges, filters, column chooser (localStorage), select,
side-by-side compare, export (.xlsx parsed with openpyxl, .csv with BOM) vs the on-screen table, RTL (AR/FA), phone cards.

  python3 scripts/quote-table-smoke.py [url] [shots-dir]
"""
import csv, io, os, re, sys, datetime, html
from playwright.sync_api import sync_playwright
import openpyxl

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5199/forwarddesk/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
fails, errs = [], []
def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name)
    if not cond: fails.append(name)
def shot(loc, name):
    if SHOTS: os.makedirs(SHOTS, exist_ok=True); loc.screenshot(path=os.path.join(SHOTS, name))

def open_quote(pg, lang='en'):
    pg.goto(URL + ('&' if '?' in URL else '?') + 'demo', wait_until='networkidle')
    if pg.locator('[data-testid=start-demo]').count(): pg.click('[data-testid=start-demo]')
    if lang != 'en' or pg.viewport_size['width'] > 800: pg.click(f'[data-testid=ui-lang-{lang}]'); pg.wait_for_timeout(150)
    if pg.viewport_size['width'] < 800: pg.click('[data-testid=nav-open]'); pg.wait_for_timeout(300)
    pg.click('[data-testid=nav-quote]'); pg.wait_for_timeout(250)
    pg.locator('.q-samples button').first.click(); pg.wait_for_timeout(700)
    pg.locator('[data-testid=quote-options]').scroll_into_view_if_needed()

def table(pg):
    """On-screen table: header labels + per row {col: data-v}."""
    heads = pg.eval_on_selector_all('[data-testid=qt-table] thead th', 'els => els.map(e => [e.dataset.col, e.innerText.replace(/[▲▼↕]/g, "").trim()])')
    rows = pg.eval_on_selector_all('[data-testid=qt-table] tbody tr', 'trs => trs.map(tr => Object.fromEntries([...tr.querySelectorAll("td")].map(td => [td.dataset.col, td.dataset.v])))')
    return heads, rows
num = lambda v: float(v) if v not in (None, '') else None

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    tid = lambda t: pg.locator(f'[data-testid="{t}"]')
    open_quote(pg)

    # ── render ──
    heads, rows = table(pg)
    cols = [h[0] for h in heads]
    check('table renders one row per option (3 sample lines)', len(rows) == 3)
    check('default columns incl. route, ETD/ETA, transit, cut-off, free time, breakdown, buy/sell/margin, validity, win rate, notes',
          all(c in cols for c in ['carrier', 'route', 'etd', 'eta', 'transit', 'freq', 'cutoff', 'freeD', 'equip', 'freight', 'surch', 'buy', 'sell', 'margin', 'marginPct', 'valid', 'winRate', 'notes']))
    check('every option labelled SAMPLE', pg.locator('[data-testid^=qt-sample-]:not([data-testid=qt-sample-note])').count() == 3 and tid('qt-sample-note').is_visible())
    check('margin = sell − buy, margin % = margin / sell', all(abs(num(r['sell']) - num(r['buy']) - num(r['margin'])) < 0.02 and abs(num(r['marginPct']) - num(r['margin']) / num(r['sell'])) < 0.001 for r in rows))
    check('cut-off is ETD − 48 h', all((datetime.date.fromisoformat(r['etd']) - datetime.date.fromisoformat(r['cutoff'])).days == 2 for r in rows))
    sticky = pg.evaluate("() => { const th = document.querySelector('[data-testid=qt-table] th.qt-first'); const td = document.querySelector('[data-testid=qt-table] td.qt-first'); return getComputedStyle(th).position + '/' + getComputedStyle(td).position }")
    check('sticky header + first column', sticky == 'sticky/sticky')
    fits = pg.evaluate("() => { const s = document.querySelector('[data-testid=qt-scroll]'); return s.getBoundingClientRect().right <= window.innerWidth }")
    check('table fits the 1280 px viewport (scrolls inside)', fits)

    # ── badges ──
    def with_badge(bname): return [r for r in rows if pg.locator(f'[data-testid=qt-row-{0}]').count() >= 0][0:0]
    badge_rows = pg.eval_on_selector_all('[data-testid=qt-table] tbody tr', 'trs => trs.map(tr => [...tr.querySelectorAll("[data-testid^=qt-badge-]")].map(b => b.dataset.testid.replace("qt-badge-", "")))')
    def owners(bn): return [rows[i] for i, bs in enumerate(badge_rows) if bn in bs]
    check('Cheapest badge on the lowest sell', len(owners('cheapest')) >= 1 and all(num(r['sell']) == min(num(x['sell']) for x in rows) for r in owners('cheapest')))
    check('Fastest badge on the shortest transit', len(owners('fastest')) >= 1 and all(num(r['transit']) == min(num(x['transit']) for x in rows) for r in owners('fastest')))
    check('Best margin badge on the highest margin', len(owners('bestMargin')) >= 1 and all(num(r['margin']) == max(num(x['margin']) for x in rows) for r in owners('bestMargin')))
    check('Longest free time badge on the most destination free days', len(owners('longestFree')) >= 1 and all(num(r['freeD']) == max(num(x['freeD']) for x in rows) for r in owners('longestFree')))
    amber = pg.locator('[data-testid^=qt-expired-], [data-testid^=qt-expiring-]')
    check('expired/expiring validity shown as amber chip', amber.count() >= 1 and 'amber' in (amber.first.get_attribute('class') or ''))
    reds = pg.evaluate("""() => [...document.querySelectorAll('.qt *')].filter(e => { const c = getComputedStyle(e).color.match(/\\d+/g).map(Number); return c[0] > 170 && c[1] < 90 && c[2] < 90 }).length""")
    check('no error-looking red in the table', reds == 0)

    # ── sorting ──
    tid('qt-sort-sell').click(); pg.wait_for_timeout(150)
    s1 = [num(r['sell']) for r in table(pg)[1]]
    tid('qt-sort-sell').click(); pg.wait_for_timeout(150)
    s2 = [num(r['sell']) for r in table(pg)[1]]
    check('sort by sell ascending then descending', s1 == sorted(s1) and s2 == sorted(s2, reverse=True))
    tid('qt-sort-transit').click(); pg.wait_for_timeout(150)
    tt = [num(r['transit']) for r in table(pg)[1]]
    check('sort by transit days', tt == sorted(tt))
    tid('qt-sort-carrier').click(); pg.wait_for_timeout(150)
    nn = [r['carrier'] for r in table(pg)[1]]
    check('sort by line name', nn == sorted(nn, key=str.lower))
    tid('qt-sort-carrier').click(); tid('qt-sort-carrier').click(); pg.wait_for_timeout(150)  # desc, then off

    # ── filters ──
    tid('qt-f-direct').check(); pg.wait_for_timeout(150)
    d = table(pg)[1]
    check('direct-only hides transhipment options', len(d) < 3 and all(not r['route'].lower().startswith('transhipment') for r in d))
    tid('qt-f-direct').uncheck(); tid('qt-f-valid').check(); pg.wait_for_timeout(150)
    v = table(pg)[1]
    check('valid-only hides options with expired rates', len(v) < 3 and pg.locator('[data-testid^=qt-expired-]').count() == 0)
    tid('qt-f-valid').uncheck(); pg.wait_for_timeout(100)
    check('mode filter present', tid('qt-f-mode').count() == 1)

    # ── column toggle (remembered) ──
    tid('qt-cols').click(); tid('qt-col-freq').uncheck(); tid('qt-col-thcD').check(); pg.keyboard.press('Escape'); pg.mouse.click(5, 5); pg.wait_for_timeout(150)
    c2 = [h[0] for h in table(pg)[0]]
    check('column chooser hides/shows columns', 'freq' not in c2 and 'thcD' in c2)
    open_quote(pg)
    c3 = [h[0] for h in table(pg)[0]]
    check('column choice remembered after reload (localStorage)', 'freq' not in c3 and 'thcD' in c3)

    # ── select + compare ──
    tid('qt-select-1').click(); pg.wait_for_timeout(250)
    picked = pg.locator('[data-testid=qt-row-1]').get_attribute('data-carrier')
    check('Select picks the option for the quote', tid('qt-selected-1').count() == 1 and picked in tid('quote-text').inner_text())
    check('compare disabled with < 2 ticked', tid('qt-compare').is_disabled())
    for i in range(3): tid(f'qt-cmp-{i}').check()
    tid('qt-compare').click(); pg.wait_for_timeout(200)
    check('side-by-side compare for checked rows', tid('qt-compare-panel').is_visible() and pg.locator('[data-testid^=qt-cmp-col-]').count() == 3 and pg.locator('.qt-cmp-v.best').count() > 3)
    shot(tid('qt-compare-panel'), 'compare-en.png')
    tid('qt-cmp-2').uncheck(); pg.wait_for_timeout(100)
    check('compare follows the ticks', pg.locator('[data-testid^=qt-cmp-col-]').count() == 2)
    tid('qt-compare-close').click()

    # ── export (sorted by sell desc + valid-only, visible columns) ──
    tid('qt-sort-sell').click(); tid('qt-sort-sell').click(); pg.wait_for_timeout(100)
    tid('qt-f-valid').check(); pg.wait_for_timeout(150)
    heads, rows = table(pg)
    shot(tid('quote-options'), 'table-en.png') if False else None
    tid('qt-export').click()
    with pg.expect_download() as dl: tid('qt-exp-xlsx').click()
    d = dl.value; path = '/tmp/qt-export.xlsx'; d.save_as(path)
    check('xlsx file name FD-quote-<ref>-options-<date>.xlsx', re.fullmatch(r'FD-quote-Q-\d{8}-\d{3}-options-\d{4}-\d{2}-\d{2}\.xlsx', d.suggested_filename) is not None)
    wb = openpyxl.load_workbook(path)
    ws = wb.worksheets[0]
    check('xlsx: two sheets (options + quote details)', len(wb.worksheets) == 2 and wb.sheetnames[0] == 'Options' and wb.sheetnames[1] == 'Quote details')
    check('xlsx: header = visible columns in screen order', [c.value for c in ws[1]] == [h[1].replace(' (USD)', '') for h in heads])
    check('xlsx: bold header, frozen header, autofilter, column widths', all(c.font.b for c in ws[1]) and ws.freeze_panes == 'B2' and ws.auto_filter.ref is not None and ws.auto_filter.ref.startswith('A1:') and ws.column_dimensions['A'].width >= 20)
    check('xlsx: rows follow filters + sort', ws.max_row - 1 == len(rows) and [ws.cell(i + 2, 1).value for i in range(len(rows))] == [r['carrier'] for r in rows])
    ok_num, ok_fmt = True, True
    for ri, r in enumerate(rows):
        for ci, (k, _) in enumerate(heads):
            cell = ws.cell(ri + 2, ci + 1); want = r.get(k)
            if k in ('freight', 'surch', 'buy', 'sell', 'margin', 'thcD'):
                if want in ('', None, '0'): continue
                ok_num &= isinstance(cell.value, (int, float)) and abs(cell.value - float(want)) < 0.01
                ok_fmt &= 'USD' in cell.number_format
            elif k in ('marginPct', 'winRate') and want:
                ok_num &= isinstance(cell.value, (int, float)) and abs(cell.value - float(want)) < 1e-6; ok_fmt &= '%' in cell.number_format
            elif k in ('transit', 'freeD') and want:
                ok_num &= cell.value == int(float(want))
            elif k in ('etd', 'eta', 'cutoff', 'valid') and want:
                ok_num &= isinstance(cell.value, datetime.datetime) and cell.value.date().isoformat() == want
    check('xlsx: typed numbers/dates match the table', ok_num)
    check('xlsx: currency + percent number formats', ok_fmt)
    det = {r[0].value: r[1].value for r in wb.worksheets[1].iter_rows()}
    check('xlsx: quote details sheet', det.get('Origin') == 'Shanghai (Yangshan)' and det.get('Destination') == 'Barcelona' and 'SAMPLE' in str(det.get('Note')))
    # export preview screenshot (parsed workbook rendered as a table)
    if SHOTS:
        hv = ''.join(f'<th>{html.escape(str(c.value))}</th>' for c in ws[1])
        def fmt(c):
            v = c.value
            if v is None: return ''
            if isinstance(v, datetime.datetime): return v.date().isoformat()
            if isinstance(v, float) and '%' in c.number_format: return f'{v*100:.1f}%'
            if isinstance(v, (int, float)) and 'USD' in c.number_format: return f'{v:,.2f} USD'
            return html.escape(str(v))
        bv = ''.join('<tr>' + ''.join(f'<td class="{"n" if isinstance(c.value,(int,float)) else ""}">{fmt(c)}</td>' for c in row) + '</tr>' for row in ws.iter_rows(min_row=2))
        dv = ''.join(f'<tr><th>{html.escape(str(k))}</th><td>{html.escape(str(v))}</td></tr>' for k, v in det.items())
        pv = ctx.new_page(); pv.set_viewport_size({'width': 1600, 'height': 900})
        pv.set_content(f"""<html><body style="font:13px Inter,Arial;margin:16px;color:#37352f"><h3>{html.escape(d.suggested_filename)} — parsed with openpyxl</h3>
        <p>Sheet “{wb.sheetnames[0]}” · frozen at {ws.freeze_panes} · autofilter {ws.auto_filter.ref} · typed cells: numbers with “USD”/% formats, real dates</p>
        <table border=1 cellspacing=0 cellpadding=5 style="border-collapse:collapse;border-color:#ddd"><tr style="background:#f1f1ef;font-weight:bold">{hv}</tr>{bv}</table>
        <p>Sheet “{wb.sheetnames[1]}”</p><table border=1 cellspacing=0 cellpadding=5 style="border-collapse:collapse;border-color:#ddd">{dv}</table>
        <style>td.n{{text-align:right;font-family:monospace}}th{{text-align:left}}</style></body></html>""")
        pv.screenshot(path=os.path.join(SHOTS, 'export-parsed.png'), full_page=True); pv.close()
    tid('qt-export').click()
    with pg.expect_download() as dl2: tid('qt-exp-csv').click()
    raw = open(dl2.value.path(), 'rb').read()
    check('csv: UTF-8 with BOM, .csv name', raw.startswith(b'\xef\xbb\xbf') and dl2.value.suggested_filename.endswith('.csv'))
    rr = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
    check('csv: rows/numbers match the table', len(rr) - 1 == len(rows) and all(abs(float(rr[i + 1][[h[0] for h in heads].index('sell')]) - float(r['sell'])) < 0.01 for i, r in enumerate(rows)))
    tid('qt-export').click(); tid('qt-exp-all').check()
    with pg.expect_download() as dl3: tid('qt-exp-xlsx').click()
    dl3.value.save_as('/tmp/qt-all.xlsx'); wa = openpyxl.load_workbook('/tmp/qt-all.xlsx').worksheets[0]
    hdr = [c.value for c in wa[1]]
    bk = [hdr.index(x) for x in ['Freight', 'BAF / surcharges', 'THC origin', 'THC destination', 'Local charges', 'Docs / B/L fee', 'Customs clearance']]
    check('buy breakdown (freight, BAF, THC O/D, local, docs, customs) adds up to total buy', all(abs(sum((row[i].value or 0) for i in bk) - row[hdr.index('Total buy')].value) < 0.01 for row in wa.iter_rows(min_row=2)))
    check('export option: all columns', wa.max_column > len(heads) and 'Win rate' in [c.value for c in wa[1]] and 'Rate source' in [c.value for c in wa[1]])
    tid('qt-f-valid').uncheck(); pg.wait_for_timeout(100)
    tid('qt-sort-sell').click(); pg.wait_for_timeout(100)
    tid('qt-cols').click(); tid('qt-cols-reset').click(); pg.mouse.click(5, 5); pg.wait_for_timeout(100)
    pg.evaluate("() => { document.querySelector('[data-testid=qt-scroll]').scrollLeft = 0 }")
    pg.locator('[data-testid=quote-options]').scroll_into_view_if_needed()
    shot(tid('quote-options'), 'table-en.png')

    # ── RTL: AR and FA ──
    for L, word in [('ar', 'الخط / الوكيل'), ('fa', 'خط / نماینده')]:
        open_quote(pg, L)
        q = tid('quote-options')
        txt = q.inner_text()
        firstx = pg.evaluate("() => { const a = document.querySelectorAll('[data-testid=qt-table] thead th'); return [a[0].getBoundingClientRect().x, a[1].getBoundingClientRect().x] }")
        ok = q.get_attribute('dir') == 'rtl' and word in txt and firstx[0] > firstx[1]
        if L == 'ar': ok = ok and not re.search('[\u067E\u0686\u0698\u06AF\u06A9\u06CC]', txt)
        ok = ok and not re.search(r'\b(Compare|Export|Columns|Select|Direct only|Transhipment|Weekly)\b', txt)
        check(f'{L.upper()}: table RTL, sticky column on the right, only {L.upper()} labels', ok)
        dates = pg.eval_on_selector_all('[data-testid=qt-table] td[data-col=etd]', 'els => els.map(e => e.innerText.trim())')
        jal = [d for d in dates if re.search(r'(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)', d)]
        greg = all(re.search(r'(ژانویه|فوریه|مارس|آوریل|مه|ژوئن|ژوئیه|اوت|سپتامبر|اکتبر|نوامبر|دسامبر|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)', d) for d in dates)
        check(f'{L.upper()}: Gregorian dates in the table (no Jalali months) {dates[:2]}', dates and greg and not jal)
        if L == 'ar':
            shot(q, 'table-ar.png')
            tid('qt-export').click()
            with pg.expect_download() as dl4: tid('qt-exp-xlsx').click()
            dl4.value.save_as('/tmp/qt-ar.xlsx'); wb4 = openpyxl.load_workbook('/tmp/qt-ar.xlsx')
            check('AR export: Arabic headers, right-to-left sheet', wb4.worksheets[0]['A1'].value == word and wb4.worksheets[0].sheet_view.rightToLeft)
    ctx.close()

    # ── phone cards ──
    pc = b.new_context(viewport={'width': 390, 'height': 844}); ph = pc.new_page()
    ph.on('pageerror', lambda e: errs.append(str(e)))
    open_quote(ph)
    check('phone: stacked cards instead of a table', ph.locator('[data-testid=qt-cards] .qt-card').count() == 3 and ph.locator('[data-testid=qt-table]').count() == 0)
    over = ph.evaluate("() => document.querySelector('[data-testid=qt-cards]').scrollWidth > document.querySelector('[data-testid=qt-cards]').clientWidth + 1")
    check('phone: cards fit the width', not over)
    if SHOTS: ph.locator('[data-testid=quote-options]').screenshot(path=os.path.join(SHOTS, 'phone-cards.png'))
    pc.close(); b.close()

check('no page errors', not errs)
print(f'\n{len(fails)} failed' if fails else '\nALL PASS')
if errs: print(errs[:5])
sys.exit(1 if fails else 0)
