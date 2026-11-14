#!/usr/bin/env node
// Verifies every store screenshot: exact pixel size per platform, PNG colour type 2 (RGB, no alpha),
// and frame counts. Usage: node store/screenshots/check.cjs
const fs = require('fs');
const path = require('path');

const SIZES = {
  'ios-6.9': [1320, 2868],
  'ios-6.5': [1242, 2688],
  'ipad-13': [2752, 2064],
  'play-phone': [1080, 1920],
  'play-tablet-7': [1920, 1200],
  'play-tablet-10': [2560, 1600],
};
const MAX = { 'ios-6.9': 10, 'ios-6.5': 10, 'ipad-13': 10, 'play-phone': 8, 'play-tablet-7': 8, 'play-tablet-10': 8 };

let bad = 0, total = 0, bytes = 0;
for (const [pf, [w, h]] of Object.entries(SIZES)) {
  const dir = path.join(__dirname, pf);
  if (!fs.existsSync(dir)) { console.log(`${pf}: (none)`); continue; }
  const counts = [];
  for (const loc of fs.readdirSync(dir).sort()) {
    const files = fs.readdirSync(path.join(dir, loc)).filter((f) => f.endsWith('.png'));
    counts.push(`${loc}:${files.length}`);
    if (files.length > MAX[pf]) { console.log(`  TOO MANY ${pf}/${loc}`); bad++; }
    for (const f of files) {
      const p = path.join(dir, loc, f);
      const b = fs.readFileSync(p);
      total++; bytes += b.length;
      const W = b.readUInt32BE(16), H = b.readUInt32BE(20), depth = b[24], ctype = b[25];
      if (b.toString('ascii', 12, 16) !== 'IHDR' || W !== w || H !== h || depth !== 8 || ctype !== 2) {
        console.log(`  BAD ${pf}/${loc}/${f}: ${W}x${H} depth ${depth} colour type ${ctype}`);
        bad++;
      }
    }
  }
  console.log(`${pf} (${w}x${h}): ${counts.join('  ')}`);
}
console.log(`${total} files, ${(bytes / 1048576).toFixed(1)} MB, ${bad} problems`);
process.exit(bad ? 1 : 0);
