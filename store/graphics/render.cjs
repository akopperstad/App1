// Renders store/graphics/src/feature-graphic.html to store/graphics/feature-graphic.png (1024x500).
//   node store/graphics/render.cjs      (needs the `playwright` package + chromium)
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'src', 'feature-graphic.html'));
  await page.waitForTimeout(150);
  const out = path.join(__dirname, 'feature-graphic.png');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1024, height: 500 } });
  await browser.close();
  console.log('wrote', out);
})();
