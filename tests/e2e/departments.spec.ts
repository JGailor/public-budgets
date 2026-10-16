import { expect, test, type Page } from '@playwright/test';

const PAGE = '/us/ca/berkeley/departments/';
const row = (page: Page, id: string) => page.locator(`.row[data-dept="${id}"]`);
const rowOrder = (page: Page) =>
  page.locator('.row').evaluateAll((rows) => rows.sort((a, b) => Number(getComputedStyle(a).order) - Number(getComputedStyle(b).order)).map((r) => r.getAttribute('data-dept')));

test.describe('departments (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('defaults: FY2027, tax passes, biggest budget first, Police in the panel', async ({ page }) => {
    await page.goto(PAGE);
    expect((await rowOrder(page))[0]).toBe('police');
    await expect(row(page, 'police').locator('.yr--fy2027 .tax--passes .net-v')).toHaveText('$5.2M');
    await expect(page.locator('.panel[data-dept="police"]')).toBeVisible();
    await expect(page.locator('.panel:visible')).toHaveCount(1);
  });

  test('"Fails" removes the gold and shows the full cut; the URL follows', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('label[for="tax-fails"]').first().click();
    await expect(row(page, 'police').locator('.yr--fy2027 .tax--fails .net-v')).toHaveText('$10.6M');
    await expect(row(page, 'police').locator('.yr--fy2027 .tax--passes')).toBeHidden();
    await expect(row(page, 'police').locator('.yr--fy2027 .seg-soft')).not.toHaveCSS('background-color', 'rgb(217, 154, 30)');
    expect(new URL(page.url()).searchParams.get('tax')).toBe('fails');
  });

  test('sort by deepest cut, and FY2028, from the URL', async ({ page }) => {
    await page.goto(`${PAGE}?year=2028&sort=cut`);
    await expect(page.locator('#year-fy2028')).toBeChecked();
    await expect(page.locator('#sort-cut')).toBeChecked();
    const order = await rowOrder(page);
    // A department with no cut shows "none" (no percentage): count it as 0%.
    const byId = await page.locator('.row').evaluateAll((rows) =>
      Object.fromEntries(rows.map((r) => [r.getAttribute('data-dept'), Number(r.querySelector('.yr--fy2028 .tax--passes .net-p')?.textContent?.replace('%', '') ?? 0)])),
    );
    const nums = order.map((id) => byId[id!]);
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
    await expect(page.locator('.list-head')).toContainText('FY28 baseline');
  });

  test('clicking a row shows it in the panel without jumping the page', async ({ page }) => {
    await page.goto(PAGE);
    await row(page, 'fire').scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await row(page, 'fire').locator('a').click();
    await expect(page.locator('.panel[data-dept="fire"]')).toBeVisible();
    await expect(page.locator('.panel:visible')).toHaveCount(1);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    expect(new URL(page.url()).hash).toBe('#fire');
  });

  test('#hhcs (the overview\'s "Department details" link) opens that department', async ({ page }) => {
    await page.goto(`${PAGE}#hhcs`);
    await expect(page.locator('.panel[data-dept="hhcs"]')).toBeVisible();
    await expect(page.locator('.panel[data-dept="hhcs"] .per100').first()).toContainText('$13.23 of every $100');
  });
});

test.describe('departments (phone)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a row opens a full-screen detail; "All departments" returns to the row', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('.panel:visible')).toHaveCount(0);
    await row(page, 'police').locator('a').click();
    const panel = page.locator('.panel[data-dept="police"]');
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect([box.x, box.width]).toEqual([0, 390]);
    await panel.locator('.yr--fy2027 label[for="tax-fails"]').click();
    await expect(panel.locator('.yr--fy2027 .tax--fails dd.num').first()).toHaveText('$10.6M (10.0%)');
    await panel.getByRole('link', { name: '‹ All departments' }).click();
    await expect(panel).toBeHidden();
    await expect(row(page, 'police').locator('a')).toBeFocused();
  });
});

test.describe('without JavaScript', () => {
  test.use({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });

  test('the toggles and #id panels still work', async ({ page }) => {
    await page.goto(`${PAGE}#fire`);
    await expect(page.locator('.panel[data-dept="fire"]')).toBeVisible();
    await page.locator('label[for="tax-fails"]').first().click();
    await expect(row(page, 'police').locator('.yr--fy2027 .tax--fails .net-v')).toHaveText('$10.6M');
    await page.locator('label[for="sort-cut"]').click();
    expect((await rowOrder(page))[0]).not.toBe('police');
  });
});
