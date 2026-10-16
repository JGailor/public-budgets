import { expect, test, type Page } from '@playwright/test';

const PAGE = '/us/ca/berkeley/revenue/';
const visibleOrder = (page: Page) =>
  page.locator('.line').evaluateAll((rows) =>
    rows
      .filter((r) => (r as HTMLElement).checkVisibility())
      .sort((a, b) => Number(getComputedStyle(a).order) - Number(getComputedStyle(b).order))
      .map((r) => r.querySelector('.l-name')!.textContent!.trim()),
  );

test.describe('revenue page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('14 rows biggest-first, then "Show all 24"', async ({ page }) => {
    await page.goto(PAGE);
    let rows = await visibleOrder(page);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toBe('Secured Property Tax');
    await page.getByText('Show all 24 line items').click();
    rows = await visibleOrder(page);
    expect(rows).toHaveLength(24);
    await page.getByText('Show fewer').click();
    expect(await visibleOrder(page)).toHaveLength(14);
  });

  test('sorts: fastest growing, A-Z', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('label[for="sort-fastest"]').click();
    expect((await visibleOrder(page))[0]).toBe('Transfers');
    await page.locator('label[for="sort-az"]').click();
    const az = await visibleOrder(page);
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
  });

  test('a mix block lists its line items on focus', async ({ page }) => {
    await page.goto(PAGE);
    const block = page.getByRole('button', { name: /^Property tax: 33%/ });
    await block.focus();
    const tip = block.getByRole('tooltip');
    await expect(tip).toBeVisible();
    for (const name of ['Secured Property Tax', 'Supplemental Taxes', 'Unsecured Property Taxes']) await expect(tip).toContainText(name);
    const box = (await tip.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(1440);
  });

  test('the last block\'s tooltip stays on screen', async ({ page }) => {
    await page.goto(PAGE);
    const last = page.locator('.block').last();
    await last.focus();
    const box = (await last.getByRole('tooltip').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1440);
  });

  test('pace bars: behind, on pace, ahead', async ({ page }) => {
    await page.goto(PAGE);
    const pace = (name: string) => page.locator('.line', { hasText: name }).first().locator('.l-pace');
    await expect(pace('Business License Tax')).toHaveClass(/pace--behind/);
    await expect(pace('Secured Property Tax')).toHaveClass(/pace--on-pace/);
    await expect(pace('Transfers')).toHaveClass(/pace--ahead/);
  });

  test('the overview now links to this page', async ({ page }) => {
    await page.goto('/us/ca/berkeley/');
    await expect(page.getByRole('link', { name: 'Explore revenue' })).toHaveAttribute('href', PAGE);
    await expect(page.locator('nav.desktop').getByRole('link', { name: 'Revenue' })).toHaveAttribute('href', PAGE);
  });
});
