/**
 * Figures for a city's Capital page: the two-year capital program against the
 * repair backlog, and a squarified treemap of where the program's money comes
 * from. Legend groups are editorial, in data/cities/{city}/capital-groups.json.
 */
import type { CapitalLine, CityBudget } from '../data/types.ts';
import { shortMoney } from './format.ts';
import type { Figure } from './receipts.ts';

export interface CapitalGroupDef {
  id: string;
  name: string;
  color: string;
  categories: string[];
  merge?: boolean;
  blockName?: string;
}
export interface CapitalGroupsFile {
  otherBelowShare: number;
  groups: CapitalGroupDef[];
}

const files = import.meta.glob<CapitalGroupsFile>('/data/cities/*/*/*/capital-groups.json', { eager: true, import: 'default' });

export function capitalGroupsFor(cityPath: string): CapitalGroupsFile {
  const f = files[`/data/cities${cityPath}capital-groups.json`];
  if (!f) throw new Error(`${cityPath} has no capital-groups.json`);
  return f;
}

export const OTHER_COLOR = '#9a9ea5';

/* ---------- Squarified treemap (Bruls, Huizing & van Wijk) ---------- */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Lays values (sorted biggest first) into a w×h box; returns one rect per value, same order. */
export function squarify(values: number[], w: number, h: number): Rect[] {
  const total = values.reduce((a, v) => a + v, 0);
  const scale = (w * h) / total;
  const areas = values.map((v) => v * scale);
  const out: Rect[] = [];
  let box = { x: 0, y: 0, w, h };
  let row: number[] = [];
  const worst = (r: number[], side: number) => {
    const s = r.reduce((a, v) => a + v, 0);
    const max = Math.max(...r);
    const min = Math.min(...r);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const layRow = (r: number[]) => {
    const s = r.reduce((a, v) => a + v, 0);
    if (box.w >= box.h) {
      // Column on the left, full height.
      const cw = s / box.h;
      let y = box.y;
      for (const a of r) {
        const rh = a / cw;
        out.push({ x: box.x, y, w: cw, h: rh });
        y += rh;
      }
      box = { x: box.x + cw, y: box.y, w: box.w - cw, h: box.h };
    } else {
      // Row along the top, full width.
      const rh = s / box.w;
      let x = box.x;
      for (const a of r) {
        const cw = a / rh;
        out.push({ x, y: box.y, w: cw, h: rh });
        x += cw;
      }
      box = { x: box.x, y: box.y + rh, w: box.w, h: box.h - rh };
    }
  };
  for (const a of areas) {
    const side = Math.min(box.w, box.h);
    if (row.length === 0 || worst([...row, a], side) <= worst(row, side)) row.push(a);
    else {
      layRow(row);
      row = [a];
    }
  }
  if (row.length) layRow(row);
  return out;
}

/* ---------- Contrast: white or ink label on a block color ---------- */

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
export const INK = '#16191d';
/** White if it reaches 4.5:1 on the color, else ink. */
export const labelColor = (bg: string) => (contrast('#ffffff', bg) >= 4.5 ? '#ffffff' : INK);

/* ---------- The page ---------- */

/**
 * Box shapes the treemap is laid out for, in px, at the SMALLEST size each is
 * shown at (labels must fit there): wide from 64rem (a ~960px box), tall below
 * (a 358px box at 390px; capped at 40rem wide in the page CSS).
 */
export const LAYOUTS = { wide: { w: 960, h: 416 }, tall: { w: 358, h: 636 } } as const;
type LayoutKey = keyof typeof LAYOUTS;
export type Fit = 'full' | 'small' | 'none';
/** Label sizes per layout, matching the page CSS: font px and padding px for full and small labels. */
const TYPE = { wide: { full: [15, 12], small: [12, 8] }, tall: { full: [13, 8], small: [12, 8] } } as const;
/** Rough width of bold sans text: 0.62em per character, generous for this font. */
const textW = (s: string, px: number) => s.length * px * 0.62;
/** Does "name / $value" fit in r at this size? Greedy word wrap, 1.25 line height, 2px border. */
const fitsAt = (name: string, value: string, r: Rect, px: number, pad: number) => {
  const inner = r.w - 2 * pad - 4;
  const words = name.split(' ');
  if (Math.max(...words.map((w) => textW(w, px)), textW(value, px)) > inner) return false;
  let lines = 1;
  let line = 0;
  for (const w of words) {
    const add = textW((line ? ' ' : '') + w, px);
    if (line + add > inner) {
      lines += 1;
      line = textW(w, px);
    } else line += add;
  }
  return (lines + 1) * px * 1.25 + 2 * pad + 4 + 2 <= r.h;
};
const fit = (k: LayoutKey, name: string, value: string, r: Rect): Fit =>
  fitsAt(name, value, r, TYPE[k].full[0], TYPE[k].full[1]) ? 'full' : fitsAt(name, value, r, TYPE[k].small[0], TYPE[k].small[1]) ? 'small' : 'none';

export interface Block {
  id: string;
  name: string;
  value: number;
  color: string;
  text: string;
  group: string | null;
  lines: CapitalLine[];
  figure: Figure;
  rect: Record<LayoutKey, Rect>;
  fit: Record<LayoutKey, Fit>;
}

export function capitalPage(b: CityBudget, file: CapitalGroupsFile) {
  const c = b.capitalProgram;
  const total = c.total.total;
  const sum = c.lines.reduce((a, l) => a + l.total, 0);
  if (sum !== total) throw new Error(`capital lines sum to ${sum}, but the TOTAL row says ${total}`);

  const groupOf = new Map<string, CapitalGroupDef>();
  for (const g of file.groups)
    for (const cat of g.categories) {
      if (groupOf.has(cat)) throw new Error(`capital-groups.json: "${cat}" is in both ${groupOf.get(cat)!.id} and ${g.id}`);
      groupOf.set(cat, g);
    }
  const unmapped = [...new Set(c.lines.map((l) => l.category))].filter((cat) => !groupOf.has(cat));
  if (unmapped.length) throw new Error(`capital-groups.json: no group for ${unmapped.join(', ')}`);

  const fig = (value: number, label: string, lines: CapitalLine[], ref: CapitalLine = lines[0]): Figure => ({
    value,
    label,
    ref,
    ...(lines.length > 1 ? { parts: lines.map((l) => ({ label: l.name, value: l.total })) } : {}),
  });

  type Raw = Omit<Block, 'rect' | 'fit'>;
  const raws: Raw[] = [];
  const small: CapitalLine[] = [];
  for (const g of file.groups.filter((x) => x.merge)) {
    const lines = c.lines.filter((l) => g.categories.includes(l.category));
    const value = lines.reduce((a, l) => a + l.total, 0);
    const name = `${g.blockName ?? g.name} (${lines.length} programs)`;
    raws.push({ id: g.id, name, value, color: g.color, text: labelColor(g.color), group: g.id, lines, figure: fig(value, `${name}, FY2027 + FY2028 capital funding`, lines) });
  }
  for (const l of c.lines) {
    const g = groupOf.get(l.category)!;
    if (g.merge) continue;
    if (l.total / total < file.otherBelowShare) {
      small.push(l);
      continue;
    }
    raws.push({ id: l.name, name: l.name, value: l.total, color: g.color, text: labelColor(g.color), group: g.id, lines: [l], figure: fig(l.total, `${l.name}, FY2027 + FY2028 capital funding`, [l]) });
  }
  raws.sort((x, y) => y.value - x.value);
  if (small.length) {
    const value = small.reduce((a, l) => a + l.total, 0);
    const name = `Other sources (${small.length})`;
    small.sort((x, y) => y.total - x.total);
    // Other always goes last (bottom-right), whatever its size.
    raws.push({ id: 'other', name, value, color: OTHER_COLOR, text: labelColor(OTHER_COLOR), group: null, lines: small, figure: fig(value, `${name}, FY2027 + FY2028 capital funding`, small) });
  }
  const pctRect = (r: Rect, L: { w: number; h: number }): Rect => ({ x: (r.x / L.w) * 100, y: (r.y / L.h) * 100, w: (r.w / L.w) * 100, h: (r.h / L.h) * 100 });
  const laid = Object.fromEntries((Object.keys(LAYOUTS) as LayoutKey[]).map((k) => [k, squarify(raws.map((r) => r.value), LAYOUTS[k].w, LAYOUTS[k].h)])) as Record<LayoutKey, Rect[]>;
  const blocks: Block[] = raws.map((r, i) => ({
    ...r,
    rect: { wide: pctRect(laid.wide[i], LAYOUTS.wide), tall: pctRect(laid.tall[i], LAYOUTS.tall) },
    fit: { wide: fit('wide', r.name, shortMoney(r.value), laid.wide[i]), tall: fit('tall', r.name, shortMoney(r.value), laid.tall[i]) },
  }));

  const visibleGroups = new Set(blocks.map((x) => x.group));
  const legend = file.groups.filter((g) => visibleGroups.has(g.id)).map((g) => ({ id: g.id, name: g.name, color: g.color }));
  const gf = blocks.find((x) => file.groups.find((g) => g.id === x.id)?.merge)!;

  const bl = b.citedFacts.backlog;
  const gap = b.deficitBridge.steps.find((s) => s.key === 'final-gap')!;
  return {
    total: { value: total, fy2027: c.total.fy2027, fy2028: c.total.fy2028, figure: { value: total, label: 'Capital program, FY2027 + FY2028, all funding sources', ref: c.total, tone: 'neutral' } satisfies Figure },
    backlog: {
      fact: bl,
      figure: { value: bl.low, label: 'Unfunded infrastructure and deferred maintenance, low end of the city estimate', ref: bl, tone: 'neutral' } satisfies Figure,
    },
    /** Scale: one axis from 0 to the backlog's high estimate. */
    scale: { program: total / bl.high, low: bl.low / bl.high },
    blocks,
    legend,
    generalFund: gf,
    gap: { value: Math.abs(gap.fy2027), figure: { value: gap.fy2027, label: 'FY2027 General Fund gap, after adjustments', ref: gap } satisfies Figure },
  };
}
