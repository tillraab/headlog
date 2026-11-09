// Renders assets/icon.svg into the web favicon and every Android launcher, adaptive and splash image.
// Usage: bun run icons   (needs Chromium for Playwright: bunx playwright install chromium)
import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const RES = 'android/app/src/main/res';
const source = readFileSync('assets/icon.svg', 'utf8');
const inner = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
// icon.svg holds the shared <defs>, then <g id="background">, then <g id="foreground"> as the last element.
const fgStart = inner.indexOf('<g id="foreground">');
const backgroundOnly = inner.slice(0, fgStart);
const foregroundOnly = inner.slice(0, inner.indexOf('<g id="background">')) + inner.slice(fgStart);
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${body}</svg>`;

const square = svg(`<clipPath id="clip"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#clip)">${inner}</g>`);
const round = svg(`<clipPath id="clip"><circle cx="256" cy="256" r="256"/></clipPath><g clip-path="url(#clip)">${inner}</g>`);
// Adaptive icons show the middle 72 of 108 dp and keep 66 dp safe, so the foreground is scaled down.
const foreground = svg(`<g transform="translate(256 256) scale(.64) translate(-256 -256)">${foregroundOnly}</g>`);
const background = svg(backgroundOnly);

writeFileSync('static/favicon.svg', square.replace(' width="100%" height="100%"', ''));

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(markup, width, height, path, bg = 'transparent') {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<body style="margin:0;background:${bg};display:grid;place-items:center;width:${width}px;height:${height}px"><div style="width:${Math.min(width, height)}px;height:${Math.min(width, height)}px">${markup}</div></body>`
  );
  await page.screenshot({ path, omitBackground: bg === 'transparent' });
}

for (const [density, f] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const dir = `${RES}/mipmap-${density}`;
  await render(square, 48 * f, 48 * f, `${dir}/ic_launcher.png`);
  await render(round, 48 * f, 48 * f, `${dir}/ic_launcher_round.png`);
  await render(foreground, 108 * f, 108 * f, `${dir}/ic_launcher_foreground.png`);
  await render(background, 108 * f, 108 * f, `${dir}/ic_launcher_background.png`);
}

// Splash images keep their size; the icon sits in the middle at 30% of the short side.
for (const dir of readdirSync(RES).filter((d) => d.startsWith('drawable') && existsSync(`${RES}/${d}/splash.png`))) {
  const png = readFileSync(`${RES}/${dir}/splash.png`);
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const size = Math.round(Math.min(w, h) * 0.3);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0;background:#f5f5f4;display:grid;place-items:center;width:${w}px;height:${h}px"><div style="width:${size}px;height:${size}px">${square}</div></body>`);
  await page.screenshot({ path: `${RES}/${dir}/splash.png` });
}

await browser.close();
