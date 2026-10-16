/**
 * A strict, read-only view of an .xlsx workbook. Every accessor throws with
 * the tab and cell address when a cell isn't what the extractor expects, so
 * a reshuffled workbook fails the build loudly instead of shipping a
 * misread number.
 */
import ExcelJS from 'exceljs';

type CellValue = ExcelJS.CellValue;

export interface Tab {
  name: string;
  /** A literal number typed into the cell. Formulas are rejected: inputs must be inputs. */
  input(address: string): number;
  /** A number, or a formula's cached result. Throws if the workbook never computed it. */
  value(address: string): number;
  /** The cached result of a formula cell, or undefined if the workbook didn't store one. */
  cached(address: string): number | undefined;
  text(address: string): string;
  /** Text, or '' for an empty cell. */
  optionalText(address: string): string;
  hyperlink(address: string): string;
  /** Asserts a row reads exactly as given, starting at column A. */
  expectRow(row: number, labels: string[]): void;
  /** Asserts a cell's text starts with the given prefix. */
  expectText(address: string, prefix: string): void;
}

function fail(tab: string, address: string, message: string): never {
  throw new Error(`${tab}!${address}: ${message}`);
}

function isFormula(v: CellValue): v is ExcelJS.CellFormulaValue | ExcelJS.CellSharedFormulaValue {
  return typeof v === 'object' && v !== null && ('formula' in v || 'sharedFormula' in v);
}

function asText(v: CellValue): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null) {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('hyperlink' in v && typeof v.text === 'string') return v.text;
  }
  return undefined;
}

export async function openWorkbook(input: string | Buffer | ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  if (typeof input === 'string') await wb.xlsx.readFile(input);
  else await wb.xlsx.load(input as ArrayBuffer);

  return {
    tabNames: () => wb.worksheets.map((ws) => ws.name),
    tab(name: string): Tab {
      const ws = wb.getWorksheet(name);
      if (!ws) throw new Error(`workbook has no tab "${name}"`);
      const raw = (address: string) => ws.getCell(address).value;

      const tab: Tab = {
        name,
        input(address) {
          const v = raw(address);
          if (typeof v === 'number') return v;
          if (isFormula(v)) fail(name, address, `expected a typed-in number, found formula =${'formula' in v ? v.formula : v.sharedFormula}`);
          fail(name, address, `expected a number, found ${JSON.stringify(v)}`);
        },
        value(address) {
          const v = raw(address);
          if (typeof v === 'number') return v;
          const cached = tab.cached(address);
          if (cached === undefined) fail(name, address, `expected a number, found ${JSON.stringify(v)}`);
          return cached;
        },
        cached(address) {
          const v = raw(address);
          if (!isFormula(v)) return undefined;
          return typeof v.result === 'number' ? v.result : undefined;
        },
        text(address) {
          const t = asText(raw(address))?.trim();
          if (!t) fail(name, address, `expected text, found ${JSON.stringify(raw(address))}`);
          return t;
        },
        optionalText(address) {
          return asText(raw(address))?.trim() ?? '';
        },
        hyperlink(address) {
          const v = raw(address);
          const url = typeof v === 'object' && v !== null && 'hyperlink' in v ? v.hyperlink : asText(v);
          if (!url || !/^https?:\/\//.test(url)) fail(name, address, `expected a URL, found ${JSON.stringify(v)}`);
          return url;
        },
        expectRow(row, labels) {
          labels.forEach((label, i) => {
            const address = `${String.fromCharCode(65 + i)}${row}`;
            const actual = tab.optionalText(address);
            if (actual !== label) fail(name, address, `expected header "${label}", found "${actual}"`);
          });
        },
        expectText(address, prefix) {
          const actual = tab.optionalText(address);
          if (!actual.startsWith(prefix)) fail(name, address, `expected text starting "${prefix}", found "${actual}"`);
        },
      };
      return tab;
    },
  };
}

export type Workbook = Awaited<ReturnType<typeof openWorkbook>>;
