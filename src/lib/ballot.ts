/**
 * Figures for a city's Ballot page. Strictly neutral: both outcomes are built
 * by the same function and rendered by the same template. Election results,
 * when they're in, are a data change in data/cities/{city}/ballot.json.
 */
import type { CityBudget, SourceId } from '../data/types.ts';
import type { Figure } from './receipts.ts';

export type Status = 'pending' | 'passed' | 'failed';
export type Outcome = 'passes' | 'fails';

/** A statement's source: the PDF page (none for a web page) and the sentence it says, checked against the excerpts at build time. */
export interface Cite {
  source: SourceId;
  page?: number;
  quote: string;
}

/** One line of a scenario card. Both outcomes cite the same documents. */
export interface Row {
  key: string;
  label: string;
  passes: { text: string; cite: Cite; also: SourceId[] };
  fails: { text: string; cite: Cite; also: SourceId[] };
}

export interface BallotFile {
  election: string;
  measures: { salesTax: { status: Status; yesShare: number | null }; bond: { status: Status; yesShare: number | null } };
  rows: Row[];
  /** "as amended by subsequent Council action": the budget was adopted with changes the figures shown don't include. */
  adoption: { cite: Cite };
  /** Shown identically on both cards, under the position counts. */
  countsCaveat: { text: string; cites: Cite[] };
}

const files = import.meta.glob<BallotFile>('/data/cities/*/*/*/ballot.json', { eager: true, import: 'default' });

export function ballotFileFor(cityPath: string): BallotFile {
  const f = files[`/data/cities${cityPath}ballot.json`];
  if (!f) throw new Error(`${cityPath} has no ballot.json`);
  return f;
}

/** Heading and per-outcome result marks, from the measures' status. `measure` is "Measure V", or "The sales tax" before it has a letter. */
export function ballotState(file: BallotFile, measure = 'The sales tax') {
  const status = file.measures.salesTax.status;
  const result: Outcome | null = status === 'passed' ? 'passes' : status === 'failed' ? 'fails' : null;
  return {
    decided: result !== null,
    result,
    eyebrow: result ? 'Election results' : new Date(`${file.election}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    heading: result ? `${measure} ${status}. Here's what the city's plan says happens now.` : 'On your ballot, and what it changes',
    lede: result
      ? "The city's plan was built in two versions, one for each result. This is the one that now applies, with the other kept for comparison."
      : "Two city measures affect the budget. We don't take a side. This page shows what the city's own plan says happens under each result.",
    bond: file.measures.bond.status,
  };
}

const STATUSES: Status[] = ['pending', 'passed', 'failed'];

/** Throws on a ballot.json the page can't render honestly. */
export function checkBallotFile(file: BallotFile, b: CityBudget, where = 'ballot.json') {
  for (const [k, m] of Object.entries(file.measures)) {
    if (!STATUSES.includes(m.status)) throw new Error(`${where}: ${k}.status must be one of ${STATUSES.join(', ')}, got "${m.status}"`);
  }
  const known = new Set(b.sources.map((s) => s.id));
  const cites = (c: Cite, at: string) => {
    if (!known.has(c.source)) throw new Error(`${where}: ${at} cites unknown source ${c.source}`);
    if (!c.quote) throw new Error(`${where}: ${at} needs a quote`);
  };
  for (const r of file.rows) {
    for (const o of ['passes', 'fails'] as const) {
      const x = r[o];
      if (!x?.text) throw new Error(`${where}: rows.${r.key}.${o} needs text`);
      cites(x.cite, `rows.${r.key}.${o}`);
      for (const id of x.also) if (!known.has(id)) throw new Error(`${where}: rows.${r.key}.${o} cites unknown source ${id}`);
    }
    // Neutral by construction: both outcomes cite the same documents, so neither reads as better sourced.
    const docs = (o: 'passes' | 'fails') => [r[o].cite.source, ...r[o].also].join();
    if (docs('passes') !== docs('fails')) throw new Error(`${where}: rows.${r.key} cites ${docs('passes')} if it passes but ${docs('fails')} if it fails`);
  }
  cites(file.adoption.cite, 'adoption');
  if (!file.countsCaveat.text || !file.countsCaveat.cites.length) throw new Error(`${where}: countsCaveat needs text and cites`);
  file.countsCaveat.cites.forEach((c, i) => cites(c, `countsCaveat.cites[${i}]`));
}

export function ballotPage(b: CityBudget, file: BallotFile, short: Record<string, string> = {}) {
  checkBallotFile(file, b);
  const fy27 = b.departmentReductions.find((y) => y.year === 'FY2027')!;
  const t = b.citedFacts.salesTax;
  const bond = b.citedFacts.bond;
  const d = b.documentFacts;
  const cite = (r: { source: SourceId; page: number; quote: string }): Cite => ({ source: r.source, page: r.page, quote: r.quote });
  const pos = (k: 'with-sales-tax' | 'without-sales-tax') => b.fte.positions.find((p) => p.key === k)!;
  const fte = (k: 'with-sales-tax' | 'without-sales-tax') => b.fte.scenarios.find((s) => s.key === k)!;
  const bridge = b.oneTimeResources.uses.find((u) => /sales & use tax/i.test(u.label))!;

  // One builder for both outcomes: same fields, same order, same wording.
  const scenario = (outcome: Outcome) => {
    const key = outcome === 'passes' ? 'with-sales-tax' : 'without-sales-tax';
    const p = pos(key);
    const f = fte(key);
    const cuts = outcome === 'passes' ? fy27.total.netReduction : fy27.total.reduction;
    const cutsPct = outcome === 'passes' ? fy27.total.netReductionPct : fy27.total.reductionPct;
    const word = outcome === 'passes' ? 'passes' : 'fails';
    return {
      outcome,
      positions: { total: p.total, vacant: p.vacant, filled: p.filled, figure: { value: p.total, label: `Positions eliminated if the sales tax ${word} (${p.vacant} vacant, ${p.filled} filled)`, ref: p, format: 'number', tone: 'neutral' } satisfies Figure },
      cuts: { value: cuts, pct: cutsPct, figure: { value: cuts, label: `FY2027 department cuts if the sales tax ${word}`, ref: fy27.total, tone: 'short' } satisfies Figure },
      workforce: {
        after: f.fy2027NetFte,
        before: f.fy2026AdoptedFte,
        figure: { value: f.fy2027NetFte, label: `City workforce (FTE) after FY2027 cuts if the sales tax ${word}`, ref: f, format: 'number', tone: 'neutral' } satisfies Figure,
      },
      rows: file.rows.map((r) => ({ key: r.key, label: r.label, ...r[outcome] })),
      caveat: file.countsCaveat,
    };
  };
  const scenarios = [scenario('passes'), scenario('fails')];
  const softened = fy27.departments.filter((d) => d.salesTaxAllocation > 0).sort((a, c) => c.salesTaxAllocation - a.salesTaxAllocation);

  return {
    state: ballotState(file, `Measure ${d.salesTaxMeasure.letter}`),
    salesTax: {
      fact: t,
      letter: d.salesTaxMeasure.letter,
      letterCite: cite(d.salesTaxMeasure),
      /** The City's estimate, as the City Attorney's impartial analysis and the Council report both state it. */
      revenue: { low: d.salesTaxRevenue.low, high: d.salesTaxRevenue.high, cites: [cite(d.salesTaxRevenue), cite(d.salesTaxRevenueCouncil)] },
      term: { start: d.salesTaxTerm.start, until: d.salesTaxTerm.until, cite: cite(d.salesTaxTerm) },
      general: cite(d.salesTaxGeneral),
      figure: { value: t.rate, label: `Measure ${d.salesTaxMeasure.letter}: proposed local sales tax, ${t.election} ballot`, ref: t, format: 'percent', tone: 'neutral' } satisfies Figure,
      bridge: { value: bridge.amount, label: 'One-time money set aside as the sales-tax bridge, FY2027-28', ref: bridge, tone: 'one-time' } satisfies Figure,
    },
    bond: {
      fact: bond,
      letter: d.bondMeasure.letter,
      letterCite: cite(d.bondMeasure),
      cost: { perHundredK: d.bondCost.perHundredK, years: d.bondCost.years, perYear: d.bondCost.perYear, cite: cite(d.bondCost) },
      peak: { perHundredK: d.bondPeak.perHundredK, from: d.bondPeak.from, cite: cite(d.bondPeak) },
      audit: { everyYears: d.bondAudit.everyYears, cite: cite(d.bondAudit) },
      /** The FY27–31 CIP's unfunded capital and maintenance need: the City's newest figure. */
      need: { value: d.capitalNeed.amount, label: 'Unfunded capital and maintenance need, FY2027–31 CIP', ref: d.capitalNeed, tone: 'neutral' } satisfies Figure,
      figure: { value: bond.amount, label: `Measure ${d.bondMeasure.letter}: proposed infrastructure bond, ${bond.election} ballot`, ref: bond, tone: 'neutral' } satisfies Figure,
      /** The bond-planning page's earlier range, kept for comparison. */
      backlog: { value: b.citedFacts.backlog.low, label: 'Unfunded infrastructure and deferred maintenance, earlier City estimate (low end)', ref: b.citedFacts.backlog, tone: 'neutral' } satisfies Figure,
    },
    scenarios,
    /** Same scale for both pictograms: the larger layoff count, rounded up to a full row of 20. */
    pictogramSlots: Math.ceil(Math.max(...scenarios.map((s) => s.positions.filled)) / 20) * 20,
    softened: softened.map((d) => short[d.id] ?? d.name),
    plan: b.sources.find((s) => s.id === 'S1')!,
    adoption: { date: d.adoption.date, cite: file.adoption.cite },
  };
}
