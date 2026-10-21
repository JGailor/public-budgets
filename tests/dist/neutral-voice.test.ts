import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Receipt } from '../../src/lib/receipts';

// #34: describe what the City did in the City's terms, with no adjectives on money. See README "Voice".
const LOADED = [
  'propping up', 'propped up', 'props up', 'prop up', 'bloat', 'slash', 'gutting', 'gutted', 'lavish', 'wasteful', 'squander',
  'reckless', 'bailout', 'bail out', 'handout', 'ballooning', 'skyrocket', 'runaway', 'draconian', 'crippl', 'devastat',
  'staggering', 'whopping', 'raiding', 'boondoggle', 'giveaway', 'windfall', 'out of control', 'fiscal cliff', 'leans on',
];
const loaded = (text: string) => LOADED.filter((w) => new RegExp(`\\b${w}`, 'i').test(text));

const dist = join(import.meta.dirname, '../../dist');
const pages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pages(join(dir, e.name)) : e.name === 'index.html' ? [join(dir, e.name)] : []));
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** What a reader sees or hears on a page, plus the drawer's own words. Quotations are the source's words, not ours. */
export function ourWords(html: string): string {
  const receipts: Receipt[] = [...html.matchAll(/data-receipt="([^"]*)"/g)].map((m) => JSON.parse(unescape(m[1])));
  const drawer = receipts.flatMap((r) => [r.label ?? '', ...(r.parts ?? []).map((p) => p.label), r.total ?? '']);
  const attrs = [...html.matchAll(/\b(?:aria-label|title|alt)="([^"]*)"/g)].map((m) => unescape(m[1]));
  const visible = unescape(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
      .replace(/<(q|blockquote)\b[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
  return [visible, ...attrs, ...drawer].join('\n');
}

describe('neutral voice (#34)', () => {
  it('the denylist catches the old Gap label', () => {
    expect(loaded('−$1.1M Propping up parking funds')).toEqual(['propping up']);
    expect(loaded('The council slashed the budget')).toEqual(['slash']);
    expect(loaded('Support for parking funds')).toEqual([]);
  });

  const all = pages(dist);
  it('checks every built page', () => expect(all.length).toBeGreaterThan(8));
  for (const f of all) {
    const path = f.slice(dist.length).replace(/index\.html$/, '');
    it(`${path}: no loaded words in our copy`, () => {
      expect(loaded(ourWords(readFileSync(f, 'utf8')))).toEqual([]);
    });
  }

  it('the Gap step is "Support for parking funds", in the City\'s terms', () => {
    const gap = readFileSync(join(dist, 'us/ca/berkeley/gap/index.html'), 'utf8');
    expect(ourWords(gap)).toContain('Support for parking funds');
  });

  it('where the Gap page names cuts, it names the revenue side in the same sentence or the next', () => {
    const gap = readFileSync(join(dist, 'us/ca/berkeley/gap/index.html'), 'utf8');
    const text = unescape(gap.replace(/<(script|style|dialog)[\s\S]*?<\/\1>/g, ' ').replace(/<span class="tip"[\s\S]*?<\/span>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    // Sentences of prose: the plan heading and the step notes (chart labels and figure rows aren't sentences).
    const prose = text.split(/(?<=[.?!])\s+/).filter((s) => /^(The|It|Its|In|Each|Here)\b/.test(s));
    const hits = prose.map((s, i) => ({ s, next: prose[i + 1] ?? '' })).filter(({ s }) => /\bcuts?\b/i.test(s));
    expect(hits.length).toBeGreaterThan(2);
    for (const { s, next } of hits) expect(`${s} ${next}`, s).toMatch(/revenue|sales tax|sales-tax/i);
  });
});
