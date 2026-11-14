#!/usr/bin/env node
// Store screenshots for Pulse: drives the real app (Vite dev server) with Playwright,
// captures raw app screens with seeded data and a frozen clock, then composes the
// marketing frames (src/frame.html) at exact store pixel sizes.
//
//   npx vite --port 5230 &            # the app must be served here
//   node store/screenshots/render.cjs [--locales en-US,nb-NO] [--platforms ios-6.9,play-phone] [--only home,tabata]
//
// Output: store/screenshots/<platform>/<locale>/<NN>-<slug>.png, overview-<locale>.png
// Raw app captures are cached in store/screenshots/.raw/ (git-ignorable).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const D = require('./src/data.cjs');

const ROOT = __dirname;
const APP = process.env.PULSE_URL || 'http://localhost:5230/';
const RAW = path.join(ROOT, '.raw');

// ------------------------------------------------------------------ platforms
// device: CSS viewport of the device screen (status bar + app), sb = status-bar height (CSS px),
// dsf = capture scale. canvas = final store image size (px).
const PLATFORMS = {
  'ios-6.9': { kind: 'phone', canvas: [1320, 2868], device: [440, 956], sb: 54, dsf: 3, radius: 62, os: 'ios' },
  'ios-6.5': { kind: 'phone', canvas: [1242, 2688], device: [414, 896], sb: 48, dsf: 3, radius: 56, os: 'ios' },
  'ipad-13': { kind: 'tablet', canvas: [2752, 2064], device: [1376, 1032], sb: 28, dsf: 2, radius: 36, os: 'ios' },
  'play-phone': { kind: 'phone', canvas: [1080, 1920], device: [360, 640], sb: 28, dsf: 3, radius: 34, os: 'android' },
  'play-tablet-7': { kind: 'tablet', canvas: [1920, 1200], device: [960, 600], sb: 26, dsf: 2, radius: 26, os: 'android' },
  'play-tablet-10': { kind: 'tablet', canvas: [2560, 1600], device: [1280, 800], sb: 26, dsf: 2, radius: 28, os: 'android' },
};

// ------------------------------------------------------------------ storyboards
// shot = raw capture id, theme = frame background, landscape = device rotated (phones).
const PHONE_FRAMES = [
  { slug: 'timers', caption: 'home', shot: 'home', bg: 'dark' },
  { slug: 'intervals', caption: 'tabata', shot: 'tabata', bg: 'dark' },
  { slug: 'locked', caption: 'locked', shot: 'lock', bg: 'coral' },
  { slug: 'big-clock', caption: 'across', shot: 'amrapLand', bg: 'dark', landscape: true },
  { slug: 'emom', caption: 'emom', shot: 'emom', bg: 'light' },
  { slug: 'custom', caption: 'custom', shot: 'custom', bg: 'light' },
  { slug: 'history', caption: 'history', shot: 'history', bg: 'light' },
  { slug: 'sound-language', caption: 'settings', shot: 'settings', bg: 'dark' },
  { slug: 'finish', caption: 'finish', shot: 'finish', bg: 'coral', iosOnly: true },
];
const TABLET_FRAMES = [
  { slug: 'timers', caption: 'home', shot: 'home', bg: 'dark' },
  { slug: 'intervals', caption: 'tabata', shot: 'tabata', bg: 'dark' },
  { slug: 'big-screen', caption: 'bigscreen', shot: 'amrap', bg: 'coral' },
  { slug: 'custom', caption: 'custom', shot: 'custom', bg: 'light' },
  { slug: 'history', caption: 'history', shot: 'history', bg: 'light' },
  { slug: 'sound-language', caption: 'settings', shot: 'settings', bg: 'dark' },
];

// ------------------------------------------------------------------ args
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1].split(',') : null;
};
const LOCALE_LIST = arg('locales') || Object.keys(D.LOCALES);
const PLATFORM_LIST = arg('platforms') || Object.keys(PLATFORMS);
const ONLY = arg('only');
const RAW_ONLY = args.includes('--raw-only');
const REUSE_RAW = args.includes('--reuse-raw');

// ------------------------------------------------------------------ app capture
async function newAppPage(browser, { width, height, dsf, lang, bcp, theme, stack, insets }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: true,
    hasTouch: true,
    locale: bcp,
    timezoneId: D.TZ,
    colorScheme: theme,
    reducedMotion: 'no-preference',
  });
  const seed = {
    'pulse.settings.v1': JSON.stringify(D.settings(lang, theme)),
    'pulse.presets.v1': JSON.stringify(D.presets(lang)),
    'pulse.history.v1': JSON.stringify(D.history(lang)),
  };
  await ctx.addInitScript(
    ({ seed, stack, insets }) => {
      // What Capacitor's safe-area plugin provides on device: the app pads itself.
      const css = Object.entries(insets).map(([k, v]) => `--safe-area-inset-${k}:${v}px`).join(';');
      const apply = () => document.documentElement.setAttribute('style', css);
      if (document.documentElement) apply();
      else document.addEventListener('readystatechange', apply, { once: true });
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      if (stack) history.replaceState({ depth: stack.length - 1, stack }, '');
    },
    { seed, stack, insets },
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn('  [pageerror]', e.message));
  await page.clock.install({ time: D.NOW - 3000 });
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.clock.pauseAt(D.NOW);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

/** Let CSS transitions (real time, not the fake clock) settle. */
const settle = (page, ms = 900) => page.waitForTimeout(ms);

/**
 * Scroll the page so `sel` sits at `frac` of the viewport height (its top edge,
 * or its bottom edge with edge = 'bottom').
 */
async function scrollTo(page, sel, frac, edge = 'top') {
  await page.evaluate(
    ({ sel, frac, edge }) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('missing ' + sel);
      const r = el.getBoundingClientRect();
      const y = (edge === 'top' ? r.top : r.bottom) + window.scrollY - innerHeight * frac + (edge === 'top' ? 0 : 16);
      const sc = document.scrollingElement;
      sc.scrollTop = Math.max(0, y);
      // pages that scroll an inner container
      for (const c of document.querySelectorAll('.ui-page')) if (c.scrollHeight > c.clientHeight + 4) c.scrollTop = Math.max(0, y);
    },
    { sel, frac, edge },
  );
}

async function startRun(page) {
  await page.click('.start');
}

/**
 * Advance the fake clock. The engine reads performance.now(), so a jump is exact;
 * a short runFor afterwards lets rAF/intervals render the new state.
 */
async function advance(page, ms) {
  while (ms > 0) {
    const s = Math.min(5_000, ms);
    if (s > 16) await page.clock.fastForward(s - 16);
    await page.clock.runFor(Math.min(16, s));
    ms -= s;
  }
}

/** Raw capture recipes. Each returns nothing; the caller screenshots the page. */
const SHOTS = {
  home: {
    theme: 'dark',
    stack: null,
    async run(page) {
      // short landscape tablets: lead with the timer grid rather than the header
      const vp = page.viewportSize();
      if (vp.width >= 700 && vp.height < 900) await scrollTo(page, '.home__grid', 0.11);
      await settle(page, 400);
    },
  },
  tabata: {
    theme: 'dark',
    stack: (c) => [{ name: 'home' }, { name: 'run', config: c.morningTabata }],
    async run(page) {
      await startRun(page);
      // 10 s get-ready, rounds 1–2 (2 × 30 s), then 13 s into round 3 work → 0:07 left
      await advance(page, 10_000 + 60_000 + 13_200);
      await settle(page);
    },
  },
  amrap: {
    theme: 'dark',
    stack: (c) => [{ name: 'home' }, { name: 'run', config: c.burner }],
    async run(page) {
      await startRun(page);
      await advance(page, 10_000);
      for (const split of [47_300, 49_100, 51_600, 52_900, 52_600]) {
        await advance(page, split);
        await page.click('.tile--rounds');
      }
      await advance(page, 4_900); // 4:18.4 elapsed → 7:42 left
      await settle(page);
    },
  },
  emom: {
    theme: 'light',
    stack: (c) => [{ name: 'home' }, { name: 'configure', mode: 'emom', initial: c.strength }],
    async run(page) {
      // bring the rotating movements (Strength, Burpees, Rest, Core) above the Save/Start bar
      await scrollTo(page, '.cfg-moves__list', 0.86, 'bottom');
      await settle(page, 400);
    },
  },
  custom: {
    theme: 'light',
    stack: (c) => [{ name: 'home' }, { name: 'configure', mode: 'custom', initial: c.runSwing }],
    async run(page) {
      if (page.viewportSize().width < 700) await scrollTo(page, '.cfg__tagline', 0.22); // phones: show more steps
      await settle(page, 400);
    },
  },
  history: {
    theme: 'light',
    stack: () => [{ name: 'home' }, { name: 'history' }],
    async run(page) {
      // For Time filter: yesterday's PR (badge) above an expanded earlier attempt with its round splits.
      // (An expanded PR row loses its badge colour — see report — so the open row is a non-PR attempt.)
      if (page.viewportSize().width >= 700) {
        // tablets: the full overview (stats, 8-week chart, both PR cards, PR badge in the list)
        await settle(page, 400);
        return;
      }
      await page.locator('.hist-chip').nth(3).click();
      await page.locator('.hist-row').nth(1).locator('.hist-row__main').click();
      await page.clock.runFor(400);
      await settle(page, 500);
      // phones: scroll to the records; tablets have room for the weekly chart too
      if (page.viewportSize().width < 700) await scrollTo(page, '.hist-records', 0.15);
      await settle(page, 300);
    },
  },
  settings: {
    theme: 'dark',
    stack: () => [{ name: 'home' }, { name: 'settings' }],
    async run(page) {
      await scrollTo(page, '.settings__packs', 0.42); // keeps the 'Play over music' hint (names a third-party app) out of frame
      await settle(page, 400);
    },
  },
  finish: {
    theme: 'dark',
    stack: (c) => [{ name: 'home' }, { name: 'run', config: c.engine }],
    async run(page) {
      await startRun(page);
      await advance(page, 10_000);
      for (const split of [168_200, 171_900, 174_600, 176_000, 181_700]) {
        await advance(page, split);
        await page.click('.tile--rounds');
      }
      await page.clock.runFor(100);
      await page.waitForTimeout(150);
      // Freeze the confetti burst mid-flight; let everything else finish.
      await page.evaluate(() => {
        for (const a of document.getAnimations()) {
          const el = a.effect && a.effect.target;
          if (el && el.classList && el.classList.contains('confetti__p')) {
            a.pause();
            a.currentTime = 520;
          } else {
            try {
              a.finish();
            } catch {
              /* infinite */
            }
          }
        }
      });
      await page.waitForTimeout(100);
    },
  },
};
SHOTS.amrapLand = SHOTS.amrap;
/** AMRAP in "big clock" focus mode (tap the clock): secondary chrome hidden. */
SHOTS.amrapFocus = {
  theme: 'dark',
  stack: SHOTS.amrap.stack,
  async run(page) {
    await SHOTS.amrap.run(page);
    await page.click('.stage');
    await page.clock.runFor(16);
    await settle(page);
  },
};

function deviceGeom(P, shotId) {
  let [w, h] = P.device;
  const land = P.kind === 'tablet' || shotId === 'amrapLand';
  if (land && h > w) [w, h] = [h, w];
  const phoneLand = land && P.kind === 'phone';
  const insets = { top: phoneLand ? 0 : P.sb, bottom: P.os === 'ios' ? (phoneLand ? 21 : P.kind === 'tablet' ? 20 : 34) : 0 };
  return { w, h, insets };
}

async function captureRaw(browser, shotId, platformId, locale) {
  const P = PLATFORMS[platformId];
  const L = D.LOCALES[locale];
  const recipe = SHOTS[shotId];
  const c = D.cfgs(L.lang);
  const { w, h, insets } = deviceGeom(P, shotId);
  const { ctx, page } = await newAppPage(browser, {
    width: w,
    height: h,
    dsf: P.dsf,
    lang: L.lang,
    bcp: L.bcp,
    theme: recipe.theme,
    stack: recipe.stack ? recipe.stack(c) : null,
    insets,
  });
  await recipe.run(page);
  // sanity: never ship onboarding or a blank page
  const bad = await page.evaluate(() => {
    if (document.querySelector('.onb, .onboarding, [class*="onboard"]')) return 'onboarding visible';
    if ((document.getElementById('root')?.innerText || '').trim().length < 5) return 'blank screen';
    return '';
  });
  if (bad) throw new Error(`${platformId}/${locale}/${shotId}: ${bad}`);
  const out = path.join(RAW, platformId, locale, `${shotId}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  await ctx.close();
  return out;
}

// ------------------------------------------------------------------ lock-screen data
const NOW_WORD = { en: 'now', nb: 'nå', de: 'jetzt', es: 'ahora', fr: 'maintenant' };
const AGO = { en: (n) => `${n}s ago`, nb: (n) => `for ${n} s siden`, de: (n) => `vor ${n} s`, es: (n) => `hace ${n} s`, fr: (n) => `il y a ${n} s` };

/** Real notification texts from the app's own planner (src/native/schedule.ts), in the app language. */
async function lockData(browser, locale) {
  const L = D.LOCALES[locale];
  const ctx = await browser.newContext({ locale: L.bcp, timezoneId: D.TZ });
  const page = await ctx.newPage();
  await page.goto(APP);
  const cfg = D.cfgs(L.lang).morningTabata;
  const alerts = await page.evaluate(
    async ({ cfg, lang }) => {
      const { compile } = await import('/src/engine/compile.ts');
      const { translator } = await import('/src/i18n/core.ts');
      const { planAlerts } = await import('/src/native/schedule.ts');
      const tr = translator(lang);
      const segs = compile(cfg, 10, tr);
      // phone locked during round 3 work (segment index: prep, w1, r1, w2, r2, w3 …)
      const idx = segs.findIndex((sg) => sg.kind === 'work' && sg.round === 3);
      return planAlerts(segs, idx, 0, 4, tr).map((a) => ({ title: a.title, body: a.body }));
    },
    { cfg, lang: L.lang },
  );
  const date = new Date(D.NOW).toLocaleDateString(L.bcp, { weekday: 'long', day: 'numeric', month: 'long', timeZone: D.TZ });
  await ctx.close();
  // Delivered stack, newest on top: "Work — Round 4/8" (now), "Rest — 0:10" (10 s earlier)
  const [rest, work] = alerts;
  return {
    date: date.charAt(0).toUpperCase() + date.slice(1),
    notes: [
      { ...work, ago: NOW_WORD[L.lang] },
      { ...rest, ago: AGO[L.lang](10) },
    ],
  };
}

// ------------------------------------------------------------------ compose
const FRAME_URL = 'file://' + path.join(ROOT, 'src', 'frame.html');

async function compose(framePage, spec, out) {
  const [CW, CH] = spec.canvas;
  await framePage.setViewportSize({ width: CW, height: CH });
  await framePage.goto(FRAME_URL);
  const info = await framePage.evaluate((sp) => window.renderFrame(sp), spec);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await framePage.screenshot({ path: out, clip: { x: 0, y: 0, width: CW, height: CH }, omitBackground: false });
  return info;
}

/** Strip any alpha: Playwright PNGs are RGBA; re-encode as RGB via a canvas-free path (pure JS). */
function pngToRgb(file) {
  const zlib = require('zlib');
  const buf = fs.readFileSync(file);
  let off = 8;
  let ihdr, idat = [];
  const chunks = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idat.push(data);
    chunks.push(type);
    off += 12 + len;
  }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), depth = ihdr[8], ctype = ihdr[9];
  if (ctype === 2) return; // already RGB
  if (depth !== 8 || ctype !== 6) throw new Error(`unexpected PNG format ${depth}/${ctype} in ${file}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * (1 + w * 3));
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    const o = y * (1 + w * 3);
    out[o] = 0;
    for (let x = 0; x < w; x++) {
      // composite over black (frames are fully opaque anyway)
      const al = cur[x * 4 + 3] / 255;
      out[o + 1 + x * 3] = Math.round(cur[x * 4] * al);
      out[o + 2 + x * 3] = Math.round(cur[x * 4 + 1] * al);
      out[o + 3 + x * 3] = Math.round(cur[x * 4 + 2] * al);
    }
    [prev, cur] = [cur, prev];
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const hdr = Buffer.alloc(13); hdr.writeUInt32BE(w, 0); hdr.writeUInt32BE(h, 4); hdr[8] = 8; hdr[9] = 2; hdr[10] = 0; hdr[11] = 0; hdr[12] = 0;
  const png = Buffer.concat([buf.subarray(0, 8), chunk('IHDR', hdr), chunk('IDAT', zlib.deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(file, png);
}

function framesFor(platformId) {
  const P = PLATFORMS[platformId];
  if (P.kind === 'tablet') return TABLET_FRAMES;
  return PHONE_FRAMES.filter((f) => !(f.iosOnly && P.os !== 'ios'));
}

// ------------------------------------------------------------------ main
const LIGHT_SHOTS = new Set(['emom', 'custom', 'history']);

(async () => {
  const browser = await chromium.launch();
  const framePage = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  const written = [];
  for (const locale of LOCALE_LIST) {
    const lock = await lockData(browser, locale);
    for (const platformId of PLATFORM_LIST) {
      const P = PLATFORMS[platformId];
      const frames = framesFor(platformId).filter((f) => !ONLY || ONLY.includes(f.shot) || ONLY.includes(f.slug));
      const shots = [...new Set(frames.map((f) => (f.shot === 'lock' ? 'tabata' : f.shot)))];
      for (const shot of shots) {
        const rawFile = path.join(RAW, platformId, locale, `${shot}.png`);
        if (REUSE_RAW && fs.existsSync(rawFile)) continue;
        const t0 = Date.now();
        await captureRaw(browser, shot, platformId, locale);
        console.log(`raw  ${platformId} ${locale} ${shot} ${Date.now() - t0}ms`);
      }
      if (RAW_ONLY) continue;
      const all = framesFor(platformId);
      for (const f of frames) {
        const n = String(all.indexOf(f) + 1).padStart(2, '0');
        const out = path.join(ROOT, platformId, locale, `${n}-${f.slug}.png`);
        const rawShot = f.shot === 'lock' ? 'tabata' : f.shot;
        const g = deviceGeom(P, rawShot);
        const spec = {
          canvas: P.canvas,
          kind: P.kind,
          os: P.os,
          device: [g.w, g.h],
          landscape: !!f.landscape,
          sb: g.insets.top,
          radius: P.radius,
          bg: f.bg,
          caption: D.CAPTIONS[f.caption][locale],
          screen: 'file://' + path.join(RAW, platformId, locale, `${rawShot}.png`),
          statusDark: LIGHT_SHOTS.has(rawShot),
          lock: f.shot === 'lock' ? lock : null,
        };
        const info = await compose(framePage, spec, out);
        pngToRgb(out);
        written.push(out);
        if (info.capLeft < P.canvas[0] * 0.04 || info.capRight > P.canvas[0] * 0.96) console.warn('  caption near edge', out);
        if (info.capBottom > info.devTopVisible) console.warn('  caption overlaps device', out);
        console.log(`frame ${path.relative(ROOT, out)}  caption ${Math.round(info.fontSize)}px`);
      }
    }
    if (!RAW_ONLY) await overview(framePage, locale);
  }
  await browser.close();
  console.log(`done: ${written.length} frames`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** Contact sheet of every frame for one locale: overview-<locale>.png */
async function overview(page, locale) {
  const rows = [];
  for (const platformId of Object.keys(PLATFORMS)) {
    const dir = path.join(ROOT, platformId, locale);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    if (files.length) rows.push({ platformId, files: files.map((f) => 'file://' + path.join(dir, f)) });
  }
  const H = 420;
  const html = `<html><body style="margin:0;background:#1b1b1e;font:600 22px Inter,sans-serif;color:#eee;padding:24px">
    <div style="font-size:30px;margin-bottom:16px">Pulse store screenshots · ${locale}</div>
    ${rows.map((r) => `<div style="margin:18px 0 6px">${r.platformId}</div><div style="display:flex;gap:12px;flex-wrap:nowrap">${r.files.map((f) => `<img src="${f}" style="height:${H}px;border-radius:6px">`).join('')}</div>`).join('')}
  </body></html>`;
  await page.setViewportSize({ width: 2400, height: 800 });
  await page.setContent(html);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  const w = await page.evaluate(() => Math.max(document.body.scrollWidth, 1200));
  await page.setViewportSize({ width: w + 48, height: 800 });
  const out = path.join(ROOT, `overview-${locale}.png`);
  await page.screenshot({ path: out, fullPage: true });
  pngToRgb(out);
  console.log('overview', path.relative(ROOT, out));
}
