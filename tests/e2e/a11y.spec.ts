import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CITY_PAGES } from '../../src/lib/city-pages';

const dataDir = join(import.meta.dirname, '../../data/cities');
const cityPaths = readdirSync(dataDir).flatMap((country) =>
  readdirSync(join(dataDir, country)).flatMap((state) => readdirSync(join(dataDir, country, state)).map((city) => `/${country}/${state}/${city}/`)),
);
const ROUTES = ['/', ...cityPaths.flatMap((c) => [c, ...CITY_PAGES.map((p) => `${c}${p.slug}/`)]), '/test/receipts/', '/us/ca/nowhere/'];

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

for (const width of [390, 1440]) {
  test.describe(`WCAG 2.1 AA at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const route of ROUTES) {
      test(route, async ({ page }) => {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        expect(await violations(page)).toEqual([]);
      });
    }

    test('an open receipt', async ({ page }) => {
      await page.goto('/test/receipts/');
      await page.locator('[data-figure="liability"] [data-source-chip="S17"]').click();
      await expect(page.locator('dialog[data-receipt-dialog]')).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}

test('the open mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/us/ca/berkeley/');
  await page.locator('summary[aria-label="Menu"]').click();
  expect(await violations(page)).toEqual([]);
});
