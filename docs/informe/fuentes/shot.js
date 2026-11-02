const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2 });
  for (const [f, w, h] of [['flujo', 1500, 560], ['arquitectura', 1500, 900]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.goto('file://' + __dirname + '/' + f + '.html');
    await p.screenshot({ path: __dirname + '/' + f + '.png', clip: { x: 0, y: 0, width: w, height: h } });
  }
  await b.close();
})();
