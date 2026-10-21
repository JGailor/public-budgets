/**
 * #38: overview card 2 says why, in the City's words, with S1 p.4 and S20 p.2; the Sources
 * page's known gaps say the card's growth rates and the Auditor's finding measure different things.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Receipt } from '../../src/lib/receipts';

const dist = join(import.meta.dirname, '../../dist/us/ca/berkeley');
const read = (p: string) => readFileSync(join(dist, p, 'index.html'), 'utf8');
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const receipts = (h: string): Receipt[] => [...h.matchAll(/data-receipt="([^"]*)"/g)].map((m) => JSON.parse(unescape(m[1])));
const text = (h: string) => unescape(h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

describe("overview card 2: why costs grew (#38)", () => {
  const h = read('');
  const card = h.slice(h.indexOf('Costs are growing faster than income.'), h.indexOf('</li>', h.indexOf('Costs are growing faster than income.')));
  const why = card.slice(card.indexOf('class="why"'), card.indexOf('</p>', card.indexOf('class="why"')));

  it('says why in two sentences, right under the body', () => {
    expect(card.indexOf('class="why"')).toBeGreaterThan(card.indexOf('So it starts each year short.'));
    expect(text(why)).toContain(
      'Why? The City points to rising personnel, pension and health-care costs, inflation, and programs that were paid for with one-time money, along with limits on state and federal revenue.',
    );
    expect(text(why)).toContain("This year's budget also builds in pay increases already set in labor agreements and higher health, dental and CalPERS pension contributions.");
  });

  it('each sentence has its own ⓘ: S1 p.4 and S20 p.2, each with the sentence it rests on', () => {
    const r = receipts(why);
    expect(r.map((x) => `${x.sources[0]} p.${x.page}`)).toEqual(['S1 p.4', 'S20 p.2']);
    expect(r[0].quote).toMatch(/^Rising costs in personnel, pension, and health care/);
    expect(r[1].quote).toMatch(/^Personnel budgets incorporate projected equity/);
  });
});

describe('Sources: the growth rates and the Auditor measure different things (#38)', () => {
  const h = read('sources');
  const gap = h.slice(h.indexOf('data-gap="growth-vs-auditor"'), h.indexOf('</li>', h.indexOf('data-gap="growth-vs-auditor"')));

  it("says plainly what each covers, and that they aren't necessarily in conflict", () => {
    const t = text(gap);
    expect(t).toContain("The overview's 8% vs 6.5% yearly growth is City staff's figure for the General Fund, as reported by the Berkeley Scanner.");
    expect(t).toContain("The City Auditor's report on FY 2012 to FY 2021 found that the City's revenues increased and outpaced expenses in most years.");
    expect(t).toContain('It looked at all governmental activities, not just the General Fund.');
    expect(t).toContain("The years and the funds differ, so the two aren't necessarily in conflict.");
  });

  it('cites S12, and S8 at page 49 (the finding and its years) and page 13 (its scope)', () => {
    const r = receipts(gap);
    expect(r.map((x) => x.sources[0])).toEqual(['S12', 'S8']);
    const s8 = r[1];
    expect([s8.page, ...(s8.also ?? []).map((c) => c.page)]).toEqual([49, 49, 13]);
    expect(s8.quote).toBe('The City’s revenues have increased since FY 2012 and outpaced expenses most years');
  });
});
