/**
 * Verifies the timer colon is centered within the time-display container.
 * Run: npm install && npm run test:center
 */
const path = require('path');
const { chromium } = require('playwright');

const htmlPath = 'file://' + path.resolve(__dirname, 'test-timer-center.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(htmlPath);
  await page.waitForTimeout(150);

  const result = await page.evaluate(() => {
    const container = document.querySelector('.time-display');
    const colon = document.querySelector('.time-colon');
    if (!container || !colon) return { pass: false, error: 'Elements not found' };
    const cr = container.getBoundingClientRect();
    const colr = colon.getBoundingClientRect();
    const containerCenterX = cr.left + cr.width / 2;
    const colonCenterX = colr.left + colr.width / 2;
    const offsetPx = Math.abs(colonCenterX - containerCenterX);
    return { pass: offsetPx <= 1, offsetPx, containerWidth: cr.width };
  });

  await browser.close();

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.pass) {
    console.log('PASS: Colon is centered (offset ' + result.offsetPx.toFixed(2) + 'px)');
    process.exit(0);
  } else {
    console.error('FAIL: Colon offset ' + result.offsetPx.toFixed(2) + 'px from center (max 1px)');
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
