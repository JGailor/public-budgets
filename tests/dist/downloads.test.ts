import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { csvTables } from '../../src/data/csv';
import type { CityBudget } from '../../src/data/types';

// The Sources page links to these; they're generated from budget.json at build time.
const root = join(import.meta.dirname, '../..');
const data = join(root, 'dist/us/ca/berkeley/data');
const committed: CityBudget = JSON.parse(readFileSync(join(root, 'data/cities/us/ca/berkeley/budget.json'), 'utf8'));

describe('Berkeley data downloads', () => {
  it('serves the combined JSON, identical to the committed budget.json', () => {
    expect(JSON.parse(readFileSync(join(data, 'budget.json'), 'utf8'))).toEqual(committed);
  });

  it.each(csvTables(committed).map((t) => [t.name, t.columns, t.rows.length] as const))(
    'serves %s.csv with its header and every row',
    (name, columns, rows) => {
      const lines = readFileSync(join(data, `${name}.csv`), 'utf8').trimEnd().split('\r\n');
      expect(lines[0]).toBe(columns.join(','));
      // Glossary definitions contain no newlines, so one line per row holds.
      expect(lines).toHaveLength(rows + 1);
    },
  );

  it('serves the original workbook, byte for byte', () => {
    const file = join(data, 'Berkeley_Budget_FY25-FY28.xlsx');
    expect(existsSync(file)).toBe(true);
    expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(committed.workbook.sha256);
  });
});
