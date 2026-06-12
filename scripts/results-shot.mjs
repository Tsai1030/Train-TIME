// 開發驗證：以攔截的模擬 TDX 回應開啟「選擇車種」頁面（bun scripts/results-shot.mjs）
import puppeteer from 'puppeteer-core';

const now = new Date();
const hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const at = min => hm(new Date(now.getTime() + min * 60000));

const TT = (no, type, depMin, durMin) => ({
  TrainInfo: {
    TrainNo: no, TrainTypeCode: type,
    TrainTypeName: { Zh_tw: '測試', En: 'T' },
    TripHeadSign: '往潮州', StartingStationID: '1000',
    StartingStationName: { Zh_tw: '臺北', En: 'Taipei' },
    EndingStationID: '3300', EndingStationName: { Zh_tw: '臺中', En: 'Taichung' },
    SuspendedFlag: 0, Note: '',
  },
  StopTimes: [
    { StopSequence: 1, StationID: '1000', StationName: { Zh_tw: '臺北', En: 'Taipei' }, ArrivalTime: at(depMin), DepartureTime: at(depMin) },
    { StopSequence: 2, StationID: '3300', StationName: { Zh_tw: '臺中', En: 'Taichung' }, ArrivalTime: at(depMin + durMin), DepartureTime: at(depMin + durMin) },
  ],
});

const OD = {
  TrainDate: '2026-06-12', UpdateTime: '',
  TrainTimetables: [
    TT('110', '1', -40, 95), TT('1107', '3', -10, 105), TT('123', '3', 12, 108),
    TT('135', '3', 55, 102), TT('301', '11', 25, 99), TT('317', '11', 95, 100),
    TT('2153', '6', -25, 160), TT('2171', '6', 8, 158), TT('2185', '6', 41, 162),
    TT('2199', '6', 75, 159), TT('507', '4', 33, 138), TT('129', '2', 130, 96),
  ],
};
const FARE = { Fares: [{ TicketType: '成自', Price: 375 }, { TicketType: '成莒', Price: 289 }, { TicketType: '成復', Price: 241 }] };
const STATIONS = [
  { id: '1000', name: '臺北', en: 'Taipei', city: '臺北市', major: true },
  { id: '3300', name: '臺中', en: 'Taichung', city: '臺中市', major: true },
];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

await page.evaluateOnNewDocument((stations, recent) => {
  localStorage.setItem('pulse-stations', JSON.stringify({ data: stations, ts: Date.now() }));
  localStorage.setItem('pulse-recent', JSON.stringify(recent));
}, STATIONS, [{ f: STATIONS[0], t: STATIONS[1] }]);

await page.setRequestInterception(true);
page.on('request', req => {
  const u = req.url();
  const json = b => req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (u.includes('/tdx-auth/')) return json({ access_token: 'x', expires_in: 3600 });
  if (u.includes('/DailyTrainTimetable/OD/')) return json(OD);
  if (u.includes('/ODFare/')) return json(FARE);
  if (u.includes('/TrainLiveBoard')) return json({ TrainLiveBoards: [{ TrainNo: '123', StationID: '1000', StationName: { Zh_tw: '臺北', En: '' }, TrainTypeCode: '3', DelayTime: 3 }], UpdateTime: '' });
  if (u.includes('/Rail/TRA/Station')) return json([]);
  return req.continue();
});

await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 800));

// 點最近查詢晶片帶入起訖站 → 查詢
await page.evaluate(() => {
  [...document.querySelectorAll('div')].find(d => /recentChip/.test(d.className))?.click();
});
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(b => /searchBtn/.test(b.className) && /searchActive/.test(b.className))?.click();
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '.shots/results.png' });

// 進入第一個車種的班次列表
await page.evaluate(() => {
  [...document.querySelectorAll('div')].find(d => /_card_/.test(d.className))?.click();
});
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: '.shots/typelist.png' });

await browser.close();
console.log('done');
