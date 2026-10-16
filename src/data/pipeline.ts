/**
 * One entry per city that has budget data: where its workbook lives and how
 * to turn it into budget.json. `npm run data` runs every entry.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractBerkeley } from './berkeley/extract.ts';
import { validateBerkeley } from './berkeley/validate.ts';
import type { CityBudget } from './types.ts';
import { openWorkbook } from './workbook.ts';

export const PIPELINES: Record<string, { workbook: string; build: (path: string, meta: CityBudget['workbook']) => Promise<Result> }> = {
  'us/ca/berkeley': {
    workbook: 'source/Berkeley_Budget_FY25-FY28.xlsx',
    build: async (path, meta) => {
      const { budget, checks } = await extractBerkeley(await openWorkbook(path), meta);
      return { budget, errors: validateBerkeley(budget, checks) };
    },
  },
};

export interface Result {
  budget: CityBudget;
  /** Failed tie-out checks; empty means the data is good. */
  errors: string[];
}

/** Runs one city's pipeline against `workbookPath` (defaults to the committed workbook). */
export async function buildCity(root: string, city: string, workbookPath?: string): Promise<Result> {
  const pipeline = PIPELINES[city];
  if (!pipeline) throw new Error(`no data pipeline for ${city}`);
  const path = workbookPath ?? join(root, 'data/cities', city, pipeline.workbook);
  const sha256 = createHash('sha256').update(await readFile(path)).digest('hex');
  return pipeline.build(path, { file: pipeline.workbook, sha256 });
}

/** budget.json exactly as committed: stable key order, trailing newline. */
export const serialize = (budget: CityBudget) => JSON.stringify(budget, null, 2) + '\n';
