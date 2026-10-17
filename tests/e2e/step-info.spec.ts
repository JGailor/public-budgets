import { expect, test, type Locator, type Page } from '@playwright/test';

// "What is this step?" (#25): an ⓘ on every step of the gap, on the overview card and the Gap page.
const OVERVIEW = '/us/ca/berkeley/';
const GAP = '/us/ca/berkeley/gap/';
const panelFor = async (page: Page, button: Locator) => page.locator(`#${await button.getAttribute('aria-controls')}`);

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the overview chart labels every bar in plain words, each with an ⓘ', async ({ page }) => {
    await page.goto(OVERVIEW);
    const names = page.locator('.wf-names li > span');
    await expect(names).toHaveText(['First estimate', 'Higher revenue', '3 adjustments', 'One-time money', 'Gap left']);
    for (const name of ['First estimate', 'Higher revenue', '3 adjustments', 'One-time money', 'Gap left']) {
      await expect(page.getByRole('button', { name: `What is “${name}”?` })).toBeVisible();
    }
  });

  test('every Gap step, in both years, has an ⓘ whose panel cites S1 by page', async ({ page }) => {
    await page.goto(GAP);
    for (const year of ['fy2027', 'fy2028']) {
      if (year === 'fy2028') await page.locator('label[for="year-fy2028"]').click();
      const steps = page.locator(`[data-year="${year}"] .step`);
      await expect(steps).toHaveCount(8);
      for (const step of await steps.all()) {
        const button = step.locator('button[data-info]');
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await button.click();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        const panel = await panelFor(page, button);
        await expect(panel).toBeVisible();
        await expect(panel.locator('[data-source-chip="S1"]').first()).toBeVisible();
        expect((await panel.innerText()).trim().length).toBeGreaterThan(40);
      }
    }
  });

  test('opens by keyboard, Esc closes it and returns focus; opening another closes the first', async ({ page }) => {
    await page.goto(GAP);
    const year = page.locator('[data-year="fy2027"]');
    const first = year.getByRole('button', { name: 'What is “Initial estimate”?' });
    const second = year.getByRole('button', { name: 'What is “One-time money”?' });
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(await panelFor(page, first)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(await panelFor(page, first)).toBeHidden();
    await expect(first).toBeFocused();
    await page.keyboard.press('Space');
    await expect(await panelFor(page, first)).toBeVisible();
    await second.click();
    await expect(await panelFor(page, first)).toBeHidden();
    await expect(await panelFor(page, second)).toContainText('can spend only once');
    // S1 p.9's whole sentence: the lasting fix includes new revenue, i.e. the sales tax (PM review on #25).
    await expect(await panelFor(page, second)).toContainText('the lasting fix comes from ongoing cuts and new revenue.');
    // A click elsewhere closes it; a click on its own chip doesn't.
    await (await panelFor(page, second)).locator('[data-source-chip]').first().click();
    await expect(page.locator('dialog[data-receipt-dialog]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(await panelFor(page, second)).toBeVisible();
    await page.locator('h1').click();
    await expect(await panelFor(page, second)).toBeHidden();
  });

  test('the adjustment bars are solid, not hatched; one-time money stays gold', async ({ page }) => {
    await page.goto(GAP);
    for (const bar of await page.locator('[data-year="fy2027"] .step--cost .bar').all()) await expect(bar).toHaveCSS('background-image', 'none');
    await expect(page.locator('[data-year="fy2027"] .step--one-time .bar')).toHaveCSS('background-color', 'rgb(217, 154, 30)');
    await page.goto(OVERVIEW);
    await expect(page.locator('pattern')).toHaveCount(0);
    expect(await page.locator('.wf-bar--cost').evaluate((el) => getComputedStyle(el).fill)).not.toMatch(/url/);
  });

  test('the one-time money receipt shows each sign once, in color, and ends with what is left over', async ({ page }) => {
    await page.goto(GAP);
    await page.locator('.left-over [data-source-chip]').click();
    const d = page.locator('dialog[data-receipt-dialog]');
    const lines = d.locator('.built dl > div');
    await expect(lines).toHaveText([
      /^\+ Operating Reserve \(2025 AAO #1\)\s*\$4,177,541$/,
      /^\+ Dissolution of Successor Agency — Transfer to City\s*\$7,877,572$/,
      /^− Used to delay cuts until the sales-tax vote \(City: "Proposed Sales & Use Tax \(bridge\)"\)\s*\$9,443,000$/,
      /^− Smooth Difference in FY27\/FY28 Deficit\s*\$2,100,000$/,
      /^− Carrying Costs — Impacted Employees\s*\$500,000$/,
      /^= \$12,113 left over$/,
    ]);
    await expect(d.locator('.part--add .sign').first()).toHaveCSS('color', 'rgb(14, 107, 111)');
    await expect(d.locator('.part--sub .sign').first()).toHaveCSS('color', 'rgb(168, 54, 31)');
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });

  test('a tap opens the ⓘ on the overview chart, and the panel fits on screen', async ({ page }) => {
    await page.goto(OVERVIEW);
    const button = page.getByRole('button', { name: 'What is “3 adjustments”?' });
    await button.tap();
    const panel = await panelFor(page, button);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('1947 Center Street');
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
  });

  test('a tap opens the ⓘ on a Gap step, under the step', async ({ page }) => {
    await page.goto(GAP);
    const step = page.locator('[data-year="fy2027"] .step--one-time');
    await step.locator('button[data-info]').tap();
    const panel = step.locator('.info-panel');
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.y).toBeGreaterThan((await step.locator('.track').boundingBox())!.y);
  });
});
