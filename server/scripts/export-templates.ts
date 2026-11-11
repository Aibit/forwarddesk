// Writes templates/meta-templates.json: one create-template payload per template and language,
// for Meta's POST https://graph.facebook.com/<version>/<WABA_ID>/message_templates (or 360dialog's template API).
import { writeFileSync, mkdirSync } from 'node:fs';
import { metaSubmissions } from '../src/templates.js';

mkdirSync('templates', { recursive: true });
const out = metaSubmissions();
writeFileSync('templates/meta-templates.json', JSON.stringify(out, null, 2) + '\n');
console.log(`wrote templates/meta-templates.json (${out.length} payloads)`);
