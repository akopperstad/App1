import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNative, quietly } from '../native/platform';

/**
 * speechSynthesis wrapper. Guarded for SSR/jsdom; never throws or blocks.
 *
 * In the native app speech goes through the platform TTS engine
 * (AVSpeechSynthesizer / android.speech.tts) instead: speechSynthesis in
 * WKWebView is unreliable (silent after backgrounding, missing voices), and
 * the native engines mix with / briefly duck other audio rather than taking
 * permanent audio focus.
 */


/** Chosen voice per language tag (null = none available yet). */
const voices = new Map<string, SpeechSynthesisVoice | null>();
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

/** Best voice for a BCP-47 tag ("en-US", "nb-NO"...), matched on the primary language. */
function pickVoice(s: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  try {
    const want = lang.toLowerCase();
    const primary = want.split('-')[0];
    const all = s.getVoices?.() ?? [];
    const match = all.filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').split('-')[0] === primary);
    if (!match.length) return null;
    const navLang = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() : '';
    const score = (v: SpeechSynthesisVoice) => {
      const vl = v.lang.toLowerCase().replace('_', '-');
      let sc = 0;
      const i = PREFERRED.findIndex((n) => v.name.includes(n));
      if (i >= 0) sc += 50 - i;
      if (vl === want) sc += 25;
      if (navLang && vl === navLang) sc += 20;
      if (primary === 'en' && vl.includes('us')) sc += 5;
      if (v.localService) sc += 8; // local voices have far less latency
      if (v.default) sc += 3;
      if (/compact|novelty|whisper|bad news|bells|zarvox|trinoids/i.test(v.name)) sc -= 40;
      return sc;
    };
    return match.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
  } catch {
    return null;
  }
}

function voiceFor(s: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  if (!voicesHooked) {
    voicesHooked = true;
    try {
      s.addEventListener?.('voiceschanged', () => voices.clear());
    } catch {
      /* ignore */
    }
  }
  if (!voices.has(lang) || voices.get(lang) === null) voices.set(lang, pickVoice(s, lang));
  return voices.get(lang) ?? null;
}

/** Speak an empty utterance inside a user gesture so later speech works on iOS. */
export function primeSpeech(): void {
  if (isNative()) return; // native TTS needs no user-gesture unlock
  const s = synth();
  if (!s) return;
  voiceFor(s, 'en-US');
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  } catch {
    /* ignore */
  }
}

/**
 * Speak a short phrase, replacing anything queued.
 * `lang` is a BCP-47 tag (SpokenPhrases.speechLang) that picks the voice.
 */
export function say(text: string, volume = 1, lang = 'en-US'): void {
  if (!text) return;
  if (isNative()) {
    const v = Math.min(1, Math.max(0.15, Number.isFinite(volume) ? volume : 1));
    quietly(() =>
      TextToSpeech.speak({
        text,
        lang,
        rate: 1.0,
        pitch: 1.0,
        volume: v,
        category: 'playback',
        queueStrategy: QueueStrategy.Flush,
      }),
    );
    return;
  }
  const s = synth();
  if (!s) return;
  const voice = voiceFor(s, lang);
  try {
    if (s.speaking || s.pending) s.cancel();
    // Some engines stay paused after the page was backgrounded.
    if (s.paused) s.resume();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = lang;
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
  if (isNative()) {
    quietly(() => TextToSpeech.stop());
    return;
  }
  const s = synth();
  if (!s) return;
  try {
    s.cancel();
  } catch {
    /* ignore */
  }
}
