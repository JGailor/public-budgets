/**
 * Shape of data/cities/{country}/{state}/{city}/budget.json.
 *
 * Every figure the site shows comes from here, and every record says where
 * it came from: `source` is the primary document (an S-number from the
 * Sources table), `related` lists other documents that report the same
 * figure, and `table` + `row` point at the workbook cell row it was read
 * from, so a receipt can say "Deficit Bridge FY27-28, row 13".
 *
 * Bump SCHEMA_VERSION when a field is renamed or removed.
 */

export const SCHEMA_VERSION = 1;

export type SourceId = `S${number}`;

export interface Ref {
  source: SourceId;
  related?: SourceId[];
  /** Workbook tab name. */
  table: string;
  /** 1-based workbook row number. */
  row: number;
}

export interface Source {
  id: SourceId;
  number: number;
  /** "City of Berkeley", "Berkeleyside", … */
  publisher: string;
  title: string;
  /** The body that issued it, when the source names one ("Budget & Finance Cmte"). */
  committee?: string;
  /** ISO date, as precise as the source gives it: "2026-04-16" or "2026-04". */
  date?: string;
  /** The date exactly as the workbook writes it ("Apr 16 2026"). */
  dateLabel?: string;
  url: string;
  /** city = a City of Berkeley document (primary); news = reporting (context). */
  type: 'city' | 'news';
  usedFor: string;
  /** Row on the Sources & Links tab. */
  row: number;
}

export interface RevenueLine extends Ref {
  name: string;
  fy2026Adopted: number;
  fy2026MidYearActual: number;
  fy2025MidYearActual: number;
  /** Derived: fy2026MidYearActual / fy2026Adopted; null when nothing was budgeted. */
  pctOfAdoptedReceived: number | null;
  /** Derived: fy2026MidYearActual - fy2025MidYearActual. */
  changeVsFy2025: number;
  /** Derived: changeVsFy2025 / fy2025MidYearActual; null when FY2025 was zero. */
  changeVsFy2025Pct: number | null;
}

export interface Revenue {
  title: string;
  /** The tab's note on how to read it (mid-year = Jul–Dec, …). */
  note: string;
  lines: RevenueLine[];
  /** The workbook's TOTAL row, tied against the sum of `lines` by validation. */
  total: RevenueLine;
}

export type BridgeStepKind = 'estimate' | 'change' | 'subtotal' | 'total';

export interface BridgeStep extends Ref {
  key: string;
  label: string;
  kind: BridgeStepKind;
  fy2027: number;
  fy2028: number;
}

export interface DeficitBridge {
  title: string;
  note: string;
  steps: BridgeStep[];
}

export interface DepartmentReduction extends Ref {
  /** Stable slug for URLs: "police", "odpa", "city-attorney". */
  id: string;
  name: string;
  /** Charter office (sets its own reductions; named in the tab's note). */
  charter: boolean;
  baseline: number;
  reduction: number;
  /** One-time sales & use tax money softening this department's cut. */
  salesTaxAllocation: number;
  /** Derived: baseline - reduction. */
  budgetAfterReduction: number;
  /** Derived: reduction / baseline. */
  reductionPct: number;
  /** Derived: reduction - salesTaxAllocation (the cut if the sales tax passes). */
  netReduction: number;
  /** Derived: netReduction / baseline. */
  netReductionPct: number;
}

export interface DepartmentReductionTotal extends Ref {
  baseline: number;
  reduction: number;
  salesTaxAllocation: number;
  budgetAfterReduction: number;
  reductionPct: number;
  netReduction: number;
  netReductionPct: number;
}

export interface DepartmentReductions {
  year: 'FY2027' | 'FY2028';
  title: string;
  note: string;
  departments: DepartmentReduction[];
  total: DepartmentReductionTotal;
}

export interface FteScenario extends Ref {
  key: 'without-sales-tax' | 'with-sales-tax';
  label: string;
  fy2026AdoptedFte: number;
  fy2026Rif: number;
  fy2027BaselineFte: number;
  fy2027Reduction: number;
  /** Derived: fy2027BaselineFte - fy2027Reduction. */
  fy2027NetFte: number;
  /** Derived: fy2026Rif + fy2027Reduction. */
  cumulativeRif: number;
  /** Derived: cumulativeRif / fy2026AdoptedFte. */
  cumulativeReductionPct: number;
}

export interface PositionReduction extends Ref {
  key: 'without-sales-tax' | 'with-sales-tax';
  label: string;
  vacant: number;
  filled: number;
  /** Derived: vacant + filled. */
  total: number;
}

export interface Fte {
  title: string;
  note: string;
  scenarios: FteScenario[];
  positions: PositionReduction[];
}

export interface OneTimeItem extends Ref {
  label: string;
  amount: number;
}

export interface OneTimeResources {
  title: string;
  sources: OneTimeItem[];
  uses: OneTimeItem[];
  /** Derived sums. */
  totalSources: number;
  totalUses: number;
  remaining: number;
}

export interface CapitalLine extends Ref {
  name: string;
  category: string;
  fy2027: number;
  fy2028: number;
  /** Derived: fy2027 + fy2028. */
  total: number;
}

export interface CapitalProgram {
  title: string;
  lines: CapitalLine[];
  total: CapitalLine;
}

export interface CostComponent extends Ref {
  label: string;
  amount: number;
  note: string;
}

export interface UnfundedLiability extends Ref {
  asOf: string;
  amount: number;
  note: string;
}

export interface PersonnelAndPension {
  title: string;
  note: string;
  /** FY2026 General Fund cost composition (approximate, as cited). */
  composition: CostComponent[];
  compositionTotal: CostComponent;
  personnelSubtotal: CostComponent;
  unfundedLiabilities: UnfundedLiability[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  table: string;
  row: number;
}

/** A figure stated in a sentence of the workbook rather than a table cell. */
export interface CitedFact extends Ref {
  /** The sentence, verbatim. */
  text: string;
}

export interface CitedFacts {
  /** "Over 10 years: spending grew ~8%/yr vs revenue ~6.5%/yr". */
  growth: CitedFact & { years: number; spendingRate: number; revenueRate: number };
  /** The proposed local sales tax on the ballot: rate 0.005 = 0.5%. */
  salesTax: CitedFact & { rate: number; election: string };
  /** The proposed infrastructure bond on the ballot. */
  bond: CitedFact & { amount: number; election: string };
}

export interface CityBudget {
  schemaVersion: number;
  workbook: { file: string; sha256: string };
  /** From the workbook's README note; shown on every receipt. */
  notes: {
    /** Years the workbook covers, from its title: "FY2025–FY2028". */
    coverage: string;
    /** "Budgetary/cash basis" */
    basis: string;
    /** "Figures are from budget/planning documents … subject to revision. Not for investment-decision use." */
    caveat: string;
    table: string;
    row: number;
  };
  sources: Source[];
  revenue: Revenue;
  deficitBridge: DeficitBridge;
  departmentReductions: DepartmentReductions[];
  fte: Fte;
  oneTimeResources: OneTimeResources;
  capitalProgram: CapitalProgram;
  personnelAndPension: PersonnelAndPension;
  glossary: GlossaryEntry[];
  citedFacts: CitedFacts;
}

/** A formula cell the workbook computed, next to what we computed for it. */
export interface CrossCheck {
  what: string;
  computed: number | null;
  cached: number;
}
