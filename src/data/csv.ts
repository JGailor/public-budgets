/**
 * The per-table CSV downloads offered on each city's Sources page. Each row
 * keeps its receipt columns (source, related, table, row) so a spreadsheet
 * user can trace any figure the same way the site does.
 */
import type { CityBudget } from './types.ts';

export interface CsvTable {
  /** File name without extension, e.g. "deficit-bridge". */
  name: string;
  columns: string[];
  rows: readonly object[];
}

const REF_COLUMNS = ['source', 'related', 'table', 'row'];

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(';') : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv({ columns, rows }: CsvTable): string {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell((r as Record<string, unknown>)[c])).join(','))].join('\r\n') + '\r\n';
}

const withRef = (columns: string[]) => [...columns, ...REF_COLUMNS];

export function csvTables(b: CityBudget): CsvTable[] {
  const revenueColumns = [
    'name',
    'fy2026Adopted',
    'fy2026MidYearActual',
    'pctOfAdoptedReceived',
    'fy2025MidYearActual',
    'changeVsFy2025',
    'changeVsFy2025Pct',
  ];
  const deptColumns = [
    'id',
    'name',
    'charter',
    'baseline',
    'reduction',
    'budgetAfterReduction',
    'reductionPct',
    'salesTaxAllocation',
    'netReduction',
    'netReductionPct',
  ];
  const ot = b.oneTimeResources;

  return [
    {
      name: 'revenue-fy2026',
      columns: withRef(revenueColumns),
      rows: [...b.revenue.lines, b.revenue.total],
    },
    {
      name: 'deficit-bridge',
      columns: withRef(['key', 'label', 'kind', 'fy2027', 'fy2028']),
      rows: b.deficitBridge.steps,
    },
    ...b.departmentReductions.map((y) => ({
      name: `department-reductions-${y.year.toLowerCase()}`,
      columns: withRef(deptColumns),
      rows: [...y.departments, { ...y.total, id: 'total', name: 'TOTAL Citywide' }],
    })),
    {
      name: 'fte-scenarios',
      columns: withRef([
        'key',
        'label',
        'fy2026AdoptedFte',
        'fy2026Rif',
        'fy2027BaselineFte',
        'fy2027Reduction',
        'fy2027NetFte',
        'cumulativeRif',
        'cumulativeReductionPct',
      ]),
      rows: b.fte.scenarios,
    },
    {
      name: 'position-reductions',
      columns: withRef(['key', 'label', 'vacant', 'filled', 'total']),
      rows: b.fte.positions,
    },
    {
      name: 'one-time-resources',
      columns: withRef(['side', 'label', 'amount']),
      rows: [...ot.sources.map((i) => ({ side: 'source', ...i })), ...ot.uses.map((i) => ({ side: 'use', ...i }))],
    },
    {
      name: 'capital-program',
      columns: withRef(['name', 'category', 'fy2027', 'fy2028', 'total']),
      rows: [...b.capitalProgram.lines, b.capitalProgram.total],
    },
    {
      name: 'personnel-cost-composition',
      columns: withRef(['label', 'amount', 'note']),
      rows: [
        ...b.personnelAndPension.composition,
        b.personnelAndPension.compositionTotal,
        b.personnelAndPension.personnelSubtotal,
      ],
    },
    {
      name: 'unfunded-liabilities',
      columns: withRef(['asOf', 'amount', 'note']),
      rows: b.personnelAndPension.unfundedLiabilities,
    },
    {
      name: 'sources',
      columns: ['id', 'number', 'type', 'publisher', 'title', 'committee', 'date', 'dateLabel', 'url', 'usedFor', 'row'],
      rows: b.sources,
    },
    {
      name: 'glossary',
      columns: ['term', 'definition', 'table', 'row'],
      rows: b.glossary,
    },
  ];
}
