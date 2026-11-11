import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
const base = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Requires isolated local test server');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/login');
  await page.locator('input').first().fill('instructor');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[type="password"]').fill('Test-password-2026!');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Instructor Business Cards', exact: true }).click();
  await page.getByLabel('Instructor name', { exact: true }).fill('Selam Test Instructor');
  await page.getByLabel('Qualification / title', { exact: true }).fill('Driving instructor');
  await page.getByLabel('QR booking link', { exact: true }).fill('https://example.test/book');
  await page.getByRole('button', { name: 'Save card details', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Card details saved.');
  await page.reload();
  await expect(page.getByLabel('Instructor name', { exact: true })).toHaveValue('Selam Test Instructor');
  await expect(page.locator('.card-art svg').first()).toBeVisible();
  for (const side of ['front','back']) {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${side} HD PNG`, exact: true }).click();
    const download = await promise;
    const bytes = await fs.readFile(await download.path());
    if (bytes.readUInt32BE(16) !== 2550 || bytes.readUInt32BE(20) !== 1650) throw new Error('Incorrect HD dimensions');
    if (side === 'front') {
      const png = PNG.sync.read(bytes);
      const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
      if (code?.data !== 'https://example.test/book') throw new Error('Exported QR does not decode to the booking link');
    }
    await download.saveAs(`../docs/business-card-${side}-sample.png`);
  }
  const svgPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download back vector SVG', exact: true }).click();
  const svg = await fs.readFile(await (await svgPromise).path(), 'utf8');
  if (!svg.includes('width="85mm"') || !svg.includes('SELAM TEST INSTRUCTOR')) throw new Error('Invalid vector export');
  await page.getByLabel('Instructor name', { exact: true }).fill('<script>alert(1)</script>');
  await expect(page.locator('.card-art script')).toHaveCount(0);
  await page.getByLabel('Instructor name', { exact: true }).fill('Selam Test Instructor');
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path: '../docs/business-card-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../docs/business-card-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error('Mobile overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS business card browser: portal link, save/reload, front/back 2550x1650 PNG downloads, decoded booking QR, vector SVG, escaped text, desktop/mobile layout.');
} finally { await browser.close(); }
