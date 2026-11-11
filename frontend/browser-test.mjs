import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'selam-browser-'));
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`;
const env={...process.env,APP_ENV:'testing',APP_URL:base,APP_KEY:'browser-test-key-'+ 'x'.repeat(48),DB_DSN:`sqlite:${runtime}/test.sqlite`,APP_DATA_DIR:`${runtime}/data`,APP_PRIVATE_DIR:`${runtime}/config`,MAIL_TRANSPORT:'log'};
const fixture=spawnSync('php',['tests/fixture.php'],{cwd:root,env,encoding:'utf8'});
if(fixture.status!==0) throw new Error(fixture.stderr||fixture.stdout);
const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t','public','public/router.php'],{cwd:root,env,stdio:'ignore',windowsHide:true});
let browser;
try {
  for(let i=0;i<50;i++) { try { await fetch(base+'/api/health'); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base); await page.getByRole('heading',{name:'Learn Manual and Automatic Driving with Confidence'}).waitFor();
  await page.getByRole('heading',{name:'Booking Questions'}).waitFor();
  await page.screenshot({path:path.join(root,'docs/desktop.png'),fullPage:true});
  await page.getByRole('link',{name:'Portal',exact:true}).click();
  await page.locator('input').first().fill('admin');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('input[type="password"]').fill('Test-password-2026!');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await page.getByRole('heading',{name:'Admin Dashboard',exact:true}).waitFor();
  await page.getByRole('button',{name:'Packages',exact:true}).click();
  // Locate form controls from their DOM names, retained from the original UI.
  const packageForm=page.locator('form').filter({has:page.getByRole('button',{name:'Create Package',exact:true})});
  await packageForm.locator('input').nth(0).fill('Browser Test Package');
  await packageForm.locator('input').nth(1).fill('5');
  await packageForm.locator('input').nth(2).fill('180');
  await packageForm.locator('button[type="submit"]').click();
  await page.getByText('Browser Test Package',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'SMTP/SMS Config',exact:true}).click();
  await page.getByRole('heading',{name:'SMTP Configuration',exact:true}).waitFor();
  await page.screenshot({path:path.join(root,'docs/admin-settings.png'),fullPage:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
  const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
  await mp.goto(base+'/book');
  await mp.locator('select[name="package_id"] option').filter({hasText:'Browser Test Package'}).waitFor({state:'attached'});
  await mp.locator('select[name="package_id"]').selectOption({label:'Browser Test Package - 5 hours - GBP 180'});
  await mp.locator('input[name="preferred_start"]').fill('2027-06-14T10:00');
  await mp.locator('input[name="pickup_location"]').fill('Sheffield');
  await mp.locator('input[name="guest_name"]').fill('Browser Learner');
  await mp.locator('input[name="guest_email"]').fill('browser@example.test');
  await mp.locator('input[name="guest_phone"]').fill('07000000000');
  await mp.getByRole('button',{name:'Submit Booking',exact:true}).click();
  await mp.getByText('Booking submitted. We will be in contact with your lesson details and assigned instructor.',{exact:true}).waitFor();
  await mp.evaluate(()=>window.scrollTo(0,0));
  await mp.screenshot({path:path.join(root,'docs/mobile-booking.png'),fullPage:true});
  if(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)) throw new Error('Mobile page overflows horizontally');
  if(errors.length) throw new Error(errors.join('\n'));
  console.log('PASS desktop home, admin login, package creation, SMTP settings, mobile booking, responsive width, and no JavaScript exceptions.');
} finally {
  if(browser) await browser.close();
  server.kill(); await new Promise(resolve=>server.once('exit',resolve));
  const resolved=fs.realpathSync(runtime);
  if(path.dirname(resolved)===fs.realpathSync(os.tmpdir()) && path.basename(resolved).startsWith('selam-browser-')) fs.rmSync(resolved,{recursive:true,force:true});
}
