import { useRef, type KeyboardEvent } from 'react';
import { previewPack } from '../audio/synth';
import { useT } from '../i18n';
import { SOUND_PACKS, updateSettings, useSettings, type SoundPack } from '../state/store';
import './features.css';

/** Tiny glyph per pack so the list scans at a glance. */
function PackGlyph({ pack }: { pack: SoundPack }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: 'false' as const };
  switch (pack) {
    case 'classic':
      return (
        <svg {...common}>
          <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2" />
        </svg>
      );
    case 'boxing':
      return (
        <svg {...common}>
          <path d="M6 16c0-5 2.5-9 6-9s6 4 6 9z" />
          <path d="M4.5 16h15M12 7V4.5M10.5 19a1.5 1.5 0 0 0 3 0" />
        </svg>
      );
    case 'whistle':
      return (
        <svg {...common}>
          <circle cx="9" cy="14" r="5" />
          <path d="M12.5 10.5L21 7v4l-5.5 1.5M17 4l1-1.5M20 5.5l1.5-1" />
        </svg>
      );
    case 'soft':
      return (
        <svg {...common}>
          <path d="M3 15c3-6 6 6 9 0s6 6 9 0" />
        </svg>
      );
    case 'digital':
      return (
        <svg {...common}>
          <rect x="5" y="6" width="14" height="12" rx="3" />
          <path d="M9 3.5h6M9 20.5h6M9 12h1.5M13.5 12H15" />
        </svg>
      );
  }
}

/**
 * Sound style picker: an accessible radiogroup. Choosing a style (tap, or
 * arrow keys) selects it and plays a 3-2-1-go preview in that style.
 */
export function SoundPackPicker({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  const s = useSettings();
  const ref = useRef<HTMLDivElement>(null);

  const choose = (p: SoundPack, focus = false) => {
    updateSettings({ soundPack: p });
    previewPack(p, s.volume > 0 ? s.volume : 0.6);
    if (focus) ref.current?.querySelector<HTMLButtonElement>(`[data-pack="${p}"]`)?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    const i = SOUND_PACKS.indexOf(s.soundPack);
    let n = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % SOUND_PACKS.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + SOUND_PACKS.length) % SOUND_PACKS.length;
    if (n < 0) return;
    e.preventDefault();
    choose(SOUND_PACKS[n], true);
  };

  return (
    <div
      ref={ref}
      className={`fx-packs${compact ? ' fx-packs--compact' : ''}`}
      role="radiogroup"
      aria-label={t('settings.soundPack')}
      onKeyDown={onKey}
    >
      {SOUND_PACKS.map((p) => {
        const on = s.soundPack === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-pack={p}
            className={`fx-pack is-${p}${on ? ' is-active' : ''}`}
            onClick={() => choose(p)}
          >
            <span className="fx-pack__glyph">
              <PackGlyph pack={p} />
            </span>
            <span className="fx-pack__text">
              <span className="fx-pack__name">{t(`pack.${p}`)}</span>
              {!compact && <span className="fx-pack__desc">{t(`pack.${p}.desc`)}</span>}
            </span>
            <span className="fx-pack__play" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}
