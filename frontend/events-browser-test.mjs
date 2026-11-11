import { chromium, expect } from '@playwright/test';
const base = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Requires isolated local test server');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/London' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/login');
  await page.locator('input').first().fill('instructor');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[type="password"]').fill('Test-password-2026!');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Bookings & Events Timeline' }).click();
  await page.getByRole('heading', { name: 'Bookings & Events', exact: true }).waitFor();
  await page.locator('.calendar-event.booking').first().click();
  await page.getByRole('button', { name: 'Edit booking times', exact: true }).click();
  await page.getByLabel('Booking start', { exact: true }).fill('2027-01-12T10:00');
  await page.getByLabel('Booking end', { exact: true }).fill('2027-01-12T09:00');
  await page.getByRole('button', { name: 'Save booking times', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('End time must be after start time.');
  await page.getByLabel('Booking end', { exact: true }).fill('2027-01-12T12:00');
  await page.getByRole('button', { name: 'Save booking times', exact: true }).click();
  await expect(page.getByText('Booking times updated.', { exact: true })).toBeVisible();
  await page.locator('.calendar-event.booking').first().click();
  await page.getByRole('button', { name: 'Edit booking times', exact: true }).click();
  await expect(page.getByLabel('Booking start', { exact: true })).toHaveValue('2027-01-12T10:00');
  await expect(page.getByLabel('Booking end', { exact: true })).toHaveValue('2027-01-12T12:00');
  await page.getByRole('button', { name: 'Cancel time edit', exact: true }).click();
  await page.getByLabel('Event title', { exact: true }).fill('Browser training');
  await page.getByLabel('Location', { exact: true }).fill('Sheffield');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  const bar = page.getByRole('button', { name: /^Browser training,/ });
  await bar.waitFor(); await bar.click();
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByLabel('Event title', { exact: true }).fill('Updated browser training');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: /^Updated browser training,/ }).waitFor();
  await page.getByLabel('View', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: /^Updated browser training,/ }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../docs/instructor-timeline-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Updated browser training,/ }).click();
  await page.getByRole('button', { name: 'Cancel event', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Updated browser training,.*cancelled$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mark as read', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Create event', exact: true })).toBeEnabled();
  await expect(page.locator('.schedule-alerts article').first().getByRole('button')).toHaveCount(0);
  const csrf = (await (await page.request.get(base + '/api/auth/csrf')).json()).csrf_token;
  for (const [title, start, end] of [
    ['Morning training','2026-09-21T09:00:00+01:00','2026-09-21T11:00:00+01:00'],
    ['Driving test briefing','2026-09-21T09:30:00+01:00','2026-09-21T10:30:00+01:00'],
    ['Overnight event','2026-09-21T23:00:00+01:00','2026-09-22T01:00:00+01:00'],
    ['Instructor meeting','2026-09-23T11:00:00+01:00','2026-09-23T13:00:00+01:00'],
    ['School run','2026-09-25T08:00:00+01:00','2026-09-25T09:30:00+01:00']
  ]) {
    const response = await page.request.post(base + '/api/instructor/events', { headers: { 'X-CSRF-Token': csrf }, data: { title, start_time: start, end_time: end } });
    expect(response.ok()).toBeTruthy();
  }
  await page.getByLabel('Date', { exact: true }).fill('2026-09-21');
  await page.getByLabel('View', { exact: true }).selectOption('7');
  await expect(page.locator('.calendar-header .calendar-date')).toHaveCount(7);
  await expect(page.locator('.calendar-event').filter({ hasText: 'Overnight event' })).toHaveCount(2);
  const monday = page.locator('.calendar-day').first();
  const morning = monday.getByRole('button', { name: /^Morning training,/ });
  const overlap = monday.getByRole('button', { name: /^Driving test briefing,/ });
  await expect(morning).toHaveAttribute('data-start-minute', '540');
  const a = await morning.boundingBox(), b = await overlap.boundingBox();
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBeTruthy();
    expect(await page.locator('.calendar-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 2)).toBeTruthy();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../docs/instructor-calendar-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.calendar-scroll').screenshot({ path: '../docs/instructor-calendar-mobile.png' });
  await page.locator('.calendar-date').first().click();
  await expect(page.getByLabel('View', { exact: true })).toHaveValue('1');
  await expect(page.locator('.calendar-day')).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../docs/instructor-timeline-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error('Mobile page overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS browser: booking start/end editing and validation, event CRUD/notifications, calendar positioning, overlaps, overnight split, responsive layouts, no JS exceptions.');
} finally { await browser.close(); }
