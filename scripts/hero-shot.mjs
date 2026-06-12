// 開發驗證：火車特寫 + 捲動中間態截圖（bun scripts/hero-shot.mjs）
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 5000));
await page.screenshot({ path: '.shots/hero-zoom.png', clip: { x: 0, y: 0, width: 390, height: 400 } });

const info = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(d => /homeScroll/.test(d.className));
  if (!el) return null;
  el.scrollTop = 99999;
  return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
});
console.log('scroll info:', JSON.stringify(info));
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '.shots/scroll-mid.png', clip: { x: 0, y: 0, width: 390, height: 400 } });
await browser.close();
console.log('done');
