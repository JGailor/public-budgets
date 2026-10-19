/**
 * What a source trigger needs: the receipt it opens and the names of the documents
 * behind it. Shared by SourceChip (a quiet ⓘ after prose) and Sourced (the figure
 * itself as the button, #29).
 */
import type { SourceId } from '../data/types.ts';
import { budgetFor } from './budget.ts';
import type { City } from './cities.ts';
import { figureReceipt, sourceReceipt, sourcesById, type AlsoCite, type At, type Figure, type Receipt } from './receipts.ts';

export type ReceiptTarget = { figure: Figure; source?: never; at?: never; also?: never } | { source: SourceId; at?: At; also?: AlsoCite[]; figure?: never };

export function receiptTarget(city: City, target: ReceiptTarget, pageUrl: URL): { receipt: Receipt; names: string[] } {
  const budget = budgetFor(city);
  if (!budget) throw new Error(`receiptTarget: ${city.path} has no budget data`);
  const receipt = target.figure ? figureReceipt(budget, city, target.figure, pageUrl) : sourceReceipt(budget, target.source!, pageUrl, target.at, target.also);
  const views = sourcesById(budget);
  // Document titles, without the S-number: the visible text is now the figure or an ⓘ, not a chip label.
  return { receipt, names: receipt.sources.map((id) => views.get(id)!.title) };
}

/** "FY27-FY28 Budget Balancing Plan", or "A and B", or "A, B and C". */
export function sourceList(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
