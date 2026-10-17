import { expect, test } from '@playwright/test';

const PAGE = '/us/ca/berkeley/gap/';

test.describe('the Gap page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('FY2027 by default; the toggle switches to FY2028', async ({ page }) => {
    await page.goto(PAGE);
    const fy27 = page.locator('[data-year="fy2027"]');
    const fy28 = page.locator('[data-year="fy2028"]');
    await expect(fy27).toBeVisible();
    await expect(fy28).toBeHidden();
    await expect(fy27.locator('.step--final .value')).toHaveText('−$29.2M');
    await page.locator('label[for="year-fy2028"]').click();
    await expect(fy27).toBeHidden();
    await expect(fy28.locator('.step--final .value')).toHaveText('−$29.5M');
    await expect(fy28.locator('.step--one-time .value')).toHaveText('$0');
  });

  test('the year toggle works from the keyboard', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('#year-fy2027').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#year-fy2028')).toBeChecked();
    await expect(page.locator('[data-year="fy2028"]')).toBeVisible();
  });

  test('"One-time money" carries the glossary tooltip, and the final gap is outlined', async ({ page }) => {
    await page.goto(PAGE);
    const step = page.locator('[data-year="fy2027"] .step--one-time');
    await step.locator('.term').hover();
    await expect(step.getByRole('tooltip')).toContainText('Money available only once');
    await expect(page.locator('[data-year="fy2027"] .step--final .bar')).toHaveCSS('outline-style', 'solid');
  });

  test('a step chip opens its receipt, with how a subtotal is built', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('[data-year="fy2027"] .step--subtotal .chip-cell [data-source-chip]').click();
    const d = page.locator('dialog[data-receipt-dialog]');
    await expect(d.locator('.figure')).toHaveText('−$31,349,339');
    await expect(d.locator('.facts')).toContainText('Deficit Bridge FY27-28, row 11');
    await expect(d.locator('.built dl > div')).toHaveCount(6); // five steps and the total
  });
});
