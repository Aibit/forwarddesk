import { useEffect, useRef } from 'react';
import type { AgentMessage } from '../types';

interface Props {
  messages: AgentMessage[];
}

/** Prefer HH:MM from timestamp label; fall back to raw. */
function shortTs(ts: string): string {
  const m = ts.match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : ts.slice(0, 5);
}

function agentKey(agent: string): string {
  const raw = agent.replace(/\s+/g, '').replace(/Agent$/i, '');
  if (raw.length <= 8) return raw.toUpperCase();
  return raw.slice(0, 8).toUpperCase();
}

export function AgentFeed({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <>
      <div className="col-header">
        <h2>Ops log</h2>
        <span className="count">{messages.length}</span>
      </div>
      <div className="col-scroll">
        <div className="event-log">
          {messages.length === 0 && (
            <div className="empty-state">Idle — build quotes or add a customer RFQ.</div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`log-line tone-${m.tone ?? 'info'}`}
            >
              <span className="log-ts">{shortTs(m.ts)}</span>
              <span className={`log-agent role-${m.role}`}>
                {agentKey(m.agent)}
              </span>
              <span className="log-msg">{m.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  );
}
