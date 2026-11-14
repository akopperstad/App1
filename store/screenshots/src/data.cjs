// Seed data, localized names and captions for the store screenshots.
// Used by ../render.cjs. Everything here is fictional but realistic.

/** "Now" for every capture: Thursday 12 Nov 2026, 18:40 in Europe/Oslo (UTC+1). */
const NOW = Date.UTC(2026, 10, 12, 17, 40, 0);
const TZ = 'Europe/Oslo';
const DAY = 86_400_000;

const LOCALES = {
  'en-US': { lang: 'en', bcp: 'en-US' },
  'nb-NO': { lang: 'nb', bcp: 'nb-NO' },
  'de-DE': { lang: 'de', bcp: 'de-DE' },
  'es-ES': { lang: 'es', bcp: 'es-ES' },
  'fr-FR': { lang: 'fr', bcp: 'fr-FR' },
};

/** User-entered names (presets, steps, movements) as a user of that language would type them. */
const NAMES = {
  morningTabata: { en: 'Morning Tabata', nb: 'Morgen-Tabata', de: 'Morgen-Tabata', es: 'Tabata matinal', fr: 'Tabata du matin' },
  engine: { en: 'Engine Builder', nb: 'Kondisbygger', de: 'Ausdauer-Booster', es: 'Motor y fondo', fr: 'Moteur & cardio' },
  hills: { en: 'Hill Sprints', nb: 'Bakkeintervaller', de: 'Bergsprints', es: 'Cuestas', fr: 'Sprints en côte' },
  burner: { en: 'Burner 12', nb: 'Svetteøkt 12', de: 'Brenner 12', es: 'Quemador 12', fr: 'Brûleur 12' },
  strength: { en: 'Strength EMOM', nb: 'Styrke-EMOM', de: 'Kraft-EMOM', es: 'EMOM de fuerza', fr: 'EMOM force' },
  lunch: { en: 'Lunch Intervals', nb: 'Lunsjintervaller', de: 'Mittagsintervalle', es: 'Intervalos de mediodía', fr: 'Intervalles du midi' },
  plank: { en: 'Plank', nb: 'Planke', de: 'Unterarmstütz', es: 'Plancha', fr: 'Gainage' },
  runSwing: { en: 'Run & Swing', nb: 'Løp & sving', de: 'Lauf & Swing', es: 'Carrera y swings', fr: 'Course & swings' },
  // step / movement labels
  run400: { en: 'Run 400 m', nb: 'Løp 400 m', de: '400 m laufen', es: 'Correr 400 m', fr: 'Course 400 m' },
  rest: { en: 'Rest', nb: 'Pause', de: 'Pause', es: 'Descanso', fr: 'Repos' },
  kbs: { en: 'Kettlebell swings', nb: 'Kettlebell-sving', de: 'Kettlebell-Swings', es: 'Swings con kettlebell', fr: 'Swings kettlebell' },
  mStrength: { en: 'Strength', nb: 'Styrke', de: 'Kraft', es: 'Fuerza', fr: 'Force' },
  mBurpees: { en: 'Burpees', nb: 'Burpees', de: 'Burpees', es: 'Burpees', fr: 'Burpees' },
  mCore: { en: 'Core', nb: 'Mage', de: 'Rumpf', es: 'Abdominales', fr: 'Gainage' },
};

function cfgs(lang) {
  const n = (k) => NAMES[k][lang];
  return {
    morningTabata: { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 60, movements: [], name: n('morningTabata') },
    engine: { mode: 'fortime', capSec: 20 * 60, targetRounds: 5, name: n('engine') },
    hills: { mode: 'interval', workSec: 30, restSec: 90, rounds: 8, sets: 1, restBetweenSetsSec: 0, movements: [], name: n('hills') },
    burner: { mode: 'amrap', durationSec: 12 * 60, sets: 1, restBetweenSetsSec: 0, name: n('burner') },
    strength: { mode: 'emom', intervalSec: 60, rounds: 20, movements: [n('mStrength'), n('mBurpees'), n('rest'), n('mCore')], name: n('strength') },
    lunch: { mode: 'interval', workSec: 40, restSec: 20, rounds: 10, sets: 2, restBetweenSetsSec: 60, movements: [], name: n('lunch') },
    plank: { mode: 'countdown', durationSec: 180, name: n('plank') },
    runSwing: {
      mode: 'custom',
      rounds: 3,
      restBetweenRoundsSec: 0,
      steps: [
        { id: 'st1', label: n('run400'), kind: 'work', durationSec: 0 },
        { id: 'st2', label: n('rest'), kind: 'rest', durationSec: 90 },
        { id: 'st3', label: n('kbs'), kind: 'work', durationSec: 60 },
      ],
      name: n('runSwing'),
    },
  };
}

/** Local (Oslo, UTC+1 in Nov) wall time `daysAgo` days before NOW at hh:mm. */
function at(daysAgo, hh, mm) {
  const d = new Date(NOW - daysAgo * DAY);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh - 1, mm, 0);
}

const cum = (splitsSec) => {
  let t = 0;
  return splitsSec.map((s) => (t += Math.round(s * 1000)));
};

function history(lang) {
  const c = cfgs(lang);
  const out = [];
  let i = 0;
  const add = (key, daysAgo, hh, mm, durationMs, extra = {}) =>
    out.push({
      id: `h${++i}`,
      name: c[key].name,
      mode: c[key].mode,
      config: c[key],
      startedAt: at(daysAgo, hh, mm),
      durationMs,
      completed: true,
      rounds: 0,
      roundTimesMs: [],
      laps: [],
      ...extra,
    });
  const tabata = (d) => add('morningTabata', d, 7, 5, 230_000, { rounds: 8 });
  const engine = (d, splits) => {
    const r = cum(splits);
    add('engine', d, 18, 20, r[r.length - 1], { rounds: splits.length, roundTimesMs: r });
  };
  const burner = (d, splits) => add('burner', d, 18, 5, 720_000, { rounds: splits.length, roundTimesMs: cum(splits) });

  // newest first
  tabata(0);
  engine(1, [168.2, 171.9, 174.6, 176.0, 181.7]); // 14:32.4 — PR
  add('hills', 2, 7, 10, 870_000, { rounds: 8 });
  burner(3, [92, 97, 99, 101, 103, 104, 107]); // 7 rounds — PR
  add('plank', 4, 10, 30, 180_000);
  add('runSwing', 5, 9, 45, 1_302_000, { rounds: 3 });
  tabata(6);
  add('strength', 7, 18, 30, 1_200_000, { rounds: 20 });
  engine(8, [176.4, 180.2, 183.0, 185.1, 185.3]); // 15:10.0 — expanded in the History shot
  add('lunch', 9, 12, 5, 451_000, { completed: false, rounds: 7 });
  burner(10, [98, 104, 108, 110, 113, 116]);
  add('hills', 12, 9, 30, 870_000, { rounds: 8 });
  tabata(13);
  add('strength', 14, 18, 15, 1_200_000, { rounds: 20 });
  engine(15, [176.0, 179.6, 182.1, 184.0, 183.3]); // 15:05.0 (so 15:10 below is not a PR)
  burner(17, [101, 107, 111, 114, 118, 121]);
  add('runSwing', 19, 10, 0, 1_356_000, { rounds: 3 });
  tabata(20);
  add('lunch', 21, 12, 10, 1_260_000, { rounds: 20 });
  // older, sparser weeks so the 8-week chart has shape
  const older = [
    ['hills', 23], ['morningTabata', 25], ['strength', 27], ['burner', 29], ['runSwing', 31], ['lunch', 34],
    ['strength', 36], ['hills', 38], ['morningTabata', 41], ['lunch', 43], ['strength', 46], ['hills', 48], ['runSwing', 52],
  ];
  for (const [k, d] of older) {
    if (k === 'morningTabata') tabata(d);
    else if (k === 'burner') burner(d, [104, 109, 113, 117, 120, 125]);
    else {
      const dur = { hills: 870_000, strength: 1_200_000, runSwing: 1_390_000, lunch: 1_260_000 }[k];
      add(k, d, 18, 0, dur, { rounds: k === 'runSwing' ? 3 : k === 'hills' ? 8 : 20 });
    }
  }
  return out;
}

function presets(lang) {
  const c = cfgs(lang);
  const order = ['morningTabata', 'engine', 'hills', 'burner', 'runSwing'];
  return order.map((k, idx) => ({ id: `p-${k}`, name: c[k].name, config: c[k], createdAt: NOW - (idx + 3) * DAY }));
}

function settings(lang, theme) {
  return {
    prepSec: 10,
    sound: true,
    volume: 0.8,
    voice: true,
    vibration: true,
    keepAwake: true,
    countdownBeeps: true,
    milestoneCues: true,
    showTenths: true,
    countDownDisplay: true,
    theme,
    flashOnChange: true,
    soundPack: 'classic',
    backgroundAlerts: true,
    mixWithMusic: true,
    language: lang,
    onboarded: true,
  };
}

// ------------------------------------------------------------------ captions
// **word** = coral highlight. Keep each under ~40 characters.
const CAPTIONS = {
  home: {
    'en-US': 'Every timer your **training** needs',
    'nb-NO': 'Alle timerne **treningen** din trenger',
    'de-DE': 'Jeder Timer, den dein **Training** braucht',
    'es-ES': 'Todos los temporizadores para tu **entreno**',
    'fr-FR': 'Tous les minuteurs pour ton **entraînement**',
  },
  tabata: {
    'en-US': 'Hear every **interval**',
    'nb-NO': 'Hør hvert **intervall**',
    'de-DE': 'Hör jedes **Intervall**',
    'es-ES': 'Oye cada **intervalo**',
    'fr-FR': 'Entends chaque **intervalle**',
  },
  locked: {
    'en-US': 'Cues even with the phone **locked**',
    'nb-NO': 'Varsler selv når mobilen er **låst**',
    'de-DE': 'Signale auch bei **gesperrtem** Handy',
    'es-ES': 'Avisos incluso con el móvil **bloqueado**',
    'fr-FR': 'Des signaux même téléphone **verrouillé**',
  },
  across: {
    'en-US': 'Read it from **across the gym**',
    'nb-NO': 'Lett å lese fra **andre siden** av gymmet',
    'de-DE': 'Lesbar **quer durch** die Halle',
    'es-ES': 'Se lee desde el **otro lado** del box',
    'fr-FR': "Lisible à **l'autre bout** de la salle",
  },
  emom: {
    'en-US': 'EMOM, E2MOM, **any interval**',
    'nb-NO': 'EMOM, E2MOM, **alle intervaller**',
    'de-DE': 'EMOM, E2MOM, **jedes Intervall**',
    'es-ES': 'EMOM, E2MOM, **cualquier intervalo**',
    'fr-FR': 'EMOM, E2MOM, **tous les intervalles**',
  },
  custom: {
    'en-US': 'Build **any** workout',
    'nb-NO': 'Bygg **din egen** økt',
    'de-DE': 'Bau dein **eigenes** Workout',
    'es-ES': 'Crea **cualquier** entrenamiento',
    'fr-FR': "Crée **n'importe quelle** séance",
  },
  history: {
    'en-US': 'Rounds, splits & **PRs**',
    'nb-NO': 'Runder, mellomtider og **rekorder**',
    'de-DE': 'Runden, Zwischenzeiten & **Bestzeiten**',
    'es-ES': 'Rondas, parciales y **récords**',
    'fr-FR': 'Tours, temps et **records**',
  },
  settings: {
    'en-US': 'Your sound. **Your language.**',
    'nb-NO': 'Din lyd. **Ditt språk.**',
    'de-DE': 'Dein Sound. **Deine Sprache.**',
    'es-ES': 'Tu sonido. **Tu idioma.**',
    'fr-FR': 'Ton son. **Ta langue.**',
  },
  finish: {
    'en-US': 'Every finish, **every split**',
    'nb-NO': 'Hver økt, **hver mellomtid**',
    'de-DE': 'Jedes Finish, **jede Zwischenzeit**',
    'es-ES': 'Cada final, **cada parcial**',
    'fr-FR': 'Chaque séance, **chaque temps**',
  },
  bigscreen: {
    'en-US': 'Built for the **big screen**',
    'nb-NO': 'Laget for **store skjermer**',
    'de-DE': 'Gemacht für **große Displays**',
    'es-ES': 'Hecho para **pantallas grandes**',
    'fr-FR': 'Pensé pour **les grands écrans**',
  },
};

module.exports = { NOW, TZ, DAY, LOCALES, NAMES, cfgs, history, presets, settings, CAPTIONS };
