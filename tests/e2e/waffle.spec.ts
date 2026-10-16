import { expect, test } from '@playwright/test';

const PAGE = '/us/ca/berkeley/';
const dimmed = (page: import('@playwright/test').Page) => page.locator('.sq.dim').count();

test.describe('the $100 waffle (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('hovering a square highlights its department and shows the tooltip', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('.sq[data-dept="police"]').first().hover();
    const tip = page.locator('[data-tip]');
    await expect(tip).toBeVisible();
    await expect(tip.locator('[data-panel="police"]')).toContainText('$37.42 of every $100');
    await expect(tip.locator('[data-panel="police"]')).toContainText('$106.2M FY27 baseline');
    expect(await dimmed(page)).toBe(63);
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
    expect(await dimmed(page)).toBe(0);
  });

  test('the grid is a single Tab stop', async ({ page }) => {
    await page.goto(PAGE);
    expect(await page.locator('.sq[tabindex="0"]').count()).toBe(1);
    // Tab in from the chip just before the grid, then Tab once more: out of the grid.
    await page.locator('.hero-copy [data-source-chip]').last().focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('.sq').first()).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.classList.contains('sq'))).toBe(false);
  });

  test('arrow keys move square by square', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('.sq').first().focus();
    await expect(page.locator('[data-panel="police"]')).toBeVisible();
    // Police fills the first 3 columns and 7 of the 4th: column 4, row 8 is the next department.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
    await expect(page.locator('.sq:focus')).toHaveAttribute('data-index', '37');
    await expect(page.locator('.sq:focus')).toHaveAttribute('data-dept', 'fire');
    await expect(page.locator('[data-panel="fire"]')).toBeVisible();
    expect(await page.locator('.sq[tabindex="0"]').count()).toBe(1);
    // Tab leaves the grid in one step.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.grid'))).toBe(false);
  });

  test('Enter pins the tooltip, and its chip opens the receipt; Esc unpins', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('.sq[data-dept="fire"]').first().focus();
    await page.keyboard.press('Enter');
    const tip = page.locator('[data-tip]');
    await expect(tip).toHaveClass(/pinned/);
    await tip.locator('[data-panel="fire"] [data-source-chip="S1"]').click();
    const d = page.locator('dialog[data-receipt-dialog]');
    await expect(d.locator('.figure')).toHaveText('$55,650,689');
    await expect(d.locator('.facts')).toContainText('Dept Reductions FY27, row 12');
    await page.keyboard.press('Escape');
    await expect(d).toBeHidden();
    await expect(tip).toHaveClass(/pinned/);
    // Park the mouse away from the grid, as a person would before reaching for the keyboard.
    await page.mouse.move(5, 5);
    await page.locator('.sq[data-dept="fire"]').first().focus();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
  });

  test('"Show as a table" lists every department', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByText('Show as a table').click();
    await expect(page.locator('.as-table tbody tr')).toHaveCount(16);
    await expect(page.locator('.as-table tbody tr').first()).toContainText('Police');
  });
});

test.describe('the $100 waffle (phone)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tap opens a bottom sheet with a link to department details', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('.sq[data-dept="hhcs"]').first().tap();
    const tip = page.locator('[data-tip]');
    await expect(tip).toHaveClass(/sheet/);
    const box = (await tip.boundingBox())!;
    expect(box.x).toBe(0);
    expect(Math.round(box.width)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    await expect(tip.locator('[data-panel="hhcs"]')).toContainText('$13.23 of every $100');
    await expect(tip.getByRole('link', { name: 'Department details' })).toHaveAttribute('href', '/us/ca/berkeley/departments/#hhcs');
    await tip.getByRole('button', { name: 'Close' }).tap();
    await expect(tip).toBeHidden();
  });
});
