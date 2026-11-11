// Spreadsheet export for the quote options table: a real .xlsx (typed numbers, currency formats, bold frozen
// header, autofilter, column widths, second sheet with the quote details) and a UTF-8 (BOM) .csv.
// Written by hand on top of fflate (already in the bundle via jsPDF) to keep the download small.
import { strToU8, zipSync } from 'fflate';
import { cellValue, colDef, colLabel, type ColKey, type OptRow } from './optrows';
import type { QLang } from './optlabels';

export interface ExportInput {
  rows: OptRow[];
  cols: ColKey[];
  lang: QLang;
  ref: string;
  /** yyyy-mm-dd (today, Europe/Madrid box/browser local) */
  date: string;
  quoteCurrency: string;
  /** Label/value pairs for the "Quote details" sheet (already localised). */
  details: [string, string | number][];
  sheetNames: [string, string];
}

export function exportFileName(ref: string, date: string, ext: 'xlsx' | 'csv'): string {
  const r = ref.replace(/^FD-/, '').replace(/[^A-Za-z0-9-]+/g, '-');
  return `FD-quote-${r}-options-${date}.${ext}`;
}

// eslint-disable-next-line no-control-regex -- strip characters that are invalid in XML
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
function serial(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}
const sheetName = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';

/** Currency of a money cell: 'conv' is in the quote currency, the rest in the option's currency. */
const curOf = (r: OptRow, k: ColKey, qc: string) => (k === 'conv' ? qc : r.currency);

export function buildXlsx(inp: ExportInput): Uint8Array {
  const { rows, cols, lang, quoteCurrency: qc } = inp;
  const rtl = lang === 'fa' || lang === 'ar';
  // styles: 0 default · 1 header · 2 date · 3 percent · 4 integer · 5 wrap text · 6 detail label · 7.. money per currency
  const currencies = [...new Set([qc, ...rows.map((r) => r.currency)])];
  const moneyFmt = (c: string) => `#,##0.00\\ "${c.replace(/"/g, '')}"`;
  const numFmts = [`<numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/>`, `<numFmt numFmtId="165" formatCode="0.0%"/>`, ...currencies.map((c, i) => `<numFmt numFmtId="${166 + i}" formatCode="${esc(moneyFmt(c))}"/>`)];
  const xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>',
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>',
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
    ...currencies.map((_, i) => `<xf numFmtId="${166 + i}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`),
  ];
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F1EF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD3D1CB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const str = (ref: string, v: string, s = 0) => `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  const num = (ref: string, v: number, s: number) => `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  const head = `<row r="1">${cols.map((k, i) => str(`${colName(i)}1`, colLabel(lang, k), 1)).join('')}</row>`;
  const body = rows.map((r, ri) => {
    const n = ri + 2;
    const cells = cols.map((k, ci) => {
      const ref = `${colName(ci)}${n}`;
      const def = colDef(k);
      const v = cellValue(r, k, lang);
      if (v == null || v === '') return '';
      if (typeof v === 'number') {
        if (def.kind === 'money') return num(ref, v, 7 + currencies.indexOf(curOf(r, k, qc)));
        if (def.kind === 'pct') return num(ref, v, 3);
        return num(ref, v, 4);
      }
      if (def.kind === 'date' && /^\d{4}-\d{2}-\d{2}/.test(v)) return num(ref, serial(v), 2);
      return str(ref, v, k === 'notes' ? 5 : 0);
    });
    return `<row r="${n}">${cells.join('')}</row>`;
  }).join('');
  const last = `${colName(Math.max(0, cols.length - 1))}${rows.length + 1}`;
  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ''} tabSelected="1"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/><selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="B2" sqref="B2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols.map((k, i) => `<col min="${i + 1}" max="${i + 1}" width="${colDef(k).w}" customWidth="1"/>`).join('')}</cols><sheetData>${head}${body}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;

  const det = inp.details.map(([k, v], i) => `<row r="${i + 1}">${str(`A${i + 1}`, k, 6)}${typeof v === 'number' ? num(`B${i + 1}`, v, 0) : str(`B${i + 1}`, v)}</row>`).join('');
  const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ''}/></sheetViews><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="60" customWidth="1"/></cols><sheetData>${det}</sheetData></worksheet>`;

  const [n1, n2] = inp.sheetNames.map(sheetName);
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets><sheet name="${esc(n1)}" sheetId="1" r:id="rId1"/><sheet name="${esc(n2)}" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(n1.replace(/'/g, "''"))}'!$A$1:$${colName(Math.max(0, cols.length - 1))}$${rows.length + 1}</definedName></definedNames></workbook>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(inp.ref)}</dc:title><dc:creator>ForwardDesk</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
    'xl/worksheets/sheet2.xml': strToU8(sheet2),
  };
  return zipSync(files, { level: 6 });
}

/** CSV: UTF-8 with BOM, comma-separated, numbers with '.' decimals, percentages as percent numbers, ISO dates. */
export function buildCsv(inp: Pick<ExportInput, 'rows' | 'cols' | 'lang'>): string {
  const q = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const out = [inp.cols.map((k) => q(colLabel(inp.lang, k))).join(',')];
  for (const r of inp.rows) {
    out.push(inp.cols.map((k) => {
      const v = cellValue(r, k, inp.lang);
      if (v == null) return '';
      if (typeof v === 'number') return String(colDef(k).kind === 'pct' ? Math.round(v * 1000) / 10 : Math.round(v * 100) / 100);
      return q(v);
    }).join(','));
  }
  return '\uFEFF' + out.join('\r\n') + '\r\n';
}

export function download(data: BlobPart, name: string, type: string) {
  const blob = new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
