import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ballotFileFor, ballotPage, ballotState, checkBallotFile, type BallotFile } from '../../src/lib/ballot';
import { budgetFor } from '../../src/lib/budget';
import { cities } from '../../src/lib/cities';
import { shortNames } from '../../src/lib/departments';

const city = cities[0];
const budget = budgetFor(city)!;
const file = ballotFileFor(city.path);
const p = ballotPage(budget, file, shortNames(city.path, budget));
const [passes, fails] = p.scenarios;
const withStatus = (status: 'pending' | 'passed' | 'failed'): BallotFile => ({ ...file, measures: { ...file.measures, salesTax: { status, yesShare: null } } });

describe('ballot page figures', () => {
  it('passes 105 positions (85 vacant, 20 filled), FTE 1,455; fails 138 (100 / 38), FTE 1,422', () => {
    expect(passes.outcome).toBe('passes');
    expect(passes.positions).toMatchObject({ total: 105, vacant: 85, filled: 20 });
    expect(Math.round(passes.workforce.after)).toBe(1455);
    expect(fails.positions).toMatchObject({ total: 138, vacant: 100, filled: 38 });
    expect(Math.round(fails.workforce.after)).toBe(1422);
    expect(Math.round(passes.workforce.before)).toBe(1609);
  });

  it('department cuts: $19.8M (7.0%) if it passes, $29.3M (10.3%) if it fails', () => {
    expect((passes.cuts.value / 1e6).toFixed(1)).toBe('19.8');
    expect((passes.cuts.pct * 100).toFixed(1)).toBe('7.0');
    expect((fails.cuts.value / 1e6).toFixed(1)).toBe('29.3');
    expect((fails.cuts.pct * 100).toFixed(1)).toBe('10.3');
  });

  it('the measures: 0.5%, ~$9.0-9.4M/yr, to 10.75%, simple majority; $300M bond, 2/3, $1.65-2B backlog', () => {
    expect(p.salesTax.fact).toMatchObject({ rate: 0.005, revenueLow: 9_000_000, revenueHigh: 9_400_000, newRate: 0.1075, threshold: 'simple majority' });
    expect(p.bond.fact).toMatchObject({ amount: 300_000_000, threshold: '2/3', repaidBy: 'property tax' });
    expect(p.bond.backlog.ref).toMatchObject({ low: 1_650_000_000, high: 2_000_000_000 });
  });

  it('both outcomes are built the same way: same fields, same pictogram scale', () => {
    const shape = (o: unknown): unknown =>
      Array.isArray(o) ? 'array' : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'ref' ? 'ref' : shape(v)])) : typeof o;
    expect(shape(passes)).toEqual(shape(fails));
    expect(p.pictogramSlots).toBe(40);
  });

  it('the footnote names the departments the bridge softens, biggest first', () => {
    expect(p.softened).toEqual(['Police', 'Fire', 'Parks, Rec & Waterfront']);
  });

  it('results are a data change: pending, passed and failed', () => {
    expect(ballotState(withStatus('pending'))).toMatchObject({ decided: false, result: null, eyebrow: 'November 3, 2026', heading: 'On your ballot, and what it changes' });
    expect(ballotState(withStatus('passed'))).toMatchObject({ decided: true, result: 'passes', heading: expect.stringMatching(/^The sales tax passed\./) });
    expect(ballotState(withStatus('failed'))).toMatchObject({ decided: true, result: 'fails', heading: expect.stringMatching(/^The sales tax failed\./) });
  });

  it('rejects a ballot.json it cannot render honestly', () => {
    expect(() => checkBallotFile({ ...file, measures: { ...file.measures, salesTax: { status: 'won' as never, yesShare: null } } }, budget)).toThrow(/status/);
    expect(() => checkBallotFile({ ...file, fireStation: { ...file.fireStation, fails: { ...file.fireStation.fails, sources: ['S99'] } } }, budget)).toThrow(/S99/);
  });

  it('has no figure typed into the page, and no advocacy', () => {
    const src = readFileSync(join(import.meta.dirname, '../../src/pages/[country]/[state]/[city]/ballot.astro'), 'utf8');
    for (const lit of ['105', '138', '1,455', '1,422', '19.8', '29.3', '10.75', '300M', '9.4', '1.65', 'Police']) expect(src, lit).not.toContain(lit);
    const words = /vote (yes|no)|\bsupport\b|\boppose\b|devastat|catastroph|disastr|crucial|vital|must pass|reckless|\bsave\b/i;
    expect(src.replace(/<style>[\s\S]*<\/style>/, '')).not.toMatch(words);
    expect(JSON.stringify(file.fireStation.passes.text + file.fireStation.fails.text)).not.toMatch(words);
  });
});
