import { expect, test } from '@playwright/test';

const PAGE = '/us/ca/berkeley/';
const tour = 'Start the 3-minute tour';

// On a phone the waffle fills about a screen, so the tour link comes before it (#24).
test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('the tour link sits under the lede, above the waffle, and is the only one shown', async ({ page }) => {
    await page.goto(PAGE);
    const links = page.getByRole('link', { name: tour });
    await expect(links).toHaveCount(1);
    const link = links.first();
    const [l, lede, waffle] = await Promise.all([link.boundingBox(), page.locator('.lede').boundingBox(), page.locator('.hero-waffle').boundingBox()]);
    expect(l!.y).toBeGreaterThan(lede!.y + lede!.height - 1);
    expect(l!.y + l!.height).toBeLessThan(waffle!.y);
    await expect(link).toBeInViewport();
  });
});

test.describe('at 1440px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the tour link stays under the stats, beside the waffle', async ({ page }) => {
    await page.goto(PAGE);
    const links = page.getByRole('link', { name: tour });
    await expect(links).toHaveCount(1);
    const [l, stats] = await Promise.all([links.first().boundingBox(), page.locator('.stats').boundingBox()]);
    expect(l!.y).toBeGreaterThan(stats!.y + stats!.height - 1);
    await expect(page.locator('.hero-more .ctas')).toBeVisible();
  });
});
