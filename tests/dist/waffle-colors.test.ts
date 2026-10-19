/**
 * The colour rules (tokens.css) hold on every $100 chart (#35): red means only
 * money short and gold only one-time money, so no square may read as either.
 * A square's colour fails if it is saturated (HSL s > 45%) and its hue is within
 * 20° of red or gold; the charts' muted sands and browns pass, the tokens fail.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const dist = (p: string) => readFileSync(join(root, 'dist', p, 'index.html'), 'utf8');
const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const token = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];

function hsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s };
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const reserved = { red: hsl(token('red')), gold: hsl(token('gold')) };
const readsAs = (hex: string) =>
  Object.entries(reserved).find(([, c]) => hsl(hex).s > 0.45 && hueGap(hsl(hex).h, c.h) <= 20)?.[0];

describe('$100 chart colours', () => {
  it('the check catches the reserved colours themselves', () => {
    expect(readsAs(token('red'))).toBe('red');
    expect(readsAs(token('gold'))).toBe('gold');
    expect(readsAs(token('red-text'))).toBe('red');
  });

  for (const [page, path] of [
    ['Revenue', 'us/ca/berkeley/revenue'],
    ['overview', 'us/ca/berkeley'],
    ['homepage', ''],
  ]) {
    it(`no square on the ${page} chart reads as red or gold`, () => {
      const colors = [...new Set([...dist(path).matchAll(/class="sq"[^>]*style="background:(#[0-9a-fA-F]{6})/g)].map((m) => m[1]))];
      expect(colors.length).toBeGreaterThan(3);
      for (const c of colors) expect(readsAs(c), c).toBeUndefined();
    });
  }
});
