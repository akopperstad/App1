#!/usr/bin/env node
/**
 * Validates every store listing field in store/listing/*.md.
 *
 *   node store/check-limits.mjs          # exit 1 on any error
 *
 * Each listing file has "## App Store" / "## Google Play" sections and
 * "### <Field>" headings followed by one ```text fenced block (the value).
 * Lengths are counted conservatively: the larger of Unicode code points and
 * UTF-16 code units (App Store Connect counts UTF-16; Play counts characters).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'listing');

const LIMITS = {
  'App Store': {
    Name: { max: 30, min: 2, required: true },
    Subtitle: { max: 30, required: true },
    'Promotional text': { max: 170 },
    Keywords: { max: 100, required: true, keywords: true },
    Description: { max: 4000, required: true },
    "What's New": { max: 4000 },
  },
  'Google Play': {
    Title: { max: 30, required: true },
    'Short description': { max: 80, required: true },
    'Full description': { max: 4000, required: true },
  },
};

/** Words Play's metadata policy bans in title/short description (and that Apple dislikes in name/subtitle). */
const BANNED_SHORT = /\b(free|gratis|gratuit|kostenlos|gratuito|best|beste|meilleur|mejor|#1|no ads|top)\b/i;
/** Third-party trademarks we must not use anywhere in metadata. */
const TRADEMARKS = /crossfit|cross-fit|spotify|apple music|strava|garmin|fitbit/i;

const len = (s) => Math.max([...s].length, s.length);

function parse(md) {
  const out = {};
  let section = null;
  let field = null;
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if ((m = /^## (.+?)\s*$/.exec(l))) {
      section = m[1];
      field = null;
      continue;
    }
    if ((m = /^### (.+?)\s*$/.exec(l))) {
      field = m[1];
      continue;
    }
    if (section && field && /^```text\s*$/.test(l)) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      (out[section] ??= {})[field] = body.join('\n');
      field = null;
    }
  }
  return out;
}

let errors = 0;
let warnings = 0;
const err = (m) => (errors++, console.log(`  ERROR  ${m}`));
const warn = (m) => (warnings++, console.log(`  warn   ${m}`));

const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
if (!files.length) {
  console.error('No listing files found in', dir);
  process.exit(1);
}

for (const file of files) {
  const data = parse(readFileSync(join(dir, file), 'utf8'));
  console.log(`\n${file}`);
  for (const [section, fields] of Object.entries(LIMITS)) {
    for (const [name, rule] of Object.entries(fields)) {
      const v = data[section]?.[name];
      if (v === undefined) {
        if (rule.required) err(`${section} › ${name}: missing`);
        continue;
      }
      const n = len(v);
      const ok = n <= rule.max && (!rule.min || n >= rule.min);
      console.log(`  ${ok ? 'ok   ' : 'FAIL '}  ${section} › ${name}: ${n}/${rule.max}` + (rule.max <= 100 ? `  "${v}"` : ''));
      if (!ok) err(`${section} › ${name} is ${n} chars (max ${rule.max})`);
      if (v !== v.trim()) warn(`${section} › ${name} has leading/trailing whitespace`);
      if (TRADEMARKS.test(v)) err(`${section} › ${name} mentions a third-party trademark (${v.match(TRADEMARKS)[0]})`);
      if (rule.max <= 80 && BANNED_SHORT.test(v)) err(`${section} › ${name} contains promotional wording (${v.match(BANNED_SHORT)[0]})`);
      if (/\p{Extended_Pictographic}/u.test(v)) warn(`${section} › ${name} contains emoji`);

      if (rule.keywords) {
        if (/,\s|\s,/.test(v)) err('Keywords: no spaces around commas');
        const kws = v.split(',');
        if (kws.some((k) => !k)) err('Keywords: empty entry');
        const seen = new Set();
        for (const k of kws) {
          const key = k.toLowerCase();
          if (seen.has(key)) err(`Keywords: duplicate "${k}"`);
          seen.add(key);
        }
        // Apple already indexes name + subtitle; repeating those words wastes space.
        const indexed = `${data['App Store']?.Name ?? ''} ${data['App Store']?.Subtitle ?? ''}`
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean);
        for (const k of kws) if (indexed.includes(k.toLowerCase())) warn(`Keywords: "${k}" already in name/subtitle`);
      }
    }
  }
  const asName = data['App Store']?.Name;
  const gpTitle = data['Google Play']?.Title;
  if (asName && gpTitle && asName !== gpTitle) warn(`App Store name and Play title differ ("${asName}" vs "${gpTitle}")`);
}

console.log(`\n${files.length} listings, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
