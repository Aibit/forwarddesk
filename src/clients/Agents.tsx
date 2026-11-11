import { useState } from 'react';
import { newAgent, type Agent, type AgentRank, type AgentType, type CLang } from './store';
import { ct, type CKey } from './i18n';
import { isHidden, isListed, pickable, statusOf, useAgentsDb, type DbAgent } from '../agents/db';
import '../agents/agents.css';

const TYPES: AgentType[] = ['line', 'overseas', 'clearance'];
const RANKS: AgentRank[] = ['preferred', 'allowed', 'avoid'];

/** Shared editor for a client's preferred agents (client setup and client portal). */
export function AgentsEditor({ agents, onChange, lang, testid = 'agents' }: { agents: Agent[]; onChange: (a: Agent[]) => void; lang: CLang; testid?: string }) {
  const L = (k: CKey) => ct(lang, k);
  const [editId, setEditId] = useState<string | null>(null);
  const { list: db } = useAgentsDb();
  const dbFor = (t: AgentType) => pickable(db).filter((d) => (t === 'line' ? d.type === 'line' : t === 'clearance' ? d.type === 'clearance' : d.type === 'overseas' || d.type === 'forwarder' || d.type === 'network')).filter((d) => !isListed(d)).filter((d) => !agents.some((a) => a.dbId === d.id || a.name.toLowerCase() === d.name.toLowerCase()));
  const listedSet = new Set(db.filter((d) => isListed(d)).map((d) => d.name.trim().toLowerCase()));
  const blackSet = new Set(db.filter((d) => isHidden(d) && !isListed(d)).map((d) => d.name.trim().toLowerCase()));
  const blackA = (a: Agent) => !!a.name.trim() && blackSet.has(a.name.trim().toLowerCase());
  const listedA = (a: Agent) => !!a.name.trim() && listedSet.has(a.name.trim().toLowerCase());
  const pick = (t: AgentType, d: DbAgent) => onChange([...agents, { ...newAgent(t), name: d.name, ports: d.ports, phone: d.phone, email: d.email, whatsapp: d.whatsapp, notes: [d.services, d.sanctions ? `Sanctions note: ${d.sanctions}` : ''].filter(Boolean).join(' · '), dbId: d.id }]);
  const up = (id: string, patch: Partial<Agent>) => onChange(agents.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const move = (id: string) => {
    const i = agents.findIndex((a) => a.id === id);
    const same = agents.map((a, j) => ({ a, j })).filter((x) => x.a.type === agents[i].type && x.j < i);
    if (!same.length) return;
    const j = same[same.length - 1].j;
    const next = [...agents];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="c-agents" data-testid={testid}>
      {TYPES.map((t) => {
        const list = agents.filter((a) => a.type === t);
        return (
          <div key={t} className="c-ag-group">
            <div className="c-ag-head">
              <strong>{L(`t_${t}` as CKey)}</strong>
              {dbFor(t).length > 0 && (
                <select className="c-in c-ag-pick" value="" onChange={(e) => { const d = db.find((x) => x.id === e.target.value); if (d) pick(t, d); }} data-testid={`${testid}-pick-${t}`} aria-label="Pick from Agent CRM">
                  <option value="">{lang === 'fa' ? 'انتخاب از پایگاه نمایندگان…' : lang === 'es' ? 'Elegir de la base de agentes…' : 'Pick from Agent CRM…'}</option>
                  {dbFor(t).map((d) => <option key={d.id} value={d.id}>{statusOf(d) === 'preferred' ? '★ ' : ''}{d.name}{d.city && d.city !== '—' ? ` · ${d.city}` : ''}{d.sanctions ? ' ⚑' : ''}</option>)}
                </select>
              )}
              <button type="button" className="btn sm ghost" onClick={() => { const a = newAgent(t); onChange([...agents, a]); setEditId(a.id); }} data-testid={`${testid}-add-${t}`}>{L('addAgent')}</button>
            </div>
            {list.length === 0 && <div className="c-muted">{L('noAgents')}</div>}
            {list.map((a) =>
              editId === a.id ? (
                <div key={a.id} className="c-ag-edit" data-testid={`${testid}-edit`}>
                  <div className="c-form">
                    <label className="c-field"><span>{L('name')}</span><input className="c-in" value={a.name} onChange={(e) => up(a.id, { name: e.target.value })} data-testid={`${testid}-name`} autoFocus /></label>
                    <label className="c-field"><span>{L('type')}</span>
                      <select className="c-in" value={a.type} onChange={(e) => up(a.id, { type: e.target.value as AgentType })}>
                        {TYPES.map((x) => <option key={x} value={x}>{L(`t_${x}` as CKey)}</option>)}
                      </select>
                    </label>
                    <label className="c-field wide"><span>{L('ports')}</span><input className="c-in" value={a.ports} onChange={(e) => up(a.id, { ports: e.target.value })} placeholder="Nhava Sheva, Mundra" data-testid={`${testid}-ports`} /></label>
                    <label className="c-field"><span>{L('contactName')}</span><input className="c-in" value={a.contactName} onChange={(e) => up(a.id, { contactName: e.target.value })} /></label>
                    <label className="c-field"><span>{L('phone')}</span><input className="c-in" value={a.phone} onChange={(e) => up(a.id, { phone: e.target.value })} /></label>
                    <label className="c-field"><span>{L('email')}</span><input className="c-in" value={a.email} onChange={(e) => up(a.id, { email: e.target.value })} /></label>
                    <label className="c-field"><span>{L('whatsapp')}</span><input className="c-in" value={a.whatsapp} onChange={(e) => up(a.id, { whatsapp: e.target.value })} /></label>
                    <label className="c-field wide"><span>{L('notes')}</span><input className="c-in" value={a.notes} onChange={(e) => up(a.id, { notes: e.target.value })} /></label>
                  </div>
                  <div className="c-form-actions">
                    <button type="button" className="btn sm ghost" onClick={() => { onChange(agents.filter((x) => x.id !== a.id)); setEditId(null); }}>{L('removeAgent')}</button>
                    <span style={{ flex: 1 }} />
                    <RankPicker a={a} L={L} onPick={(r) => up(a.id, { rank: r })} testid={testid} locked={listedA(a)} hidden={blackA(a)} />
                    <button type="button" className="btn sm primary" onClick={() => setEditId(null)} data-testid={`${testid}-done`}>{L('done')}</button>
                  </div>
                </div>
              ) : (
                <div key={a.id} className={`c-ag rank-${a.rank}`} data-testid={`${testid}-row`}>
                  <span className="c-ag-main">
                    <strong>{a.name || '—'}</strong>
                    <span className="c-sub"><bdi>{a.ports || '—'}</bdi>{a.contactName ? ` · ${a.contactName}` : ''}{a.whatsapp ? <> · WA <bdi dir="ltr" className="mono">{a.whatsapp}</bdi></> : null}</span>
                    {a.notes && <span className="c-sub">{a.notes}</span>}
                  </span>
                  <RankPicker a={a} L={L} onPick={(r) => up(a.id, { rank: r })} testid={testid} locked={listedA(a)} hidden={blackA(a)} />
                  <span className="c-ag-btns">
                    <button type="button" className="btn sm ghost" title={L('up')} onClick={() => move(a.id)}>↑</button>
                    <button type="button" className="btn sm ghost" onClick={() => setEditId(a.id)}>{L('edit')}</button>
                  </span>
                </div>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

function RankPicker({ a, L, onPick, testid, locked, hidden }: { a: Agent; L: (k: CKey) => string; onPick: (r: AgentRank) => void; testid: string; locked?: boolean; hidden?: boolean }) {
  if (hidden && !locked) return <span className="ad-sanc" title="Blacklisted or archived in the Agent CRM — not offered in quotes" data-testid={`${testid}-hidden`}>Blacklisted / archived in Agents</span>;
  if (locked) return <span className="ad-sanc listed" title="Sanctions listed in the Agents database — cannot be preferred or allowed" data-testid={`${testid}-listed`}>⚑ Sanctions listed — do not use</span>;
  return (
    <span className="q-lang c-rank" role="group" aria-label={L('rank')}>
      {RANKS.map((r) => (
        <button key={r} type="button" className={`${a.rank === r ? 'active' : ''} rk-${r}`} onClick={() => onPick(r)} data-testid={`${testid}-rank-${r}`}>
          {L(`r_${r}` as CKey)}
        </button>
      ))}
    </span>
  );
}

export function RankChip({ rank, lang }: { rank: AgentRank; lang: CLang }) {
  return <span className={`c-rank-chip rk-${rank}`}>{ct(lang, `r_${rank}` as CKey)}</span>;
}
