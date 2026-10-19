/**
 * #38: cited sentences in our words (documents.json notes) rest on quotes the build
 * finds on their PDF pages. Checked here against the real files, with the build's checkQuote.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkQuote, type Excerpts } from '../../src/data/documents';
import type { StepNote } from '../../src/data/types';

const dir = join(import.meta.dirname, '../../data/cities/us/ca/berkeley');
const notes: Record<string, StepNote> = JSON.parse(readFileSync(join(dir, 'documents.json'), 'utf8')).notes;
const excerpts = Object.fromEntries(
  readdirSync(join(dir, 'source/excerpts')).map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(dir, 'source/excerpts', f), 'utf8'))]),
) as Excerpts;

describe('documents.json notes (#38)', () => {
  it('has the two card 2 sentences and the known gap', () => {
    expect(Object.keys(notes)).toEqual(['costDrivers', 'payAndBenefits', 'auditorRevenues']);
  });

  for (const [key, n] of Object.entries(notes)) {
    it(`${key}: every quote is on its cited page`, () => {
      for (const ref of n.cites) expect(() => checkQuote(ref, excerpts, key)).not.toThrow();
    });
  }

  it('a quote that is not on the page is rejected (the check is live)', () => {
    const ref = { ...notes.costDrivers.cites[0], quote: 'Rising costs in personnel, pension, and parking' };
    expect(() => checkQuote(ref, excerpts, 'costDrivers')).toThrow(/is not on S1 page 4/);
    const moved = { ...notes.auditorRevenues.cites[0], page: 13 };
    expect(() => checkQuote(moved, excerpts, 'auditorRevenues')).toThrow(/is not on S8 page 13/);
  });

  it("card 2 keeps the City's drivers in the City's order, with the revenue side in the same sentence, and no ranking or dollar shares", () => {
    const t = notes.costDrivers.text;
    const order = ['personnel', 'pension', 'health-care', 'inflation', 'one-time money', 'state and federal revenue'].map((w) => t.indexOf(w));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(t.split(/(?<=\.)\s/)).toHaveLength(1);
    expect(t).not.toMatch(/\$|\d+%|\b(most|biggest|largest|main|primary|chiefly|mainly)\b/i);
  });
});
