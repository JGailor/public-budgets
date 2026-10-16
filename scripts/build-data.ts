/**
 * Builds data/cities/{city}/budget.json from each city's workbook, and fails
 * if any tie-out check breaks.
 *
 *   npm run data          write budget.json
 *   npm run data:check    (runs before every build) fail if budget.json is
 *                         missing, stale, or the workbook doesn't validate
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PIPELINES, buildCity, serialize } from '../src/data/pipeline.ts';

const root = join(import.meta.dirname, '..');
const check = process.argv.includes('--check');
let failed = false;

for (const city of Object.keys(PIPELINES)) {
  const { budget, errors } = await buildCity(root, city);
  if (errors.length) {
    failed = true;
    console.error(`✘ ${city}: ${errors.length} check(s) failed`);
    for (const e of errors) console.error(`  - ${e}`);
    continue;
  }
  const out = join(root, 'data/cities', city, 'budget.json');
  const json = serialize(budget);
  if (check) {
    const committed = await readFile(out, 'utf8').catch(() => '');
    if (committed !== json) {
      failed = true;
      console.error(`✘ ${city}: budget.json is out of date with its workbook. Run \`npm run data\` and commit the result.`);
      continue;
    }
    console.log(`✓ ${city}: budget.json matches the workbook and passes all checks`);
  } else {
    await writeFile(out, json);
    console.log(`✓ ${city}: wrote budget.json (${budget.sources.length} sources, all checks pass)`);
  }
}

process.exit(failed ? 1 : 0);
