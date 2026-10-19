import { chromium } from '@playwright/test';
const b = await chromium.launch(); const out = process.argv[2];
for (const w of [390, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 844 }, ...(w < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await p.goto('http://localhost:4828/'); await p.evaluate(() => document.fonts.ready);
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log(w, h, (h / 844).toFixed(2), 'screens', 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await p.screenshot({ path: `${out}/home-${w}.png`, fullPage: true });
  await p.close();
}
await b.close();
