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

  test('the $100 chart is first; a tap at 390px highlights a group and shows its dollars, with line items a tap away (#35)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(PAGE);
    const grid = page.getByRole('group', { name: /FY2026 General Fund revenue: one square per dollar/ });
    await expect(grid.locator('.sq')).toHaveCount(100);
    expect((await grid.boundingBox())!.y).toBeLessThan(844);
    await page.locator('.sq[data-item="property-tax"]').first().tap();
    const sheet = page.locator('[data-tip]');
    await expect(sheet.locator('[data-panel="property-tax"]')).toBeVisible();
    await expect(sheet.locator('[data-panel="property-tax"]')).toContainText('Property tax$33 of every $100');
    await expect(page.locator('.sq.dim')).toHaveCount(100 - 33);
    await sheet.getByRole('link', { name: 'Line items' }).tap();
    const group = page.locator('#rev-property-tax details');
    await expect(group).toHaveAttribute('open', '');
    for (const name of ['Secured Property Tax', 'Supplemental Taxes', 'Unsecured Property Taxes']) await expect(group).toContainText(name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await ctx.close();
  });

  test('the chart works by keyboard at 390px: Tab in, arrows move, Enter pins, Escape closes (#35)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(PAGE);
    await page.locator('.sq').first().focus();
    await expect(page.locator('.sq:focus')).toHaveAttribute('data-item', 'property-tax');
    // Columns fill top to bottom: property tax has 33 squares, so square 34 (column 4, row 4) is the next group.
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await expect(page.locator('.sq:focus')).toHaveAttribute('data-item', 'transfer-tax');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-panel="transfer-tax"]')).toBeVisible();
    await expect(page.locator('[data-panel="transfer-tax"]')).toContainText('$10 of every $100');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-tip]')).toBeHidden();
    await ctx.close();
  });

  test('pace bars: behind, on pace, ahead', async ({ page }) => {
    await page.goto(PAGE);
    const pace = (name: string) => page.locator('.line', { hasText: name }).first().locator('.l-pace');
    await expect(pace('Business License Tax')).toHaveClass(/pace--behind/);
    // Behind is neutral gray, never gold (gold means one-time money).
    await expect(pace('Business License Tax').locator('.fill')).toHaveCSS('background-color', 'rgb(140, 144, 150)');
    await expect(pace('Secured Property Tax')).toHaveClass(/pace--on-pace/);
    await expect(pace('Transfers')).toHaveClass(/pace--ahead/);
  });

  test('the overview now links to this page', async ({ page }) => {
    await page.goto('/us/ca/berkeley/');
    await expect(page.getByRole('link', { name: 'See where every $100 comes from' })).toHaveAttribute('href', PAGE);
    await expect(page.locator('nav.desktop').getByRole('link', { name: 'Revenue' })).toHaveAttribute('href', PAGE);
  });
});
