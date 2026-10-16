/**
 * Checks that every source URL still resolves. Runs in CI as its own,
 * non-blocking job: news sites and city servers are sometimes slow or block
 * robots, so a failure here is a warning to look at, not a broken build.
 *   node scripts/check-links.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (compatible; WhereTheMoneyWent-linkcheck/1.0; +https://wherethemoneywent.com)';

function budgets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? budgets(p) : e.name === 'budget.json' ? [p] : [];
  });
}

async function check(url: string): Promise<{ ok: boolean; detail: string }> {
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const method of ['HEAD', 'GET']) {
      try {
        const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
        await res.body?.cancel();
        if (res.ok) return { ok: true, detail: `${res.status}${res.redirected ? ` → ${res.url}` : ''}` };
        last = `${method} ${res.status}`;
        if (method === 'HEAD' && [403, 405, 501].includes(res.status)) continue; // some servers refuse HEAD
        break;
      } catch (e) {
        last = `${method} ${(e as Error).message}`;
      }
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  return { ok: false, detail: last };
}

// LINKCHECK_DATA points the check at another folder (used to prove it catches dead links).
const dataDir = process.env.LINKCHECK_DATA ?? join(root, 'data/cities');
const files = existsSync(dataDir) ? budgets(dataDir) : [];
if (!files.length) {
  console.log(`no budget.json under ${dataDir}`);
  process.exit(1);
}
let failures = 0;
for (const file of files) {
  const { sources } = JSON.parse(readFileSync(file, 'utf8')) as { sources: { id: string; url: string }[] };
  const results = await Promise.all(sources.map(async (s) => ({ s, r: await check(s.url) })));
  for (const { s, r } of results) {
    if (r.ok) console.log(`ok   ${s.id} ${r.detail}`);
    else {
      failures++;
      console.log(`FAIL ${s.id} ${r.detail} ${s.url}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Source link ${s.id}::${r.detail} ${s.url}`);
    }
  }
}
console.log(failures ? `${failures} source link(s) failed` : 'all source links resolve');
process.exit(failures ? 1 : 0);
