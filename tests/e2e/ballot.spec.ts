import { expect, test } from '@playwright/test';

const PAGE = '/us/ca/berkeley/ballot/';

for (const width of [390, 1440]) {
  test(`at ${width}px both outcomes get identical weight`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(PAGE);
    const cards = page.locator('.scenario');
    await expect(cards).toHaveCount(2);
    const look = (i: number) =>
      cards.nth(i).evaluate((el) => {
        const h = el.querySelector('.scenario-h')!;
        const on = el.querySelector('.person.on')!;
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), header: getComputedStyle(h).backgroundColor, person: getComputedStyle(on).getPropertyValue('--c'), font: getComputedStyle(el.querySelector('.big-n')!).fontSize };
      });
    expect(await look(0)).toEqual(await look(1));
  });
}

test('side by side on desktop, same height row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGE);
  const [a, b] = await page.locator('.scenario').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  expect(a.top).toBe(b.top);
  expect(a.right).toBeLessThan(b.left);
});

test('the pictograms are labeled with the layoff counts', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.getByRole('img', { name: '20 people laid off, out of 40 shown' })).toBeVisible();
  await expect(page.getByRole('img', { name: '38 people laid off, out of 40 shown' })).toBeVisible();
});

test('the nav, the overview and the landing page link here', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/us/ca/berkeley/');
  await expect(page.locator('nav.desktop').getByRole('link', { name: 'Ballot' })).toHaveAttribute('href', PAGE);
  await expect(page.getByRole('link', { name: 'Compare both outcomes' })).toHaveAttribute('href', PAGE);
  await page.goto('/');
  await expect(page.locator(`a[href="${PAGE}"]`).first()).toBeVisible();
});
