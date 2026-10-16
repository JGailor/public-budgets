/**
 * After the build, records which pages each source's chips actually appear on,
 * so a receipt's "Used on" line (and the Sources page) can't drift from the
 * pages themselves. Writes dist/{city}/data/source-usage.json:
 *   { "S1": [{ "path": "/us/ca/berkeley/gap/", "label": "The Gap" }], "S2": [], … }
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { CITY_PAGES } from '../lib/city-pages.ts';

const CHIP = /data-source-chip="(S\d+)"/g;

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

/** Page label for the receipt: "Overview" for the city root, else the nav label. */
function label(cityPath: string, pagePath: string): string {
  const slug = pagePath.slice(cityPath.length).replace(/\/$/, '');
  if (!slug) return 'Overview';
  return CITY_PAGES.find((p) => p.slug === slug)?.label ?? slug;
}

export function buildUsage(dist: string) {
  const written: string[] = [];
  for (const budgetFile of findBudgets(dist)) {
    const cityPath = '/' + relative(dist, join(budgetFile, '../..')).split(sep).join('/') + '/';
    const budget = JSON.parse(readFileSync(budgetFile, 'utf8'));
    const usage: Record<string, { path: string; label: string }[]> = Object.fromEntries(
      budget.sources.map((s: { id: string }) => [s.id, []]),
    );
    for (const file of htmlFiles(join(dist, cityPath))) {
      const pagePath = '/' + relative(dist, file).split(sep).join('/').replace(/index\.html$/, '');
      const ids = new Set([...readFileSync(file, 'utf8').matchAll(CHIP)].map((m) => m[1]));
      for (const id of ids) {
        if (!usage[id]) throw new Error(`${pagePath}: chip for ${id}, which isn't in ${cityPath}'s sources`);
        usage[id].push({ path: pagePath, label: label(cityPath, pagePath) });
      }
    }
    for (const pages of Object.values(usage)) pages.sort((a, b) => a.path.localeCompare(b.path));
    const out = join(dist, cityPath, 'data/source-usage.json');
    writeFileSync(out, JSON.stringify(usage, null, 2) + '\n');
    written.push(out);
  }
  return written;
}

/** dist/{country}/{state}/{city}/data/budget.json for every city with data. */
function findBudgets(dist: string): string[] {
  return htmlFiles(dist)
    .map((f) => join(f, '..'))
    .filter((d, i, all) => all.indexOf(d) === i)
    .map((d) => join(d, 'data/budget.json'))
    .filter((f) => existsSync(f));
}

export default function sourceUsage(): AstroIntegration {
  return {
    name: 'source-usage',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        for (const f of buildUsage(fileURLToPath(dir))) logger.info(`wrote ${f}`);
      },
    },
  };
}
