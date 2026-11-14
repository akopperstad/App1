import { useEffect, useState, type CSSProperties } from 'react';
import { localizedDefaults, modeInfo, modeTagline, modeTitle } from '../engine/modes';
import { useT } from '../i18n';
import type { Mode, WorkoutConfig } from '../engine/types';
import { useNav } from '../nav';
import { lastConfigStore, presetsStore, rememberConfig, savePreset, usePresets } from '../state/store';
import { Button, Icon, Sheet, TopBar, modeIcon } from '../components/ui';
import { ShareButton } from '../features/shareActions';
import { useWide } from '../lib/useMediaQuery';
import { ModeForm } from './configure/forms';
import { problems, sanitize } from './configure/sanitize';
import { startWorkout } from './configure/start';
import { Summary } from './configure/Summary';
import './Configure.css';

export interface ConfigureProps {
  mode: Mode;
  initial?: WorkoutConfig;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function Configure({ mode, initial }: ConfigureProps) {
  const nav = useNav();
  const info = modeInfo(mode);
  const tr = useT();
  const { t } = tr;
  const modeName = modeTitle(mode, tr);
  const presets = usePresets();
  const wide = useWide();

  const [config, setConfig] = useState<WorkoutConfig>(() => {
    const defaults = localizedDefaults(mode, tr);
    const src = initial ?? lastConfigStore.get()[mode] ?? defaults;
    // Guard against a stored config for a different mode shape.
    return sanitize(clone(src.mode === mode ? src : defaults));
  });

  // If we were opened from a user preset, remember which one so it can be updated.
  const [presetId, setPresetId] = useState<string | null>(() => {
    if (!initial) return null;
    const key = JSON.stringify(initial);
    return presetsStore.get().find((p) => JSON.stringify(p.config) === key)?.id ?? null;
  });
  const preset = presets.find((p) => p.id === presetId) ?? null;

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!savedFlash) return;
    const t = window.setTimeout(() => setSavedFlash(null), 2200);
    return () => window.clearTimeout(t);
  }, [savedFlash]);

  const update = (c: WorkoutConfig) => setConfig(sanitize(c));
  const issues = problems(config, tr);

  const start = () => {
    if (issues.length) return;
    rememberConfig(config);
    startWorkout(nav, config);
  };

  const openSave = () => {
    setName(preset?.name ?? config.name ?? '');
    setSaveOpen(true);
  };

  const trimmed = name.trim();
  const doSaveNew = () => {
    if (!trimmed) return;
    const p = savePreset(trimmed, config);
    setConfig({ ...config, name: trimmed });
    setPresetId(p.id);
    setSaveOpen(false);
    setSavedFlash(t('cfg.savedFlash', { name: trimmed }));
  };
  const doUpdate = () => {
    if (!trimmed || !preset) return;
    const next = { ...config, name: trimmed };
    presetsStore.set((list) => list.map((p) => (p.id === preset.id ? { ...p, name: trimmed, config: next } : p)));
    setConfig(next);
    setSaveOpen(false);
    setSavedFlash(t('cfg.updatedFlash', { name: trimmed }));
  };

  const title = config.name?.trim() || modeName;

  // Save / Start: a bar pinned to the bottom on phones, under the live summary in the side pane on tablets.
  const actions = (
    <div className="cfg-bar">
      <div className="cfg-bar__inner">
        {savedFlash && (
          <div className="cfg-toast" role="status">
            <Icon name="check" size={16} /> {savedFlash}
          </div>
        )}
        {issues.length > 0 && <p className="cfg-bar__issue" role="alert">{issues[0]}</p>}
        <div className="cfg-bar__row">
          <Button variant="secondary" size="lg" icon={preset ? 'save' : 'star'} onClick={openSave} aria-label={preset ? t('cfg.saveChanges') : t('cfg.saveWorkout')}>
            {preset ? t('cfg.update') : t('common.save')}
          </Button>
          <Button variant="primary" size="lg" icon="play" block onClick={start} disabled={issues.length > 0}>
            {t('common.start')}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ui-page cfg" style={{ '--accent': info.accent } as CSSProperties}>
      <div className="ui-page__inner">
        <TopBar title={<span className="cfg__bar-title">{modeName}</span>} right={<ShareButton config={config} />} />

        <div className="cfg__layout">
          <header className="cfg__hero">
            <span className="cfg__eyebrow">
              <span className="ui-glyph cfg__glyph" aria-hidden>
                <Icon name={modeIcon(mode)} size={16} strokeWidth={2.4} />
              </span>
              {config.name ? modeName : t('cfg.timer')}
              {preset && <span className="cfg__badge">{t('cfg.saved')}</span>}
            </span>
            <h2 className="cfg__title">{title}</h2>
            <p className="cfg__tagline">{modeTagline(mode, tr)}</p>
          </header>

          {/* Tablets: a sticky side pane (live summary + actions) next to the form. */}
          <div className="cfg__side">
            <Summary config={config} />
            {wide && actions}
          </div>

          <div className="cfg__form">
            <ModeForm config={config} onChange={update} />
          </div>
        </div>
      </div>

      {!wide && actions}

      <Sheet
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={preset ? t('cfg.saveWorkout') : t('cfg.saveAsWorkout')}
        footer={
          preset ? (
            <>
              <Button variant="secondary" onClick={doSaveNew} disabled={!trimmed}>
                {t('cfg.saveAsNew')}
              </Button>
              <Button variant="primary" icon="check" onClick={doUpdate} disabled={!trimmed}>
                {t('cfg.update')}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" icon="check" block onClick={doSaveNew} disabled={!trimmed}>
              {t('cfg.saveWorkout')}
            </Button>
          )
        }
      >
        <form
          className="cfg-save"
          onSubmit={(e) => {
            e.preventDefault();
            if (preset) doUpdate();
            else doSaveNew();
          }}
        >
          <label className="cfg-save__label" htmlFor="preset-name">
            {t('cfg.name')}
          </label>
          <input
            id="preset-name"
            className="ui-input cfg-save__input"
            value={name}
            maxLength={40}
            placeholder={t('cfg.namePlaceholder', { mode: modeName })}
            autoComplete="off"
            enterKeyHint="done"
            data-autofocus
            onChange={(e) => setName(e.target.value)}
          />
          <p className="cfg-save__hint">{t('cfg.saveHint')}</p>
        </form>
      </Sheet>
    </div>
  );
}
