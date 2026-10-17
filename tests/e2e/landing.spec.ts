import { expect, test } from '@playwright/test';

test.describe('landing page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the header links to its sections and to Berkeley', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav.desktop');
    for (const name of ['How it works', 'Cities', 'Our promise', 'Data']) await expect(nav.getByRole('link', { name })).toBeVisible();
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

  test('the hero receipt card opens the full receipt for the gap', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.receipt-figure')).toHaveText('−$29,249,339');
    await page.locator('.receipt-card [data-source-chip="S1"]').click();
    await expect(page.locator('dialog[data-receipt-dialog] .figure')).toHaveText('−$29,249,339');
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

// On desktop the receipt card floats over the waffle's bottom-right corner, as mocked (L1); the
// legend must stay readable. Stacked layouts (below 1024px) may cover nothing at all.
for (const [width, targets] of [
  [390, '.mini-waffle .grid span, .mini-waffle .legend li'],
  [768, '.mini-waffle .grid span, .mini-waffle .legend li'],
  [1024, '.mini-waffle .legend li'],
  [1280, '.mini-waffle .legend li'],
  [1440, '.mini-waffle .legend li'],
] as const) {
  test(`at ${width}px the floating receipt covers no ${width < 1024 ? 'waffle square or ' : ''}legend entry`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const covered = await page.evaluate((sel) => {
      const card = document.querySelector('.receipt-card')!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(sel)]
        .filter((el) => {
          // A legend row stretches the card's width; what must stay visible is its swatch and text.
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return r.left < card.right && card.left < r.right && r.top < card.bottom && card.top < r.bottom;
        })
        .map((el) => el.textContent?.trim() || el.dataset.dept);
    }, targets);
    expect(covered).toEqual([]);
  });
}
