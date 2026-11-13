/**
 * speechSynthesis wrapper. Guarded for SSR/jsdom; never throws or blocks.
 */

let voice: SpeechSynthesisVoice | null = null;
let voicesHooked = false;

function synth(): SpeechSynthesis | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
    return window.speechSynthesis ?? null;
  } catch {
    return null;
  }
}

const PREFERRED = [
  'Samantha',
  'Google US English',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Karen',
  'Daniel',
  'Google UK English Female',
  'Alex',
];

function pickVoice(s: SpeechSynthesis): void {
  try {
    const all = s.getVoices?.() ?? [];
    const en = all.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
    if (!en.length) {
      voice = null;
      return;
    }
    const navLang = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() : '';
    const score = (v: SpeechSynthesisVoice) => {
      let sc = 0;
      const i = PREFERRED.findIndex((n) => v.name.includes(n));
      if (i >= 0) sc += 50 - i;
      if (navLang && v.lang.toLowerCase().replace('_', '-') === navLang) sc += 20;
      if (v.lang.toLowerCase().includes('us')) sc += 5;
      if (v.localService) sc += 8; // local voices have far less latency
      if (v.default) sc += 3;
      if (/compact|novelty|whisper|bad news|bells|zarvox|trinoids/i.test(v.name)) sc -= 40;
      return sc;
    };
    voice = en.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
  } catch {
    voice = null;
  }
}

function ensureVoices(s: SpeechSynthesis): void {
  if (!voice) pickVoice(s);
  if (voicesHooked) return;
  voicesHooked = true;
  try {
    s.addEventListener?.('voiceschanged', () => pickVoice(s));
  } catch {
    /* ignore */
  }
}

/** Speak an empty utterance inside a user gesture so later speech works on iOS. */
export function primeSpeech(): void {
  const s = synth();
  if (!s) return;
  ensureVoices(s);
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  } catch {
    /* ignore */
  }
}

/** Speak a short phrase, replacing anything queued. */
export function say(text: string, volume = 1): void {
  const s = synth();
  if (!s || !text) return;
  ensureVoices(s);
  try {
    if (s.speaking || s.pending) s.cancel();
    // Some engines stay paused after the page was backgrounded.
    if (s.paused) s.resume();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = 'en-US';
    }
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = Math.min(1, Math.max(0.15, Number.isFinite(volume) ? volume : 1));
    u.onerror = () => {};
    s.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeech(): void {
  const s = synth();
  if (!s) return;
  try {
    s.cancel();
  } catch {
    /* ignore */
  }
}
