// Pluggable outgoing mail. Only the console adapter exists today: it prints the message (and the link
// inside it) to the server log, so an operator can pass a reset link on by hand until real mail is set up.
// A real adapter (SMTP, Amazon SES, Postmark, Brevo transactional …) implements the same one method.
export interface Mail { to: string; subject: string; text: string; kind: 'reset' | 'invite' | 'welcome' }
export interface Mailer { readonly name: string; send(m: Mail): Promise<void> }

export class ConsoleMailer implements Mailer {
  readonly name = 'console';
  sent: Mail[] = [];
  constructor(private log: (s: string) => void = (s) => console.log(s), private keep = 50) {}
  async send(m: Mail) {
    this.sent.push(m);
    if (this.sent.length > this.keep) this.sent.shift();
    this.log(`[mail:console] to=${m.to} kind=${m.kind} subject=${JSON.stringify(m.subject)}\n${m.text}\n[/mail]`);
  }
}

export function createMailer(name: string): Mailer {
  if (name === 'console' || !name) return new ConsoleMailer();
  throw new Error(`MAIL_ADAPTER "${name}" is not available yet (only "console")`);
}
