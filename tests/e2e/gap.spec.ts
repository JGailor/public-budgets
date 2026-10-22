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

  test("a step's value opens its receipt, with how a subtotal is built (#29)", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('[data-year="fy2027"] .step--subtotal .value').getByRole('button', { name: /^−\$31\.3M, source: / }).click();
    const d = page.locator('dialog[data-receipt-dialog]');
    await expect(d.locator('.figure')).toHaveText('−$31,349,339');
    await expect(d.locator('.facts')).toContainText('Deficit Bridge FY27-28, row 11');
    await expect(d.locator('.built dl > div')).toHaveCount(6); // five steps and the total
  });

  // #39: the step labels line up across the chart, first line to first line, whatever each bar's depth.
  for (const width of [1440, 800, 768]) {
    test(`step labels share one top edge, under their amounts, at ${width}px (#39)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PAGE);
      for (const year of ['fy2027', 'fy2028']) {
        await page.locator(`label[for="year-${year}"]`).click();
        const steps = page.locator(`[data-year="${year}"] .step`);
        await expect(steps).toHaveCount(8);
        const boxes = await steps.evaluateAll((els) =>
          els.map((el) => {
            const box = (sel: string) => el.querySelector(sel)!.getBoundingClientRect();
            return { label: box('.label').top, value: box('.value'), bar: box('.bar').bottom };
          }),
        );
        const tops = boxes.map((b) => b.label);
        expect(Math.max(...tops) - Math.min(...tops), `${year} label tops ${tops.join(', ')}`).toBeLessThanOrEqual(1);
        for (const b of boxes) {
          // Each amount is still drawn just under its own bar…
          expect(b.value.top).toBeGreaterThanOrEqual(b.bar);
          expect(b.value.top - b.bar).toBeLessThan(16);
          // …and clear of the label row.
          expect(b.value.bottom).toBeLessThan(Math.min(...tops));
        }
        // Amounts stay on one line now, so check they never run into each other or past the page's 16px gutter.
        for (let i = 1; i < boxes.length; i++) expect(boxes[i].value.left - boxes[i - 1].value.right).toBeGreaterThan(4);
        expect(boxes.at(-1)!.value.right).toBeLessThanOrEqual(width - 16);
      }
    });
  }
});
