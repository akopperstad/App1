import { useState, type CSSProperties } from 'react';
import { BUILT_IN_PRESETS, MODES, describe, modeInfo, totalSeconds } from '../engine/modes';
import type { WorkoutConfig } from '../engine/types';
import { formatDuration } from '../lib/format';
import { useNav } from '../nav';
import {
  deletePreset,
  lastConfigStore,
  useHistory,
  usePresets,
  useStore,
  type Preset,
} from '../state/store';
import { ActionList, Button, Icon, IconButton, Section, Sheet, useLongPress } from '../components/ui';
import { startWorkout } from './configure/start';
import './Home.css';

const accentStyle = (accent: string) => ({ '--accent': accent }) as CSSProperties;

/** Very compact summary for the mode-card pill. */
function pill(c: WorkoutConfig): string {
  switch (c.mode) {
    case 'amrap':
      return c.sets > 1 ? `${c.sets} × ${formatDuration(c.durationSec)}` : formatDuration(c.durationSec);
    case 'emom':
      return `${c.rounds} × ${formatDuration(c.intervalSec)}`;
    case 'tabata':
    case 'interval':
      return `${c.rounds} × ${formatDuration(c.workSec)}/${formatDuration(c.restSec)}`;
    case 'deathby':
      return `${c.movement || 'Reps'} +${c.increment}`;
    default:
      return describe(c);
  }
}

function summary(c: WorkoutConfig): string {
  const total = totalSeconds(c);
  const d = describe(c);
  if (total === null || c.mode === 'countdown' || (c.mode === 'amrap' && c.sets === 1)) return d;
  return `${d} · ${formatDuration(total)}`;
}

export function Home() {
  const nav = useNav();
  const presets = usePresets();
  const history = useHistory();
  const last = useStore(lastConfigStore);
  const [menu, setMenu] = useState<Preset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Preset | null>(null);

  const recent = history[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="ui-page home">
      <div className="ui-page__inner">
        <header className="home__header">
          <div>
            <p className="home__date">{today}</p>
            <h1 className="home__brand">
              <span className="home__mark" aria-hidden>
                <Icon name="pulse" size={22} strokeWidth={2.6} />
              </span>
              Pulse
            </h1>
          </div>
          <nav className="home__nav" aria-label="Main">
            <IconButton icon="history" label="History" variant="filled" size={20} onClick={() => nav.go({ name: 'history' })} />
            <IconButton icon="settings" label="Settings" variant="filled" size={20} onClick={() => nav.go({ name: 'settings' })} />
          </nav>
        </header>

        {recent && (
          <button
            type="button"
            className="home__quick"
            style={accentStyle(modeInfo(recent.mode).accent)}
            onClick={() => startWorkout(nav, recent.config)}
            aria-label={`Repeat last workout: ${recent.name || modeInfo(recent.mode).title}`}
          >
            <span className="home__quick-text">
              <span className="home__eyebrow">
                <Icon name="repeat" size={14} /> Quick start
              </span>
              <span className="home__quick-name">{recent.name || modeInfo(recent.mode).title}</span>
              <span className="home__quick-meta">
                {modeInfo(recent.mode).title} · {describe(recent.config)}
              </span>
            </span>
            <span className="home__play" aria-hidden>
              <Icon name="play" size={26} />
            </span>
          </button>
        )}

        <Section title="Timers" plain>
          <div className="home__grid">
            {MODES.map((m) => {
              const cfg = last[m.mode];
              return (
                <button
                  key={m.mode}
                  type="button"
                  className="mode-card"
                  style={accentStyle(m.accent)}
                  onClick={() => nav.go({ name: 'configure', mode: m.mode })}
                >
                  <span className="mode-card__glow" aria-hidden />
                  <span className="mode-card__top">
                    <span className="mode-card__title">{m.title}</span>
                    <Icon name="chevronRight" size={18} className="mode-card__chev" />
                  </span>
                  <span className="mode-card__tag">{m.tagline}</span>
                  <span className={`mode-card__last num${cfg ? '' : ' is-default'}`}>
                    {pill(cfg ?? m.defaults)}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Saved workouts" plain>
          {presets.length === 0 ? (
            <div className="home__empty">
              <span className="home__empty-icon">
                <Icon name="save" size={20} />
              </span>
              <p>
                Tap <strong>Save</strong> when configuring a timer and your workouts will live here, one tap from
                starting.
              </p>
            </div>
          ) : (
            <div className="ui-card home__list">
              {presets.map((p) => (
                <PresetRow
                  key={p.id}
                  preset={p}
                  onRun={() => startWorkout(nav, p.config)}
                  onMenu={() => setMenu(p)}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Benchmarks" plain>
          <div className="home__bench" role="list">
            {BUILT_IN_PRESETS.map((b) => {
              const info = modeInfo(b.config.mode);
              return (
                <button
                  key={b.name}
                  role="listitem"
                  type="button"
                  className="bench-card"
                  style={accentStyle(info.accent)}
                  onClick={() => nav.go({ name: 'configure', mode: b.config.mode, initial: b.config })}
                >
                  <span className="bench-card__mode">{info.title}</span>
                  <span className="bench-card__name">{b.name}</span>
                  <span className="bench-card__desc num">{describe(b.config)}</span>
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        {menu && (
          <ActionList
            items={[
              {
                label: 'Start now',
                icon: 'play',
                onSelect: () => {
                  const c = menu.config;
                  setMenu(null);
                  startWorkout(nav, c);
                },
              },
              {
                label: 'Edit',
                icon: 'edit',
                onSelect: () => {
                  const p = menu;
                  setMenu(null);
                  nav.go({ name: 'configure', mode: p.config.mode, initial: p.config });
                },
              },
              {
                label: 'Delete',
                icon: 'trash',
                danger: true,
                onSelect: () => {
                  setConfirmDelete(menu);
                  setMenu(null);
                },
              },
            ]}
          />
        )}
      </Sheet>

      <Sheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete workout?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} data-autofocus>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                if (confirmDelete) deletePreset(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="home__confirm">
          “{confirmDelete?.name}” will be removed from your saved workouts. Your history is not affected.
        </p>
      </Sheet>
    </div>
  );
}

function PresetRow({ preset, onRun, onMenu }: { preset: Preset; onRun: () => void; onMenu: () => void }) {
  const info = modeInfo(preset.config.mode);
  const press = useLongPress(onRun, onMenu);
  return (
    <div className="preset-row" style={accentStyle(info.accent)}>
      <button type="button" className="preset-row__main" aria-label={`Start ${preset.name}`} {...press}>
        <span className="preset-row__dot" aria-hidden>
          <Icon name="play" size={14} />
        </span>
        <span className="preset-row__text">
          <span className="preset-row__name">{preset.name}</span>
          <span className="preset-row__meta num">
            {info.title} · {summary(preset.config)}
          </span>
        </span>
      </button>
      <IconButton icon="more" label={`More options for ${preset.name}`} onClick={onMenu} />
    </div>
  );
}
