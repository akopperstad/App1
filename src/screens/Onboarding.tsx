import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cuePlayer } from '../audio/cues';
import { SoundPackPicker } from '../features/SoundPackPicker';
import { spokenPhrases, useT } from '../i18n';
import { updateSettings, useSettings } from '../state/store';
import { Button, Segmented, Toggle } from '../components/ui';
import './Onboarding.css';

const PREP_VALUES = [0, 5, 10, 15, 20];
const SLIDES = 3;

export interface OnboardingProps {
  /** Called after onboarded=true is saved (e.g. nav.back() when replayed from Settings). */
  onFinish?: () => void;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** First-run intro: three swipeable cards — what Pulse does, sound check, get-ready prefs. */
export function Onboarding({ onFinish }: OnboardingProps) {
  const { t, lang } = useT();
  const s = useSettings();
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [played, setPlayed] = useState(false);

  const finish = () => {
    updateSettings({ onboarded: true });
    onFinish?.();
  };

  const goTo = (i: number) => {
    const el = track.current;
    const n = Math.max(0, Math.min(SLIDES - 1, i));
    setIdx(n);
    if (!el) return;
    const left = n * el.clientWidth;
    try {
      el.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } catch {
      el.scrollLeft = left;
    }
  };

  // Keep idx in sync with swipes (scroll-snap does the physics).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        setIdx(Math.max(0, Math.min(SLIDES - 1, Math.round(el.scrollLeft / w))));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).getAttribute('role');
    if (tag === 'radio' || tag === 'switch') return; // let controls use arrows
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(idx + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(idx - 1);
    }
  };

  const soundCheck = () => {
    cuePlayer.unlock();
    cuePlayer.test({ ...s, sound: true, volume: s.volume > 0 ? s.volume : 0.8 });
    if (!s.sound || s.volume === 0) updateSettings({ sound: true, volume: s.volume > 0 ? s.volume : 0.8 });
    setPlayed(true);
  };

  const last = idx === SLIDES - 1;
  const prepOptions = PREP_VALUES.map((v) => ({ value: v, label: v === 0 ? t('common.off') : `${v}s` }));

  return (
    <div className="onb" role="region" aria-roledescription="carousel" aria-label={t('onb.label')} onKeyDown={onKey}>
      <div className="onb__glow" aria-hidden style={{ '--i': idx } as CSSProperties} />
      <header className="onb__top">
        <span className="onb__brand" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 12h4l2.5-6.5 5 13 2.5-6.5h5" />
          </svg>
          Pulse
        </span>
        {!last && (
          <button type="button" className="onb__skip" onClick={finish}>
            {t('common.skip')}
          </button>
        )}
      </header>

      <div className="onb__track" ref={track}>
        <Slide i={0} idx={idx} art={<ArtTimer />} eyebrow={t('onb.1.eyebrow')} title={t('onb.1.title')} body={t('onb.1.body')}>
          <ul className="onb__modes" aria-hidden>
            {(['amrap', 'emom', 'fortime', 'tabata', 'interval', 'deathby'] as const).map((m) => (
              <li key={m} style={{ '--accent': `var(--mode-${m})` } as CSSProperties}>
                {t(`mode.${m}`)}
              </li>
            ))}
          </ul>
        </Slide>

        <Slide i={1} idx={idx} art={<ArtSound playing={played} />} eyebrow={t('onb.2.eyebrow')} title={t('onb.2.title')} body={t('onb.2.body')}>
          <Button variant="primary" icon="volume" block onClick={soundCheck} className="onb__test">
            {t('onb.2.test')}
          </Button>
          <p className="onb__hint">{t('onb.2.hint')}</p>
          <SoundPackPicker compact />
          <div className="onb__row">
            <span>{t('settings.voice')}</span>
            <Toggle label={t('settings.voice')} checked={s.voice} onChange={(v) => updateSettings({ voice: v })} />
          </div>
        </Slide>

        <Slide i={2} idx={idx} art={<ArtPrep sec={s.prepSec} caption={spokenPhrases(lang).getReady.toUpperCase()} />} eyebrow={t('onb.3.eyebrow')} title={t('onb.3.title')} body={t('onb.3.body')}>
          <div className="onb__field">
            <span className="onb__field-label">{t('settings.prep')}</span>
            <Segmented label={t('settings.prep')} size="sm" value={PREP_VALUES.includes(s.prepSec) ? s.prepSec : 10} options={prepOptions} onChange={(v) => updateSettings({ prepSec: v })} />
          </div>
          <div className="onb__field">
            <span className="onb__field-label">{t('settings.theme')}</span>
            <Segmented
              label={t('settings.theme')}
              size="sm"
              value={s.theme}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'dark', label: t('settings.theme.dark') },
                { value: 'light', label: t('settings.theme.light') },
              ]}
              onChange={(v) => updateSettings({ theme: v })}
            />
          </div>
        </Slide>
      </div>

      <footer className="onb__foot">
        <div className="onb__dots" role="tablist" aria-label={t('onb.label')}>
          {Array.from({ length: SLIDES }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={t('onb.slide', { n: i + 1, total: SLIDES })}
              className={`onb__dot${i === idx ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <Button variant="primary" size="lg" block className="onb__next" onClick={() => (last ? finish() : goTo(idx + 1))}>
          {last ? t('onb.start') : t('common.next')}
        </Button>
      </footer>
    </div>
  );
}

function Slide({
  i,
  idx,
  art,
  eyebrow,
  title,
  body,
  children,
}: {
  i: number;
  idx: number;
  art: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const { t } = useT();
  const active = i === idx;
  return (
    <section
      className={`onb__slide${active ? ' is-active' : ''}`}
      role="group"
      aria-roledescription="slide"
      aria-label={t('onb.slide', { n: i + 1, total: SLIDES })}
      aria-hidden={!active}
      inert={!active}
    >
      <div className="onb__slide-inner">
        <div className="onb__art" aria-hidden>
          {art}
        </div>
        <p className="onb__eyebrow">{eyebrow}</p>
        <h1 className="onb__title">{title}</h1>
        <p className="onb__body">{body}</p>
        {children && <div className="onb__extra">{children}</div>}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ art

function ArtTimer() {
  return (
    <svg className="onb-art onb-art--timer" viewBox="0 0 200 200" width="200" height="200">
      <defs>
        <linearGradient id="onb-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--work)" />
          <stop offset="1" stopColor="var(--mode-fortime)" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="80" className="onb-art__track" />
      <circle cx="100" cy="100" r="80" className="onb-art__ring" stroke="url(#onb-g1)" />
      <circle cx="100" cy="100" r="64" className="onb-art__inner" />
      <text x="100" y="96" textAnchor="middle" className="onb-art__digits">
        12:00
      </text>
      <text x="100" y="124" textAnchor="middle" className="onb-art__caption">
        AMRAP
      </text>
    </svg>
  );
}

function ArtSound({ playing }: { playing: boolean }) {
  return (
    <svg className={`onb-art onb-art--sound${playing ? ' is-playing' : ''}`} viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="80" className="onb-art__halo" />
      <circle cx="100" cy="100" r="58" className="onb-art__halo onb-art__halo--2" />
      {[-36, -18, 0, 18, 36].map((x, i) => (
        <rect key={x} className="onb-art__bar" style={{ '--d': `${i * 110}ms` } as CSSProperties} x={100 + x - 5} y={70} width={10} height={60} rx={5} />
      ))}
    </svg>
  );
}

function ArtPrep({ sec, caption }: { sec: number; caption: string }) {
  return (
    <svg className="onb-art onb-art--prep" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="80" className="onb-art__track" />
      <circle cx="100" cy="100" r="80" className="onb-art__ring onb-art__ring--prep" />
      <text x="100" y="112" textAnchor="middle" className="onb-art__digits onb-art__digits--big">
        {sec || '0'}
      </text>
      <text x="100" y="140" textAnchor="middle" className="onb-art__caption">
        {caption}
      </text>
    </svg>
  );
}
