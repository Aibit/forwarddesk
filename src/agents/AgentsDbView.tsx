import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { DB_TYPES, agentsDb, agentsToCsv, csvToAgents, hasCsvSeed, newDbAgent, portalYn, sanctionsLevel, useAgentsDb, type DbAgent, type DbType } from './db';
import { useStore } from '../clients/store';
import '../jobs/jobs.css';
import '../clients/clients.css';
import './agents.css';

type Lang = 'en' | 'es' | 'fa';
const T: Record<string, [string, string, string]> = {
  search: ['Search name, city, port, service…', 'Buscar nombre, ciudad, puerto, servicio…', 'جستجوی نام، شهر، بندر، خدمات…'],
  all: ['All', 'Todos', 'همه'],
  type: ['Type', 'Tipo', 'نوع'], country: ['Country', 'País', 'کشور'], city: ['City', 'Ciudad', 'شهر'], port: ['Port', 'Puerto', 'بندر'], ports: ['Ports', 'Puertos', 'بنادر'],
  lanes: ['Lanes', 'Rutas', 'مسیرها'], service: ['Service', 'Servicio', 'خدمت'], services: ['Services', 'Servicios', 'خدمات'], portal: ['Portal', 'Portal', 'پورتال'],
  website: ['Website', 'Web', 'وب‌سایت'], email: ['Email', 'Email', 'ایمیل'], phone: ['Phone', 'Teléfono', 'تلفن'], whatsapp: ['WhatsApp', 'WhatsApp', 'واتس‌اپ'],
  sanctions: ['Sanctions note', 'Nota sanciones', 'یادداشت تحریم'], source: ['Source', 'Fuente', 'منبع'], notes: ['Notes', 'Notas', 'یادداشت'], name: ['Name', 'Nombre', 'نام'],
  add: ['+ Add agent', '+ Añadir agente', '+ نماینده جدید'], importCsv: ['Import CSV', 'Importar CSV', 'ورود CSV'], exportCsv: ['Export CSV', 'Exportar CSV', 'خروجی CSV'], reset: ['Reset seed', 'Restablecer', 'بازنشانی'],
  saved: ['saved in this browser only', 'guardado solo en este navegador', 'فقط در همین مرورگر ذخیره می‌شود'],
  sample: ['SAMPLE AGENTS — generic, not real companies', 'AGENTES DE EJEMPLO — genéricos, no reales', 'نمایندگان نمونه — عمومی، شرکت واقعی نیستند'],
  public: ['Public info — verify before use', 'Información pública — verificar antes de usar', 'اطلاعات عمومی — پیش از استفاده بررسی شود'],
  edit: ['Edit', 'Editar', 'ویرایش'], del: ['Delete', 'Eliminar', 'حذف'], save: ['Save', 'Guardar', 'ذخیره'], cancel: ['Cancel', 'Cancelar', 'انصراف'], close: ['Close', 'Cerrar', 'بستن'],
  yes: ['yes', 'sí', 'بله'], no: ['no', 'no', 'خیر'], unknown: ['?', '?', '?'],
  usedBy: ['On client lists', 'En listas de clientes', 'در فهرست مشتریان'], shown: ['shown', 'mostrados', 'نمایش'],
  t_overseas: ['Overseas agent', 'Agente en destino', 'نماینده خارجی'], t_forwarder: ['Forwarder / NVOCC', 'Transitario / NVOCC', 'فورواردر / NVOCC'], t_line: ['Shipping line', 'Naviera', 'خط کشتیرانی'], t_clearance: ['Clearance agent', 'Agente de aduanas', 'ترخیص‌کار'], t_network: ['Network / association', 'Red / asociación', 'شبکه / انجمن'], t_other: ['Port operator / other', 'Operador portuario / otro', 'اپراتور بندر / سایر'],
  listed: ['Sanctions listed — do not use', 'En listas de sanciones — no usar', 'در فهرست تحریم — استفاده نشود'], screened: ['Screened — see note', 'Revisado — ver nota', 'بررسی شد — یادداشت'], listedOnly: ['Hide sanctions-listed', 'Ocultar sancionados', 'پنهان کردن موارد تحریمی'],
  imported: ['Imported', 'Importados', 'وارد شد'], skipped: ['skipped (no name)', 'omitidos (sin nombre)', 'رد شد (بدون نام)'],
  replaceQ: ['Replace the list with the CSV? (Cancel = add to the list)', '¿Sustituir la lista por el CSV? (Cancelar = añadir)', 'فهرست با CSV جایگزین شود؟ (انصراف = افزودن)'],
};
const I: Record<Lang, number> = { en: 0, es: 1, fa: 2 };
const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter((x) => x && x !== '—'))].sort((a, b) => a.localeCompare(b));
const split = (s: string) => s.split(/[,;/]/).map((x) => x.trim()).filter(Boolean);

export function AgentsDbView() {
  const { list, seed } = useAgentsDb();
  const { clients } = useStore();
  const [lang, setLang] = useState<Lang>('en');
  const L = (k: string) => T[k]?.[I[lang]] ?? k;
  const [q, setQ] = useState('');
  const [fType, setFType] = useState<DbType | ''>('');
  const [fCountry, setFCountry] = useState('');
  const [fPort, setFPort] = useState('');
  const [fService, setFService] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbAgent | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const countries = useMemo(() => uniq(list.map((a) => a.country)), [list]);
  const ports = useMemo(() => uniq(list.flatMap((a) => split(a.ports))), [list]);
  const services = useMemo(() => uniq(list.flatMap((a) => split(a.services))), [list]);
  const shown = list.filter((a) => {
    if (fType && a.type !== fType) return false;
    if (fCountry && a.country !== fCountry) return false;
    if (fPort && !split(a.ports).includes(fPort)) return false;
    if (fService && !split(a.services).includes(fService)) return false;
    if (q.trim()) {
      const hay = [a.name, a.country, a.city, a.ports, a.lanes, a.services, a.email, a.notes].join(' ').toLowerCase();
      return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  });
  const usedBy = (a: DbAgent) => clients.filter((c) => c.agents.some((x) => x.dbId === a.id || x.name.toLowerCase() === a.name.toLowerCase())).map((c) => c.name);
  const open = list.find((a) => a.id === openId) ?? null;

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const { list: rows, skipped } = csvToAgents(await f.text(), false);
    if (!rows.length) { setMsg(`${L('imported')}: 0${skipped ? ` · ${skipped} ${L('skipped')}` : ''}`); return; }
    const replace = window.confirm(L('replaceQ'));
    agentsDb.replace(replace ? rows : [...list, ...rows], 'user');
    setMsg(`${L('imported')}: ${rows.length}${skipped ? ` · ${skipped} ${L('skipped')}` : ''} (${f.name})`);
  };
  const onExport = () => {
    const blob = new Blob([agentsToCsv(list)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'forwarddesk-agents.csv';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const anyPublic = list.some((a) => a.publicInfo);
  const anySample = list.some((a) => a.sample);

  return (
    <div className="clients agents-db" dir={lang === 'fa' ? 'rtl' : 'ltr'} lang={lang} data-testid="agents-db">
      <div className="j-top">
        <div className="j-title">
          {anySample && <span className="j-sample">{L('sample')}</span>}
          {anyPublic && <span className="j-sample ad-public" data-testid="agents-public">{L('public')}</span>}
          <span className="j-note">{L('saved')}{seed === 'csv' ? ' · seed: researched CSV' : hasCsvSeed ? '' : ' · CSV import ready'}</span>
        </div>
        <div className="c-top-actions">
          <button type="button" className="btn sm primary" onClick={() => setEditing(newDbAgent())} data-testid="agents-add">{L('add')}</button>
          <button type="button" className="btn sm ghost" onClick={() => fileRef.current?.click()} data-testid="agents-import">{L('importCsv')}</button>
          <button type="button" className="btn sm ghost" onClick={onExport} data-testid="agents-export">{L('exportCsv')}</button>
          <button type="button" className="btn sm ghost" onClick={() => { if (window.confirm('Reset the agent list to the seed? Your changes in this browser are lost.')) agentsDb.reset(); }}>{L('reset')}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onImport} data-testid="agents-import-input" />
          <div className="q-lang j-lang" role="group" aria-label="Language">
            {(['en', 'es', 'fa'] as Lang[]).map((l) => <button key={l} type="button" className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
      </div>
      {msg && <div className="q-scope" data-testid="agents-msg">{msg}</div>}

      <section className="q-panel">
        <div className="ad-filters">
          <input className="c-in" placeholder={L('search')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="agents-search" />
          <select className="c-in" value={fType} onChange={(e) => setFType(e.target.value as DbType | '')} data-testid="agents-f-type" aria-label={L('type')}>
            <option value="">{L('type')}: {L('all')}</option>
            {DB_TYPES.map((t) => <option key={t} value={t}>{L(`t_${t}`)}</option>)}
          </select>
          <select className="c-in" value={fCountry} onChange={(e) => setFCountry(e.target.value)} data-testid="agents-f-country" aria-label={L('country')}>
            <option value="">{L('country')}: {L('all')}</option>
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="c-in" value={fPort} onChange={(e) => setFPort(e.target.value)} data-testid="agents-f-port" aria-label={L('port')}>
            <option value="">{L('port')}: {L('all')}</option>
            {ports.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="c-in" value={fService} onChange={(e) => setFService(e.target.value)} data-testid="agents-f-service" aria-label={L('service')}>
            <option value="">{L('service')}: {L('all')}</option>
            {services.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="c-muted c-small" data-testid="agents-count">{shown.length} / {list.length} {L('shown')}</span>
        </div>
        <div className="ad-table-wrap">
          <table className="ad-table" data-testid="agents-table">
            <thead>
              <tr>
                <th>{L('name')}</th><th>{L('type')}</th><th>{L('country')} · {L('city')}</th><th>{L('ports')}</th><th>{L('lanes')}</th><th>{L('services')}</th><th>{L('portal')}</th><th>{L('email')} · {L('phone')}</th><th>{L('sanctions')}</th><th>{L('source')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id} onClick={() => setOpenId(a.id)} data-testid={`agent-row-${a.id}`} className={openId === a.id ? 'active' : ''}>
                  <td><strong>{a.name}</strong>{a.website && <div className="c-sub"><bdi dir="ltr">{a.website.replace(/^https?:\/\//, '')}</bdi></div>}</td>
                  <td><span className={`ad-type t-${a.type}`}>{L(`t_${a.type}`)}</span></td>
                  <td>{[a.country, a.city].filter((x) => x && x !== '—').join(' · ') || '—'}</td>
                  <td><div className="ad-clip" title={a.ports}><bdi>{a.ports || '—'}</bdi></div></td>
                  <td><div className="ad-clip" title={a.lanes}>{a.lanes || '—'}</div></td>
                  <td><div className="ad-clip" title={a.services}>{a.services || '—'}</div></td>
                  <td title={a.portal}>{(() => { const y = portalYn(a.portal); return y === 'yes' ? L('yes') : y === 'no' ? L('no') : '?'; })()}</td>
                  <td><bdi dir="ltr" className="c-sub">{a.email || '—'}</bdi>{a.phone && <div className="c-sub"><bdi dir="ltr">{a.phone}</bdi></div>}</td>
                  <td><SancBadge note={a.sanctions} L={L} /></td>
                  <td className="c-sub"><div className="ad-clip" title={a.source}>{a.source || '—'}</div></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={10} className="c-muted">—</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {open && !editing && (
        <div className="j-drawer-wrap" onClick={() => setOpenId(null)}>
          <aside className="j-drawer ad-drawer" onClick={(e) => e.stopPropagation()} data-testid="agent-drawer" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
            <div className="q-head">
              <h2>{open.name}</h2>
              <button type="button" className="btn sm ghost" onClick={() => setOpenId(null)}>{L('close')}</button>
            </div>
            <div className="c-sub">{L(`t_${open.type}`)}{open.sample ? ' · SAMPLE' : ''}{open.publicInfo ? ` · ${L('public')}` : ''}</div>
            {open.sanctions && <div className={`ad-sanc block ${sanctionsLevel(open.sanctions) === 'listed' ? 'listed' : ''}`} data-testid="drawer-sanctions">{sanctionsLevel(open.sanctions) === 'listed' ? <strong>⚑ {L('listed')}. </strong> : '⚑ '}{L('sanctions')}: {open.sanctions}</div>}
            <dl className="ad-dl">
              <Row k={L('country')} v={[open.country, open.city].filter(Boolean).join(' · ')} />
              <Row k={L('ports')} v={open.ports} />
              <Row k={L('lanes')} v={open.lanes} />
              <Row k={L('services')} v={open.services} />
              <Row k={L('portal')} v={open.portal ? `${(() => { const y = portalYn(open.portal); return y === 'yes' ? L('yes') : y === 'no' ? L('no') : '?'; })()} — ${open.portal}` : ''} />
              <Row k={L('website')} v={open.website ? <a href={/^https?:/.test(open.website) ? open.website : `https://${open.website}`} target="_blank" rel="noreferrer noopener">{open.website}</a> : ''} />
              <Row k={L('email')} v={open.email} ltr />
              <Row k={L('phone')} v={open.phone} ltr />
              <Row k={L('whatsapp')} v={open.whatsapp} ltr />
              <Row k={L('source')} v={open.source} />
              <Row k={L('notes')} v={open.notes} />
              <Row k={L('usedBy')} v={usedBy(open).join(', ')} />
            </dl>
            <div className="c-form-actions">
              <button type="button" className="btn sm ghost" onClick={() => { if (window.confirm(`Delete ${open.name} from this browser?`)) { agentsDb.remove(open.id); setOpenId(null); } }} data-testid="agent-delete">{L('del')}</button>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn sm primary" onClick={() => setEditing(open)} data-testid="agent-edit">{L('edit')}</button>
            </div>
          </aside>
        </div>
      )}
      {editing && <AgentForm a={editing} L={L} lang={lang} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); setOpenId(id); }} />}
    </div>
  );
}

function Row({ k, v, ltr }: { k: string; v: ReactNode; ltr?: boolean }) {
  return <><dt>{k}</dt><dd>{v ? (ltr ? <bdi dir="ltr">{v}</bdi> : v) : '—'}</dd></>;
}

function AgentForm({ a, L, lang, onClose, onSaved }: { a: DbAgent; L: (k: string) => string; lang: Lang; onClose: () => void; onSaved: (id: string) => void }) {
  const [d, setD] = useState<DbAgent>(a);
  const up = <K extends keyof DbAgent>(k: K, v: DbAgent[K]) => setD((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof DbAgent, label: string, wide = false, ltr = false) => (
    <label className={`c-field ${wide ? 'wide' : ''}`}><span>{label}</span><input className="c-in" dir={ltr ? 'ltr' : undefined} value={String(d[k] ?? '')} onChange={(e) => up(k, e.target.value as never)} data-testid={`af-${k}`} /></label>
  );
  return (
    <div className="c-modal-bg" onClick={onClose}>
      <div className="q-panel c-modal" role="dialog" onClick={(e) => e.stopPropagation()} dir={lang === 'fa' ? 'rtl' : 'ltr'} data-testid="agent-form">
        <div className="q-head"><h2>{a.name || L('add').replace('+ ', '')}</h2><span className="c-muted">{L('saved')}</span></div>
        <div className="c-form">
          {txt('name', L('name'))}
          <label className="c-field"><span>{L('type')}</span>
            <select className="c-in" value={d.type} onChange={(e) => up('type', e.target.value as DbType)} data-testid="af-type">{DB_TYPES.map((t) => <option key={t} value={t}>{L(`t_${t}`)}</option>)}</select>
          </label>
          {txt('country', L('country'))}{txt('city', L('city'))}
          {txt('ports', `${L('ports')} (comma separated)`, true)}
          {txt('lanes', L('lanes'))}{txt('services', L('services'))}
          {txt('portal', `${L('portal')} (yes / no / details)`)}
          {txt('website', L('website'), false, true)}{txt('email', L('email'), false, true)}{txt('phone', L('phone'), false, true)}{txt('whatsapp', L('whatsapp'), false, true)}
          {txt('sanctions', L('sanctions'), true)}{txt('source', L('source'))}{txt('notes', L('notes'))}
        </div>
        <div className="c-form-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sm ghost" onClick={onClose}>{L('cancel')}</button>
          <button type="button" className="btn sm primary" disabled={!d.name.trim()} onClick={() => { agentsDb.upsert({ ...d, name: d.name.trim(), sample: d.sample && d.name === a.name ? d.sample : undefined }); onSaved(d.id); }} data-testid="af-save">{L('save')}</button>
        </div>
      </div>
    </div>
  );
}

function SancBadge({ note, L }: { note: string; L: (k: string) => string }) {
  const lv = sanctionsLevel(note);
  if (!lv) return <>—</>;
  return lv === 'listed'
    ? <span className="ad-sanc listed" title={note} data-testid="sanctions-listed">⚑ {L('listed')}</span>
    : <span className="ad-sanc" title={note} data-testid="sanctions-badge">⚑ {L('screened')}</span>;
}
