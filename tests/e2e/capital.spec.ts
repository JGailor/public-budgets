import { expect, test } from '@playwright/test';

const PAGE = '/us/ca/berkeley/capital/';

for (const width of [390, 768, 1440]) {
  test(`at ${width}px the treemap blocks tile the box and labels fit`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(PAGE);
    const box = (await page.locator('.tree').boundingBox())!;
    const blocks = await page.locator('.tb').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const name = el.querySelector('.tb-name')!;
        const shown = getComputedStyle(name).clipPath === 'none';
        return { id: (el as HTMLElement).dataset.id, x: r.x, y: r.y, w: r.width, h: r.height, shown, overflows: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1 };
      }),
    );
    let area = 0;
    for (const b of blocks) {
      area += b.w * b.h;
      expect(b.x).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(b.x + b.w).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(b.overflows, `${b.id} label overflows`).toBe(false);
    }
    expect(area / (box.width * box.height)).toBeCloseTo(1, 2);
    // A block too small to label is named in the key under the treemap, and only then.
    const keyed = await page.locator('.unlabeled li').evaluateAll((els) => els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => (e as HTMLElement).dataset.for));
    expect(keyed.sort()).toEqual(blocks.filter((b) => !b.shown).map((b) => b.id).sort());
    // The big blocks are always labeled.
    for (const id of ['Sanitary Sewer', 'general-fund', 'other']) expect(blocks.find((b) => b.id === id)!.shown, id).toBe(true);
  });
}

test('the scale draws the program and the need on one axis', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGE);
  const program = (await page.locator('.bar--program').boundingBox())!;
  const need = (await page.locator('.bar--need').boundingBox())!;
  // $183.6M of a $2.12B axis.
  expect(program.width / need.width).toBeCloseTo(183_623_376 / 2_115_819_772, 2);
});

test('the General Fund receipt lists its five programs', async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('.gf-note [data-source-chip]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (const p of ['Streets', 'Facilities', 'Camps', 'Sidewalks', 'Parks']) await expect(dialog).toContainText(p);
  await expect(dialog).toContainText('p. 170 of the PDF');
});

test('the nav links here, after Ballot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/us/ca/berkeley/');
  const links = await page.locator('nav.desktop .links a').allTextContents();
  expect(links.map((l) => l.trim())).toEqual(['Overview', 'Revenue', 'The Gap', 'Departments', 'Ballot', 'Capital', 'Sources']);
});
