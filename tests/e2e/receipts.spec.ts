import { expect, test, type Page } from '@playwright/test';

const PAGE = '/test/receipts/';
const dialog = (page: Page) => page.locator('dialog[data-receipt-dialog]');
// Since #29 each figure is its own trigger (and a statement has one ⓘ), whatever sources it has.
const chip = (page: Page, figure: string) => page.locator(`[data-figure="${figure}"] [data-source-chip]`);

test.describe('source chips and receipts (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a figure is a button named for its value and its documents, dotted-underlined, with no chip label (#29)', async ({ page }) => {
    await page.goto(PAGE);
    const police = page.getByRole('button', { name: '$106.2M, source: FY27-FY28 Budget Balancing Plan', exact: true });
    await expect(police).toBeVisible();
    await expect(police).toHaveText('$106.2M');
    await expect(police).toHaveCSS('text-decoration-style', 'dotted');
    // Several documents: all named, in order.
    await expect(chip(page, 'liability')).toHaveAccessibleName(/^\$773\.1M, source: .+ and .+$/);
    await expect(page.locator('[data-source-chip]').filter({ hasText: /^S\d+$/ })).toHaveCount(0);
  });

  test('a statement without a figure gets one quiet ⓘ that names its document', async ({ page }) => {
    await page.goto(PAGE);
    const info = chip(page, 'document');
    await expect(info).toHaveAccessibleName(/^Source: .+/);
    await expect(info).toHaveText('');
    const box = (await info.boundingBox())!;
    expect(Math.round(box.width)).toBe(24);
    expect(Math.round(box.height)).toBe(24);
    await info.click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('.figure')).toHaveCount(0);
  });

  test('a figure chip opens a full receipt as a right-hand drawer', async ({ page }) => {
    await page.goto(PAGE);
    await chip(page, 'gap').click();
    const d = dialog(page);
    await expect(d).toBeVisible();
    await expect(d.locator('.figure')).toHaveText('−$29,249,339');
    await expect(d.locator('.figure')).toHaveCSS('color', 'rgb(200, 67, 43)');
    await expect(d.locator('.figure-label')).toHaveText('FY2027 General Fund gap, after adjustments');
    await expect(d.locator('.badges')).toHaveText(/Primary source\s*City of Berkeley/);
    await expect(d.locator('.doc-title')).toHaveText('FY27-FY28 Budget Balancing Plan');
    await expect(d.locator('.doc-meta')).toHaveText('Budget & Finance Committee · April 16, 2026');
    await expect(d.locator('.facts')).toContainText('Deficit Bridge FY27-28, row 13');
    await expect(d.locator('.facts')).toContainText('Budgetary/cash basis');
    // One sign per line, then the amount without one; the figure closes the sum (#25).
    await expect(d.locator('.built dl > div')).toHaveText([
      /^− Initial estimate\s*\$32,256,300$/,
      /^\+ Revenue projections\s*\$5,111,718$/,
      /^− Three adjustments\s*\$4,204,757$/,
      /^\+ One-time money\s*\$2,100,000$/,
      /^= −\$29,249,339$/,
    ]);
    await expect(d.getByRole('link', { name: 'Open the PDF ↗' })).toHaveAttribute('href', /berkeleyca\.gov\/.*\.pdf$/);
    await expect(d.getByRole('link', { name: 'CSV' })).toHaveAttribute('href', '/us/ca/berkeley/data/deficit-bridge.csv');
    await expect(d.locator('.caveat')).toContainText('subject to revision');
    await expect(d.locator('.also')).toHaveText(/Also reported in\s*S15\s*Berkeleyside, April 15, 2026/);
    // "Used on" lists real pages where S1's chips appear; this test page never counts.
    const usedOn = d.locator('[data-used-on] a');
    await expect(usedOn.filter({ hasText: 'Home' })).toHaveAttribute('href', '/');
    await expect(usedOn.filter({ hasText: 'Overview' })).toHaveAttribute('href', '/us/ca/berkeley/');
    await expect(d.locator('[data-used-on]')).not.toContainText('test');

    const box = (await d.boundingBox())!;
    expect(box.x + box.width).toBe(1440);
    expect(box.height).toBe(900);
  });

  test('Esc closes it and focus returns to the chip', async ({ page }) => {
    await page.goto(PAGE);
    await chip(page, 'police').focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(chip(page, 'police')).toBeFocused();
  });

  // The browser restores focus itself when the chip was focused before opening (above). These two
  // cover the cases it doesn't: a click that doesn't focus the button (Safari), and the deep link.
  test('focus returns to the chip even when the click did not focus it', async ({ page }) => {
    await page.goto(PAGE);
    await chip(page, 'police').evaluate((el: HTMLElement) => el.click());
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(chip(page, 'police')).toBeFocused();
  });

  test('the close button and a click on the backdrop close it too', async ({ page }) => {
    await page.goto(PAGE);
    await chip(page, 'police').click();
    await dialog(page).getByRole('button', { name: 'Close receipt' }).click();
    await expect(dialog(page)).toBeHidden();
    await chip(page, 'police').click();
    await page.mouse.click(100, 450);
    await expect(dialog(page)).toBeHidden();
  });

  test('focus stays inside the receipt, forwards and backwards', async ({ page }) => {
    await page.goto(PAGE);
    await chip(page, 'gap').click();
    const inside = () => page.evaluate(() => !!document.activeElement?.closest('dialog[data-receipt-dialog]'));
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      expect(await inside(), `after ${i + 1} Tab presses`).toBe(true);
    }
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inside(), `after ${i + 1} Shift+Tab presses`).toBe(true);
    }
  });

  test('a figure from several sources lists all of them', async ({ page }) => {
    await page.goto(PAGE);
    await expect(chip(page, 'liability')).toHaveAttribute('data-source-chip', 'S17 S8');
    await chip(page, 'liability').click();
    const d = dialog(page);
    await expect(d.locator('.badges')).toHaveText(/Reporting\s*Berkeleyside/);
    await expect(d.locator('.also')).toHaveText(/Also from\s*S8\s*City of Berkeley: Financial Condition FY2012–FY2021 \(Auditor\)/);
  });

  test('"Copy citation" copies a full citation with the document URL', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(PAGE);
    await chip(page, 'gap').click();
    await dialog(page).getByRole('button', { name: 'Copy citation' }).click();
    await expect(dialog(page).getByRole('status')).toHaveText('Citation copied');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('FY2027 General Fund gap, after adjustments: −$29,249,339.');
    expect(copied).toMatch(/Source: City of Berkeley, Budget & Finance Committee\. "FY27-FY28 Budget Balancing Plan\." April 16, 2026\. https:\/\/berkeleyca\.gov\/\S+\.pdf \(Deficit Bridge FY27-28, row 13\)\./);
    expect(copied).toContain('Via Where the Money Went, https://wherethemoneywent.com/test/receipts/');
  });

  test('?source=S1 opens that source\'s receipt; focus goes to a trigger naming it on close', async ({ page }) => {
    await page.goto(`${PAGE}?source=S1`);
    const d = dialog(page);
    await expect(d).toBeVisible();
    await expect(d.locator('.doc-title')).toHaveText('FY27-FY28 Budget Balancing Plan');
    await expect(d.locator('.figure')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-source-chip~="S1"]').first()).toBeFocused();
  });

  test('an unknown ?source does nothing', async ({ page }) => {
    await page.goto(`${PAGE}?source=S99`);
    await expect(dialog(page)).toBeHidden();
  });

  test('glossary terms show their definition on hover and on focus, and Esc dismisses', async ({ page }) => {
    await page.goto(PAGE);
    const term = page.locator('.term');
    const tip = term.getByRole('tooltip');
    await expect(term).toHaveCSS('text-decoration-style', 'dotted');
    await expect(tip).toBeHidden();
    await term.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Money available only once');
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();
    await term.focus();
    await expect(tip).toBeVisible();
    await expect(term).toHaveAccessibleDescription(/Money available only once/);
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
  });
});

test.describe('receipts on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the receipt is a bottom sheet, and nothing in it overflows', async ({ page }) => {
    await page.goto(PAGE);
    await chip(page, 'gap').click();
    const d = dialog(page);
    await expect(d).toBeVisible();
    const box = (await d.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(844);
    // Measure the dialog itself: page-level checks can't see overflow inside a scrolling dialog.
    const o = await d.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      wide: [...el.querySelectorAll<HTMLElement>('*')]
        .filter((c) => c.checkVisibility() && c.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5)
        .map((c) => c.className || c.tagName),
    }));
    expect(o.scroll).toBeLessThanOrEqual(o.client);
    expect(o.wide).toEqual([]);
  });

  test('a glossary tooltip stays on screen', async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('.term').focus();
    const tip = (await page.locator('.term').getByRole('tooltip').boundingBox())!;
    expect(tip.x).toBeGreaterThanOrEqual(0);
    expect(tip.x + tip.width).toBeLessThanOrEqual(390);
  });
});

test.describe('ballot outcomes on the overview (#23)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('both outcome tiles, and their drawers, are colored the same way', async ({ page }) => {
    await page.goto('/us/ca/berkeley/');
    const tiles = page.locator('.tile--passes, .tile--fails');
    await expect(tiles).toHaveCount(2);
    const bg = await tiles.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(bg[0]).toBe(bg[1]);

    const drawer = async (tile: string) => {
      await page.locator(`${tile} [data-source-chip]`).first().click();
      const d = dialog(page);
      await expect(d).toBeVisible();
      const f = d.locator('.figure');
      const out = { cls: await f.getAttribute('class'), color: await f.evaluate((el) => getComputedStyle(el).color) };
      await page.keyboard.press('Escape');
      await expect(d).toBeHidden();
      return out;
    };
    const passes = await drawer('.tile--passes');
    const fails = await drawer('.tile--fails');
    expect(passes.cls).toBe('figure figure--neutral');
    expect(fails).toEqual(passes);
  });
});
