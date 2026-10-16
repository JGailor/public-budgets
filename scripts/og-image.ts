/**
 * Renders the link-preview image (public/og/wherethemoneywent.png, 1200×630).
 * It's a brand card with no figures in it, so it can't go stale when the data
 * changes. Re-run after a name or design change: node scripts/og-image.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const font = (p: string) => `data:font/woff2;base64,${readFileSync(join(root, 'node_modules', p)).toString('base64')}`;
const cells = ['#0e6b6f', '#0e6b6f', '#0e6b6f', '#3e9a8f', '#3e9a8f', '#7cbfb3', '#7cbfb3', '#a9d6cc', '#c8432b'];

const html = `<!doctype html><html><head><style>
@font-face { font-family: Gelasio; font-weight: 400; src: url(${font('@fontsource/gelasio/files/gelasio-latin-400-normal.woff2')}); }
@font-face { font-family: Gelasio; font-weight: 700; src: url(${font('@fontsource/gelasio/files/gelasio-latin-700-normal.woff2')}); }
@font-face { font-family: Nunito; font-weight: 200 1000; src: url(${font('@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2')}); }
body { margin: 0; width: 1200px; height: 630px; background: #f7f3ea; color: #16191d; font-family: Nunito; display: flex; }
.main { flex: 1; padding: 72px 80px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 18px; font: 700 34px Gelasio; }
.logo { display: grid; grid-template-columns: repeat(3, 14px); gap: 3px; }
.logo span { width: 14px; height: 14px; border-radius: 3px; }
h1 { font: 400 76px/1.06 Gelasio; margin: auto 0 28px; letter-spacing: -0.5px; }
p { margin: 0; font-size: 24px; color: #5d6168; font-weight: 600; }
.side { width: 300px; background: #0e6b6f; display: grid; grid-template-columns: repeat(5, 40px); gap: 10px; padding: 70px 60px; align-content: center; }
.side span { width: 40px; height: 40px; border-radius: 7px; background: rgb(255 255 255 / 0.16); }
.side span.r { background: #c8432b; }
</style></head><body>
<div class="main">
  <div class="brand"><div class="logo">${cells.map((c) => `<span style="background:${c}"></span>`).join('')}</div>Where the Money Went</div>
  <h1>Your city's budget,<br>finally readable.</h1>
  <p>Every number links to the public document it came from.</p>
</div>
<div class="side">${Array.from({ length: 35 }, (_, i) => `<span class="${i === 23 ? 'r' : ''}"></span>`).join('')}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'public/og/wherethemoneywent.png') });
await browser.close();
console.log('wrote public/og/wherethemoneywent.png');
