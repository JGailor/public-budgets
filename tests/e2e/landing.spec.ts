import { expect, test } from '@playwright/test';

test.describe('landing page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the header links to its sections and to Berkeley', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav.desktop');
    for (const name of ['Cities', 'Our promise', 'Data']) await expect(nav.getByRole('link', { name })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Explore Berkeley →' })).toHaveAttribute('href', '/us/ca/berkeley/');
    await nav.getByRole('link', { name: 'Our promise' }).click();
    await expect(page.locator('#promise')).toBeInViewport();
  });

  test('question cards open receipts and deep-link to their pages', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.question').filter({ hasText: 'What if Measure V, the sales tax, passes?' });
    await card.locator('[data-source-chip]').click();
    const d = page.locator('dialog[data-receipt-dialog]');
    await expect(d.locator('.figure')).toHaveText('105');
    await expect(d.locator('.figure-label')).toHaveText('Positions cut if the sales tax passes (138 if it fails)');
    await expect(d.locator('.facts')).toContainText('FTE & Positions, row 12');
    await page.keyboard.press('Escape');
    for (const [q, href] of [
      ['Where does the money go?', '/us/ca/berkeley/'],
      ['Why is there a deficit?', '/us/ca/berkeley/gap/'],
      ["Who's cutting what?", '/us/ca/berkeley/departments/'],
    ]) {
      await expect(page.locator('.question').filter({ hasText: q }).locator('a.open')).toHaveAttribute('href', href);
    }
  });

  test('the gap in the subhead opens its receipt', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lede [data-source-chip="S1"]').click();
    await expect(page.locator('dialog[data-receipt-dialog] .figure')).toHaveText('−$29,249,339');
  });

  test('"Where every $100 goes" responds to hover and click, like the overview', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.city-card');
    await card.locator('.sq[data-item="police"]').first().hover();
    await expect(card.locator('[data-panel="police"]')).toBeVisible();
    await card.locator('.sq[data-item="fire"]').first().click();
    await expect(card.locator('[data-panel="fire"]')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Department details' }).filter({ visible: true })).toHaveAttribute('href', '/us/ca/berkeley/departments/#fire');
  });

  test('"Request your city" opens a prefilled GitHub request', async ({ page, context }) => {
    // Answer GitHub locally: the test checks the URL the form builds, not GitHub.
    await context.route('https://github.com/**', (route) => route.fulfill({ status: 200, body: 'ok' }));
    await page.goto('/');
    await page.getByRole('link', { name: 'Request your city' }).click();
    await page.getByPlaceholder('City').fill('Oakland');
    await page.getByPlaceholder('State').fill('CA');
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Request it' }).click()]);
    const url = new URL(popup.url());
    expect(url.origin + url.pathname).toBe('https://github.com/JGailor/public-budgets/issues/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({ template: 'request-a-city.yml', title: 'City request', city: 'Oakland', state: 'CA' });
  });
});

test.describe('landing page on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('at least 30% shorter than the 6.5 screens (5,499px) it was before #28', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(5499 * 0.7);
  });

  test('a tap on a square opens its department as a bottom sheet', async ({ page }) => {
    await page.goto('/');
    await page.locator('.city-card .sq[data-item="prw"]').first().tap();
    const tip = page.locator('.city-card [data-tip]');
    await expect(tip).toHaveClass(/sheet/);
    await expect(tip.locator('[data-panel="prw"]')).toBeVisible();
    await expect(tip.getByRole('link', { name: 'Department details' }).filter({ visible: true })).toBeVisible();
  });
});
