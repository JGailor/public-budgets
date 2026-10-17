/**
 * Facts from City documents published after the workbook (data/cities/{city}/documents.json).
 * Each quote must appear on its page of source/excerpts/{source}.json, and every
 * number is parsed from the quote, never typed in: the same rule the workbook's
 * sentence-stated facts follow (citedFacts).
 */
import type { CityBudget, DocCapitalLine, DocCapitalPart, DocRef, DocumentFacts, Source, SourceId, StepNote, WorkbookBudget } from './types.ts';

export interface DocumentsFile {
  sources: Omit<Source, 'number' | 'row'>[];
  quotes: Record<string, DocRef>;
  capitalProgram: { source: SourceId; byFund: number; generalFund: string; generalFundBreakdown: number[] };
  stepNotes: Record<string, StepNote>;
}
/** Page number → page text, as extracted from the PDF. */
export type Excerpts = Record<SourceId, Record<string, string>>;

/** Collapse whitespace and the stray spaces PDF text extraction leaves around punctuation ("full - time", "( 1 )"). */
export const normalize = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/(\w) ?- ?(\w)/g, '$1-$2')
    .replace(/\(\s+/g, '(')
    .replace(/\s+([,.;:)])/g, '$1')
    .trim();

/** Throws unless `ref.quote` is on page `ref.page` (1 for a web page) of its source's excerpt. */
export function checkQuote(ref: Pick<DocRef, 'source' | 'quote'> & { page?: number }, excerpts: Excerpts, where: string) {
  const page = excerpts[ref.source]?.[String(ref.page ?? 1)];
  if (page === undefined) throw new Error(`${where}: no excerpt for ${ref.source} page ${ref.page ?? 1}`);
  if (!normalize(page).includes(normalize(ref.quote))) throw new Error(`${where}: "${ref.quote}" is not on ${ref.source} page ${ref.page ?? 1}`);
}

/** Every {source, quote} in a JSON file (ballot.json), checked against the excerpts; returns errors. */
export function checkQuotesIn(value: unknown, excerpts: Excerpts, known: Set<string>, where: string): string[] {
  const errors: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (typeof o.source === 'string' && typeof o.quote === 'string') {
      if (!known.has(o.source)) errors.push(`${where} ${path}: unknown source ${o.source}`);
      else {
        try {
          checkQuote(o as { source: SourceId; quote: string; page?: number }, excerpts, `${where} ${path}`);
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
    }
    for (const [k, x] of Object.entries(o)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(value, '');
  return errors;
}

const money = (s: string) => Number(s.replace(/[$,]/g, ''));
const MONTH = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const iso = (month: string, day: string, year: string) => `${year}-${String(MONTH.indexOf(month.toLowerCase()) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;

const AMOUNT = String.raw`\$ (-|[\d,]+)`;
const amount = (s: string) => (s === '-' ? 0 : money(s));

/**
 * A five-year CIP table (Proposed FY27, FY28, Planned FY29–31, 5-year total) on one page: each "name $ a $ b $ c $ d $ e $ f"
 * row, with its FY27 and FY28 columns. The 5-year column is checked against the other five, so a misread row fails.
 */
function cipRows(text: string, where: string, byLine = false): { name: string; fy2027: number; fy2028: number; quote: string }[] {
  const re = new RegExp(String.raw`([A-Za-z][^$\n]*?) ${Array(6).fill(AMOUNT).join(' ')}`, 'g');
  // One row per line where the table prints it so; otherwise (names that wrap) the page as one line.
  const flat = byLine ? text.split('\n').map(normalize).join('\n') : normalize(text);
  return [...flat.matchAll(re)].map((m) => {
    const cols = m.slice(2, 8).map(amount);
    if (cols.slice(0, 5).reduce((a, x) => a + x, 0) !== cols[5]) throw new Error(`${where}: "${m[0]}": the five years don't sum to the 5-year total`);
    return { name: m[1].trim(), fy2027: cols[0], fy2028: cols[1], quote: m[0] };
  });
}

/** The capital program by funding source (one page), with the General Fund's CIP fund broken down by program. */
export function capitalFromDocument(spec: DocumentsFile['capitalProgram'], excerpts: Excerpts): DocumentFacts['capitalProgram'] {
  const page = (n: number) => {
    const t = excerpts[spec.source]?.[String(n)];
    if (t === undefined) throw new Error(`capital program: no excerpt for ${spec.source} page ${n}`);
    return t;
  };
  const where = `${spec.source} p.${spec.byFund}`;
  const title = normalize(page(spec.byFund)).match(/FY 2027-FY 2031 CAPITAL PROGRAM BY FUNDING SOURCE-ALL FUNDS/)?.[0];
  if (!title) throw new Error(`${where}: not the "Capital program by funding source - all funds" table`);
  const rows = cipRows(page(spec.byFund), where, true);
  // Rows come in fund-type sections: a "Type" heading row, its funds, then "Type Total".
  const lines: DocCapitalLine[] = [];
  let type: string | null = null;
  let section: DocCapitalLine[] = [];
  for (const r of rows) {
    const total = r.name.match(/^(.*) Total$/);
    if (total) {
      if (total[1] !== type) throw new Error(`${where}: "${r.name}" closes section "${type}"`);
      for (const y of ['fy2027', 'fy2028'] as const) {
        const sum = section.reduce((a, l) => a + l[y], 0);
        if (sum !== r[y]) throw new Error(`${where}: ${type} rows sum to ${sum} in ${y}, but its Total row says ${r[y]}`);
      }
      lines.push(...section.filter((l) => l.total > 0));
      type = null;
      section = [];
    } else if (type === null) {
      if (r.fy2027 || r.fy2028) throw new Error(`${where}: expected a fund-type heading, got "${r.quote}"`);
      type = r.name;
    } else {
      section.push({ source: spec.source, page: spec.byFund, quote: r.quote, name: r.name, fundType: type, fy2027: r.fy2027, fy2028: r.fy2028, total: r.fy2027 + r.fy2028 });
    }
  }
  if (type !== null) throw new Error(`${where}: section "${type}" has no Total row`);

  const gf = lines.find((l) => l.name === spec.generalFund);
  if (!gf) throw new Error(`${where}: no "${spec.generalFund}" row`);
  const parts: DocCapitalPart[] = [];
  let grand: { fy2027: number; fy2028: number } | undefined;
  for (const n of spec.generalFundBreakdown) {
    for (const r of cipRows(page(n), `${spec.source} p.${n}`)) {
      const cat = r.name.match(/(?:^|\s)([A-Z][\w &]*?) Total$/);
      if (!cat) continue;
      if (cat[1] === 'Grand') grand = r;
      else if (r.fy2027 || r.fy2028) parts.push({ source: spec.source, page: n, quote: r.quote, name: cat[1], fy2027: r.fy2027, fy2028: r.fy2028, total: r.fy2027 + r.fy2028 });
    }
  }
  if (!grand) throw new Error(`${spec.source} pp.${spec.generalFundBreakdown.join('-')}: no Grand Total row`);
  for (const y of ['fy2027', 'fy2028'] as const) {
    const sum = parts.reduce((a, p) => a + p[y], 0);
    if (sum !== grand[y] || sum !== gf[y]) throw new Error(`capital program: ${spec.generalFund} programs sum to ${sum} in ${y}; Grand Total ${grand[y]}, p.${spec.byFund} row ${gf[y]}`);
  }
  gf.parts = parts.sort((a, b) => b.total - a.total);

  const fy2027 = lines.reduce((a, l) => a + l.fy2027, 0);
  const fy2028 = lines.reduce((a, l) => a + l.fy2028, 0);
  return { source: spec.source, page: spec.byFund, quote: title, lines, total: { fy2027, fy2028, total: fy2027 + fy2028 }, generalFund: spec.generalFund };
}

/** Adds the documents' sources (numbered after the workbook's) and their facts to the budget; returns errors. */
export function applyDocuments(budget: WorkbookBudget, file: DocumentsFile, excerpts: Excerpts): { budget: CityBudget; errors: string[] } {
  const errors: string[] = [];
  const first = budget.sources.length + 1;
  const added: Source[] = file.sources.map((s, i) => ({ ...s, number: first + i }));
  added.forEach((s, i) => {
    if (s.id !== `S${first + i}`) errors.push(`documents.json: source ${i + 1} is ${s.id}, expected S${first + i} (it continues the workbook's numbering)`);
    if ((s.type === 'city') !== (s.publisher === 'City of Berkeley')) errors.push(`${s.id}: type "${s.type}" but publisher "${s.publisher}"`);
  });
  const known = new Set([...budget.sources, ...added].map((s) => s.id));

  const q = (key: string): DocRef => {
    const ref = file.quotes[key];
    if (!ref) throw new Error(`documents.json: no quote "${key}"`);
    for (const id of [ref.source, ...(ref.related ?? [])]) if (!known.has(id)) throw new Error(`documents.json ${key}: unknown source ${id}`);
    checkQuote(ref, excerpts, `documents.json ${key}`);
    return ref;
  };
  /** The quote, matched against a pattern that pulls out its numbers. */
  const m = (key: string, re: RegExp): [DocRef, RegExpMatchArray] => {
    const ref = q(key);
    const match = normalize(ref.quote).match(re);
    if (!match) throw new Error(`documents.json ${key}: "${ref.quote}" doesn't match ${re}`);
    return [ref, match];
  };

  let documentFacts: DocumentFacts | undefined;
  try {
    const [stm, stmM] = m('salesTaxMeasure', /MEASURE ([A-Z])$/);
    const [str, strM] = m('salesTaxRevenue', /generate \$(\d+) to \$(\d+) million annually/);
    const [stc, stcM] = m('salesTaxRevenueCouncil', /approximately \$(\d+) million - \$(\d+) million annually/);
    const [stt, sttM] = m('salesTaxTerm', /beginning (\w+) (\d+), (\d{4}), and last (until ended by the voters)/);
    const [bm, bmM] = m('bondMeasure', /MEASURE ([A-Z])$/);
    const [bc, bcM] = m('bondCost', /projected (\d+) years .* approximately \$([\d.]+) per \$100,000 .* generating approximately (\$[\d,]+) per year/);
    const [bp, bpM] = m('bondPeak', /^\$(\d+) per \$100,000 .* in (\d{4}-\d{2})$/);
    const [ba, baM] = m('bondAudit', /at least once every (\w+) years/);
    const [ad] = m('adoption', /as amended by subsequent Council action/);
    const [ag, agM] = m('adoptionGap', /\$([\d.]+) million in FY27 .* \$([\d.]+) million in FY28/);
    const [cn, cnM] = m('capitalNeed', /Need \$ ([\d,]+)$/);
    const [cg, cgM] = m('capitalNeedGrowth', /increase at a rate of (\d+)% per year/);
    const TITLE = /^Measure ([A-Z]+)-(.+) \((.+)\)$/;
    const [stTitle, stTitleM] = m('salesTaxTitle', TITLE);
    const [bTitle, bTitleM] = m('bondTitle', TITLE);
    const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };
    const s20 = added.find((s) => s.id === ad.source);
    if (!s20?.date) throw new Error(`documents.json adoption: ${ad.source} has no date`);
    documentFacts = {
      salesTaxMeasure: { ...stm, letter: stmM[1] },
      salesTaxRevenue: { ...str, low: Number(strM[1]) * 1e6, high: Number(strM[2]) * 1e6 },
      salesTaxRevenueCouncil: { ...stc, low: Number(stcM[1]) * 1e6, high: Number(stcM[2]) * 1e6 },
      salesTaxTerm: { ...stt, start: iso(sttM[1], sttM[2], sttM[3]), until: sttM[4] },
      salesTaxGeneral: q('salesTaxGeneral'),
      bondMeasure: { ...bm, letter: bmM[1] },
      bondCost: { ...bc, years: Number(bcM[1]), perHundredK: Number(bcM[2]), perYear: money(bcM[3]) },
      bondPeak: { ...bp, perHundredK: Number(bpM[1]), from: bpM[2] },
      bondAudit: { ...ba, everyYears: words[baM[1]] ?? NaN },
      adoption: { ...ad, date: s20.date },
      adoptionGap: { ...ag, fy2027: Math.round(Number(agM[1]) * 1e6), fy2028: Math.round(Number(agM[2]) * 1e6) },
      capitalNeed: { ...cn, amount: money(cnM[1]) },
      capitalNeedGrowth: { ...cg, rate: Number(cgM[1]) / 100 },
      capitalProgram: capitalFromDocument(file.capitalProgram, excerpts),
      oneTimeDelay: q('oneTimeDelay'),
      stepNotes: Object.fromEntries(
        Object.entries(file.stepNotes).map(([key, n]) => {
          if (!n.text.trim() || !n.cites.length) throw new Error(`documents.json stepNotes.${key}: needs text and at least one cite`);
          for (const ref of n.cites) {
            if (!known.has(ref.source)) throw new Error(`documents.json stepNotes.${key}: unknown source ${ref.source}`);
            checkQuote(ref, excerpts, `documents.json stepNotes.${key}`);
          }
          return [key, n];
        }),
      ),
      salesTaxTitle: { ...stTitle, letter: stTitleM[1], title: stTitleM[2].trim(), vote: stTitleM[3] },
      bondTitle: { ...bTitle, letter: bTitleM[1], title: bTitleM[2].trim(), vote: bTitleM[3] },
    };
  } catch (e) {
    errors.push((e as Error).message);
  }
  if (!documentFacts) return { budget: { ...budget, sources: [...budget.sources, ...added] } as CityBudget, errors };

  // Cross-checks against the workbook: two documents, one estimate; the restated gap is the workbook's, rounded.
  const f = documentFacts;
  if (f.salesTaxRevenue.low !== f.salesTaxRevenueCouncil.low || f.salesTaxRevenue.high !== f.salesTaxRevenueCouncil.high)
    errors.push('documents.json: the City Attorney and Council revenue estimates disagree');
  if (f.salesTaxMeasure.letter === f.bondMeasure.letter) errors.push('documents.json: both measures have the same letter');
  // Every step the Gap page and the overview draw has its "what is this?" note, and no note names a step that isn't there.
  const stepKeys = [...budget.deficitBridge.steps.map((s) => s.key).filter((k) => k !== 'after-revenue-projections'), 'adjustments'];
  for (const k of stepKeys) if (!f.stepNotes[k]) errors.push(`documents.json stepNotes: no note for step "${k}"`);
  for (const k of Object.keys(f.stepNotes)) if (!stepKeys.includes(k)) errors.push(`documents.json stepNotes: "${k}" isn't a deficit-bridge step`);
  // Two City documents name the measures: the City Attorney's analyses and the Clerk's ballot measures page.
  if (f.salesTaxTitle.letter !== f.salesTaxMeasure.letter) errors.push(`documents.json: the ballot measures page calls the sales tax Measure ${f.salesTaxTitle.letter}, the impartial analysis Measure ${f.salesTaxMeasure.letter}`);
  if (f.bondTitle.letter !== f.bondMeasure.letter) errors.push(`documents.json: the ballot measures page calls the bond Measure ${f.bondTitle.letter}, the impartial analysis Measure ${f.bondMeasure.letter}`);
  const gap = budget.deficitBridge.steps.find((s) => s.key === 'final-gap');
  for (const [k, y] of [['fy2027', 'fy2027'], ['fy2028', 'fy2028']] as const) {
    const wb = gap ? Math.abs(gap[y]) : NaN;
    if (Math.abs(wb - f.adoptionGap[k]) > 5_000) errors.push(`adoption staff report restates the ${k} gap as ${f.adoptionGap[k]}, but the workbook says ${wb}`);
  }
  if (!Number.isFinite(f.bondAudit.everyYears)) errors.push('documents.json bondAudit: unrecognized number of years');
  return { budget: { ...budget, sources: [...budget.sources, ...added], documentFacts }, errors };
}
