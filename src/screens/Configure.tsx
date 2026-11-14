import { useEffect, useState, type CSSProperties } from 'react';
import { modeInfo } from '../engine/modes';
import type { Mode, WorkoutConfig } from '../engine/types';
import { useNav } from '../nav';
import { lastConfigStore, presetsStore, rememberConfig, savePreset, usePresets } from '../state/store';
import { Button, Icon, Sheet, TopBar, modeIcon } from '../components/ui';
import { ShareButton } from '../features/shareActions';
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
  const presets = usePresets();

  const [config, setConfig] = useState<WorkoutConfig>(() => {
    const src = initial ?? lastConfigStore.get()[mode] ?? info.defaults;
    // Guard against a stored config for a different mode shape.
    return sanitize(clone(src.mode === mode ? src : info.defaults));
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
  const issues = problems(config);

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
    setSavedFlash(`Saved “${trimmed}”`);
  };
  const doUpdate = () => {
    if (!trimmed || !preset) return;
    const next = { ...config, name: trimmed };
    presetsStore.set((list) => list.map((p) => (p.id === preset.id ? { ...p, name: trimmed, config: next } : p)));
    setConfig(next);
    setSaveOpen(false);
    setSavedFlash(`Updated “${trimmed}”`);
  };

  const title = config.name?.trim() || info.title;

  return (
    <div className="ui-page cfg" style={{ '--accent': info.accent } as CSSProperties}>
      <div className="ui-page__inner">
        <TopBar title={<span className="cfg__bar-title">{info.title}</span>} right={<ShareButton config={config} />} />

        <header className="cfg__hero">
          <span className="cfg__eyebrow">
            <span className="ui-glyph cfg__glyph" aria-hidden>
              <Icon name={modeIcon(mode)} size={16} strokeWidth={2.4} />
            </span>
            {config.name ? info.title : 'Timer'}
            {preset && <span className="cfg__badge">Saved</span>}
          </span>
          <h2 className="cfg__title">{title}</h2>
          <p className="cfg__tagline">{info.tagline}</p>
        </header>

        <Summary config={config} />

        <ModeForm config={config} onChange={update} />
      </div>

      <div className="cfg-bar">
        <div className="cfg-bar__inner">
          {savedFlash && (
            <div className="cfg-toast" role="status">
              <Icon name="check" size={16} /> {savedFlash}
            </div>
          )}
          {issues.length > 0 && <p className="cfg-bar__issue" role="alert">{issues[0]}</p>}
          <div className="cfg-bar__row">
            <Button variant="secondary" size="lg" icon={preset ? 'save' : 'star'} onClick={openSave} aria-label={preset ? 'Save changes' : 'Save workout'}>
              {preset ? 'Update' : 'Save'}
            </Button>
            <Button variant="primary" size="lg" icon="play" block onClick={start} disabled={issues.length > 0}>
              Start
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={preset ? 'Save workout' : 'Save as workout'}
        footer={
          preset ? (
            <>
              <Button variant="secondary" onClick={doSaveNew} disabled={!trimmed}>
                Save as new
              </Button>
              <Button variant="primary" icon="check" onClick={doUpdate} disabled={!trimmed}>
                Update
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" icon="check" block onClick={doSaveNew} disabled={!trimmed}>
              Save workout
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
            Name
          </label>
          <input
            id="preset-name"
            className="ui-input cfg-save__input"
            value={name}
            maxLength={40}
            placeholder={`My ${info.title}`}
            autoComplete="off"
            enterKeyHint="done"
            data-autofocus
            onChange={(e) => setName(e.target.value)}
          />
          <p className="cfg-save__hint">Saved workouts appear on the home screen — tap to start instantly.</p>
        </form>
      </Sheet>
    </div>
  );
}
