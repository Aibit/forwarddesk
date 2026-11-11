"""App ↔ WhatsApp service end to end (mock provider, nothing leaves the machine).

  cd server && npm run build && WA_PROVIDER=mock WA_API_KEY=k PORT=8099 WA_DB_PATH=/tmp/fdwa/wa.sqlite WA_MEDIA_DIR=/tmp/fdwa/media npm start
  python3 scripts/inbox-server-e2e.py http://localhost:5299/forwarddesk/ http://localhost:8099 k [shot-dir]
"""
import json, sys, time, urllib.request
from playwright.sync_api import sync_playwright

APP, SRV, KEY = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
SHOTS = sys.argv[4] if len(sys.argv) > 4 else None
fails = []
def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name)
    if not cond: fails.append(name)
def post(path, body, auth=False):
    req = urllib.request.Request(SRV + path, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {KEY}'} if auth else {})})
    return json.loads(urllib.request.urlopen(req).read())
def get(path):
    return json.loads(urllib.request.urlopen(urllib.request.Request(SRV + path, headers={'Authorization': f'Bearer {KEY}'})).read())
def inbound(frm, wamid, text):
    return post('/webhooks/whatsapp', {'object': 'whatsapp_business_account', 'entry': [{'id': 'L', 'changes': [{'field': 'messages', 'value': {
        'messaging_product': 'whatsapp', 'metadata': {'phone_number_id': 'local'}, 'contacts': [{'profile': {'name': 'Test sender'}, 'wa_id': frm}],
        'messages': [{'from': frm, 'id': wamid, 'timestamp': str(int(time.time())), 'type': 'text', 'text': {'body': text}}]}}]}]})
def status(wamid, st):
    return post('/webhooks/whatsapp', {'object': 'whatsapp_business_account', 'entry': [{'id': 'L', 'changes': [{'field': 'messages', 'value': {
        'messaging_product': 'whatsapp', 'statuses': [{'id': wamid, 'status': st, 'timestamp': str(int(time.time())), 'recipient_id': '980000000001'}]}}]}]})

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 1440, 'height': 900})
    c.add_init_script(f"localStorage.setItem('fd.wa.server', JSON.stringify({{url: '{SRV}', key: '{KEY}'}})); localStorage.setItem('fd-ui-lang','en')")
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(APP + '?demo', wait_until='networkidle')
    if pg.locator('[data-testid=start-demo]').count(): pg.click('[data-testid=start-demo]')
    t = lambda x: pg.locator(f'[data-testid="{x}"]')
    t('nav-inbox').click(); pg.wait_for_timeout(1500)
    check('server mode: banner names the mock provider, no SAMPLE pill', t('inbox-mode').get_attribute('data-mode') == 'server' and t('inbox-sample-pill').count() == 0 and 'mock provider' in t('inbox-mode').inner_text())
    inbound('980000000001', f'wamid.E2E{int(time.time())}', 'Hello, update on FD-E-1042 please?')
    pg.wait_for_timeout(6000)
    convs = get('/api/wa/conversations')['conversations']
    cv = next(x for x in convs if x['waId'] == '980000000001')
    check('directory synced by the app; inbound auto-linked to Customer A (phone) and FD-E-1042 (text)', cv['clientId'] == 'c-a' and cv['jobId'] == 'FD-E-1042')
    item = t(f"inbox-conv-{cv['id']}")
    check('conversation appears via polling with unread badge', item.count() == 1 and item.locator('[data-testid=inbox-unread]').count() == 1 and t('nav-inbox-unread').count() == 1)
    item.click(); pg.wait_for_timeout(800)
    check('window open; unread cleared on the service', t('inbox-window').get_attribute('data-open') == '1' and get('/api/wa/conversations')['conversations'][0]['unread'] == 0)
    t('inbox-text').fill('Loaded this morning; draft B/L follows.'); t('inbox-send').click(); pg.wait_for_timeout(800)
    last = pg.locator('[data-testid=inbox-msg]').last
    check('reply sent through the service → queued (clock), not "delivered"', last.get_attribute('data-status') == 'queued')
    msgs = get(f"/api/wa/conversations/{cv['id']}/messages")['messages']
    w = msgs[-1]['wamid']
    status(w, 'delivered'); pg.wait_for_timeout(4800)
    check('delivered tick appears only after the status webhook', pg.locator('[data-testid=inbox-msg]').last.get_attribute('data-status') == 'delivered')
    status(w, 'read'); pg.wait_for_timeout(4800)
    check('read tick after "read" status', pg.locator('[data-testid=inbox-msg]').last.get_attribute('data-status') == 'read')
    t('inbox-attach').click(); pg.wait_for_timeout(200)
    if t('inbox-attach-item').count():
        t('inbox-attach-item').first.click(); pg.wait_for_timeout(2500)
        m = get(f"/api/wa/conversations/{cv['id']}/messages")['messages'][-1]
        check(f"invoice/B-L PDF uploaded and sent as a document ({m.get('filename')})", m['type'] == 'document' and (m.get('filename') or '').endswith('.pdf') and m['size'] > 1000)
    if SHOTS: pg.screenshot(path=SHOTS + '/en-inbox-server-mode-mock-provider.png')
    t('nav-jobs').click(); pg.wait_for_timeout(300); t('job-FD-E-1042').click(); pg.wait_for_timeout(400)
    check('job drawer lists the live thread', t(f"job-wa-thread-{cv['id']}").count() == 1)
    check('no page errors', not errs)
    b.close()
print(f'\n{len(fails)} failed' if fails else '\nALL PASS')
sys.exit(1 if fails else 0)
