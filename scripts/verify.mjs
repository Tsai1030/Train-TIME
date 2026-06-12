// 開發驗證腳本：截圖 + 水平溢出診斷（bun scripts/verify.mjs）
import puppeteer from 'puppeteer-core';

const URL = process.env.VERIFY_URL || 'http://localhost:5174/';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4500)); // 等粒子組裝完成

const overflow = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), left: Math.round(r.left), right: Math.round(r.right) });
    }
  });
  return { vw, count: bad.length, bad: bad.slice(0, 25) };
});
console.log(JSON.stringify(overflow, null, 2));

await page.screenshot({ path: '.shots/home2.png' });

await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(d => /homeScroll/.test(d.className));
  if (el) el.scrollTop = el.clientHeight * 0.62;
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '.shots/scrolled.png' });

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
