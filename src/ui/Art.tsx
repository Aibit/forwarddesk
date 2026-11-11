import type { ReactNode } from 'react';
import crane from './art/crane.svg?raw';
import ship from './art/ship.svg?raw';
import containers from './art/containers.svg?raw';
import mapArt from './art/map.svg?raw';
import truck from './art/truck.svg?raw';
import iClock from './art/i-clock.svg?raw';
import iQuote from './art/i-quote.svg?raw';
import iClient from './art/i-client.svg?raw';
import iPortal from './art/i-portal.svg?raw';
import iAgents from './art/i-agents.svg?raw';
import iLang from './art/i-lang.svg?raw';

/** Shipping line drawings, shared with the landing page (forwarddesk-site). */
const ART = { crane, ship, containers, map: mapArt, truck, clock: iClock, quote: iQuote, client: iClient, portal: iPortal, agents: iAgents, lang: iLang } as const;
export type ArtName = keyof typeof ART;

export function Art({ name, className = '' }: { name: ArtName; className?: string }) {
  return <span className={`fd-art fd-art-${name} ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[name] }} />;
}

/** Empty state: a small drawing above the original message. */
export function EmptyArt({ name, children, className = '' }: { name: ArtName; children?: ReactNode; className?: string }) {
  return (
    <div className={`fd-empty ${className}`}>
      <Art name={name} />
      {children != null && <div className="fd-empty-txt">{children}</div>}
    </div>
  );
}

/* Small sidebar icons, line style, drawn on a 24px grid. */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export type NavIcon = 'account' | 'jobs' | 'clients' | 'agents' | 'portal' | 'quote' | 'pipeline' | 'finance' | 'menu' | 'sun' | 'moon' | 'close' | 'news' | 'inbox';
export function Icon({ name }: { name: NavIcon }) {
  const body = (() => {
    switch (name) {
      case 'jobs': // container
        return <><rect x="3" y="6.5" width="18" height="11" rx="1.5" {...P} /><path d="M7 9v6M10.5 9v6M14 9v6M17.5 9v6" {...P} /></>;
      case 'clients':
        return <><circle cx="9" cy="9" r="3.2" {...P} /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" {...P} /><path d="M15.5 6.5a3 3 0 0 1 0 5.6M17.5 14.8c1.6.6 2.6 2 3 4.2" {...P} /></>;
      case 'agents': // globe
        return <><circle cx="12" cy="12" r="8.5" {...P} /><ellipse cx="12" cy="12" rx="3.6" ry="8.5" {...P} /><path d="M3.8 9.2h16.4M3.8 14.8h16.4" {...P} /></>;
      case 'portal':
        return <><rect x="3" y="4.5" width="18" height="15" rx="2" {...P} /><path d="M3 8.5h18" {...P} /><path d="M8.5 14l2.4 2.4 4.8-4.8" {...P} /></>;
      case 'quote':
        return <><path d="M6 3.5h8.5L19 8v12.5H6z" {...P} /><path d="M14.5 3.5V8H19M9 12h7M9 15.5h5" {...P} /></>;
      case 'pipeline': // route
        return <><circle cx="6" cy="17" r="2.2" {...P} /><circle cx="18" cy="7" r="2.2" {...P} /><path d="M7.8 15.6C11 13 9 9.5 12 8.5c1.6-.5 2.8-.9 4-1.2" {...P} strokeDasharray="1.5 2.6" /></>;
      case 'finance': // invoice with anchor-free ledger lines
        return <><rect x="4" y="3.5" width="16" height="17" rx="2" {...P} /><path d="M8 8h8M8 11.5h8M8 15h4.5" {...P} /><path d="M15 16.8l1.3 1.3 2.4-2.6" {...P} /></>;
      case 'account': // building / office
        return <><path d="M4 20.5V6.5l8-3 8 3v14" {...P} /><path d="M2.5 20.5h19M9 20.5v-4h6v4M8 9.5h2M14 9.5h2M8 13h2M14 13h2" {...P} /></>;
      case 'menu':
        return <path d="M4 7h16M4 12h16M4 17h16" {...P} />;
      case 'close':
        return <path d="M6 6l12 12M18 6L6 18" {...P} />;
      case 'sun':
        return <><circle cx="12" cy="12" r="4" {...P} /><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" {...P} /></>;
      case 'inbox': // chat bubble
        return <><path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 0 1 3 15.5V7a1.5 1.5 0 0 1 1.5-1.5z" {...P} /><path d="M7.5 10h9M7.5 13h6" {...P} /></>;
      case 'news': // sparkle
        return <><path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" {...P} /><path d="M18.5 16v4M16.5 18h4" {...P} /></>;
      case 'moon':
        return <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" {...P} />;
    }
  })();
  return <svg className="fd-ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">{body}</svg>;
}
