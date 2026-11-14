import { useMemo, useState, type CSSProperties } from 'react';
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
  type HistoryEntry,
  type Preset,
} from '../state/store';
import { ActionList, Button, Icon, IconButton, Section, Sheet, modeIcon, useLongPress } from '../components/ui';
import { shareWorkout } from '../features/shareActions';
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
    case 'stopwatch':
      return 'Laps';
    case 'custom':
      return `${Array.isArray(c.steps) ? c.steps.length : 0} steps × ${c.rounds}`;
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

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today", "Yesterday", "Tuesday", "Nov 2". */
function whenLabel(t: number, now: number): string {
  const today = startOfDay(now);
  const day = startOfDay(t);
  if (day === today) return 'Today';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (day === y.getTime()) return 'Yesterday';
  if (today - day < 6 * 86_400_000) return new Date(t).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Monday-first week with a flag for each day that has a session. */
function weekModel(list: HistoryEntry[], now: number) {
  const today = new Date(startOfDay(now));
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const start = monday.getTime();
  const trained = new Set(list.filter((h) => h.startedAt >= start).map((h) => startOfDay(h.startedAt)));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      key: i,
      letter: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      name: d.toLocaleDateString(undefined, { weekday: 'long' }),
      done: trained.has(d.getTime()),
      today: i === dow,
      future: i > dow,
    };
  });
  const week = list.filter((h) => h.startedAt >= start);
  const minutes = Math.round(week.reduce((a, h) => a + h.durationMs, 0) / 60_000);
  return { days, count: week.length, minutes };
}

/** The app icon in miniature: coral stopwatch ring + heartbeat. */
function BrandMark() {
  return (
    <svg className="home__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pulse-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a4d" />
          <stop offset="1" stopColor="#ff3d2e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#0b0c0e" />
      <rect x="28.25" y="7.5" width="7.5" height="4" rx="1.4" fill="url(#pulse-mark-g)" />
      <circle cx="32" cy="36" r="18.5" fill="none" stroke="#1f2228" strokeWidth="5" />
      <circle
        cx="32"
        cy="36"
        r="18.5"
        fill="none"
        stroke="url(#pulse-mark-g)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="94 200"
        transform="rotate(-90 32 36)"
      />
      <polyline
        points="18.5,37 25,37 28,31 32,43.5 35.5,28 38.5,37 45.5,37"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Home() {
  const nav = useNav();
  const presets = usePresets();
  const history = useHistory();
  const last = useStore(lastConfigStore);
  const [menu, setMenu] = useState<Preset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Preset | null>(null);

  const recent = history[0];
  const now = Date.now();
  const today = new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const week = useMemo(() => weekModel(history, now), [history, now]);
  const recentInfo = recent ? modeInfo(recent.mode) : null;
  const recentTotal = recent ? totalSeconds(recent.config) : null;

  return (
    <div className="ui-page home">
      <div className="ui-page__inner">
        <header className="home__header">
          <div className="home__id">
            <BrandMark />
            <div>
              <p className="home__date">{today}</p>
              <h1 className="home__brand">Pulse</h1>
            </div>
          </div>
          <nav className="home__nav" aria-label="Main">
            <IconButton icon="history" label="History" variant="filled" size={20} onClick={() => nav.go({ name: 'history' })} />
            <IconButton icon="settings" label="Settings" variant="filled" size={20} onClick={() => nav.go({ name: 'settings' })} />
          </nav>
        </header>

        {history.length > 0 && (
          <button
            type="button"
            className="home__week"
            onClick={() => nav.go({ name: 'history' })}
            aria-label={`This week: ${week.count} workout${week.count === 1 ? '' : 's'}, ${week.minutes} minutes. Open history`}
          >
            <span className="home__week-stat">
              <span className="home__week-num num">{week.count}</span>
              <span className="home__week-cap">
                {week.count === 1 ? 'workout' : 'workouts'}
                <br />
                this week
              </span>
            </span>
            <span className="home__week-stat">
              <span className="home__week-num num">{week.minutes}</span>
              <span className="home__week-cap">
                minutes
                <br />
                trained
              </span>
            </span>
            <span className="home__days" aria-hidden="true">
              {week.days.map((d) => (
                <span
                  key={d.key}
                  className={`home__day${d.done ? ' is-done' : ''}${d.today ? ' is-today' : ''}${d.future ? ' is-future' : ''}`}
                  title={d.name}
                >
                  <span className="home__day-dot" />
                  <span className="home__day-l">{d.letter}</span>
                </span>
              ))}
            </span>
          </button>
        )}

        {recent && recentInfo && (
          <button
            type="button"
            className="home__quick"
            style={accentStyle(recentInfo.accent)}
            onClick={() => startWorkout(nav, recent.config)}
            aria-label={`Repeat last workout: ${recent.name || recentInfo.title}`}
          >
            <span className="home__quick-glow" aria-hidden />
            <span className="home__quick-top">
              <span className="home__eyebrow">
                <Icon name="repeat" size={14} strokeWidth={2.4} /> Quick start
              </span>
              <span className="home__quick-when">{whenLabel(recent.startedAt, now)}</span>
            </span>
            <span className="home__quick-main">
              <span className="ui-glyph ui-glyph--solid home__quick-glyph" aria-hidden>
                <Icon name={modeIcon(recent.mode)} size={26} strokeWidth={2.2} />
              </span>
              <span className="home__quick-text">
                <span className="home__quick-name">{recent.name || recentInfo.title}</span>
                <span className="home__quick-meta num">
                  {(recent.name || recentInfo.title) !== recentInfo.title && `${recentInfo.title} · `}
                  {describe(recent.config)}
                  {recentTotal !== null && recent.config.mode !== 'countdown' && recent.config.mode !== 'amrap'
                    ? ` · ${formatDuration(recentTotal)}`
                    : ''}
                </span>
              </span>
              <span className="home__play" aria-hidden>
                <Icon name="play" size={26} />
              </span>
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
                  data-mode={m.mode}
                  style={accentStyle(m.accent)}
                  onClick={() => nav.go({ name: 'configure', mode: m.mode })}
                  aria-label={`${m.title}: ${m.tagline}`}
                >
                  <span className="mode-card__glow" aria-hidden />
                  <span className="ui-glyph mode-card__glyph" aria-hidden>
                    <Icon name={modeIcon(m.mode)} size={22} strokeWidth={2.2} />
                  </span>
                  <span className="mode-card__title">{m.title}</span>
                  <span className="mode-card__tag">{m.tagline}</span>
                  <span className={`mode-card__last num${cfg ? '' : ' is-default'}`}>{pill(cfg ?? m.defaults)}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          title="Saved workouts"
          plain
          action={presets.length > 0 ? <span className="home__count num">{presets.length}</span> : undefined}
        >
          {presets.length === 0 ? (
            <div className="home__empty">
              <span className="home__empty-icon">
                <Icon name="star" size={20} />
              </span>
              <p>
                Tap <strong>Save</strong> when configuring a timer and your workouts will live here, one tap from
                starting.
              </p>
            </div>
          ) : (
            <div className="ui-card home__list">
              {presets.map((p) => (
                <PresetRow key={p.id} preset={p} onRun={() => startWorkout(nav, p.config)} onMenu={() => setMenu(p)} />
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
                  <span className="bench-card__head">
                    <span className="ui-glyph bench-card__glyph" aria-hidden>
                      <Icon name={modeIcon(b.config.mode)} size={18} strokeWidth={2.2} />
                    </span>
                    <span className="bench-card__mode">{info.title}</span>
                  </span>
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
                label: 'Share',
                icon: 'share',
                onSelect: () => {
                  const c = menu.config;
                  setMenu(null);
                  void shareWorkout(c);
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
        <span className="ui-glyph preset-row__glyph" aria-hidden>
          <Icon name={modeIcon(preset.config.mode)} size={20} strokeWidth={2.2} />
        </span>
        <span className="preset-row__text">
          <span className="preset-row__name">{preset.name}</span>
          <span className="preset-row__meta num">
            {info.title} · {summary(preset.config)}
          </span>
        </span>
        <span className="preset-row__play" aria-hidden>
          <Icon name="play" size={14} />
        </span>
      </button>
      <IconButton icon="more" label={`More options for ${preset.name}`} onClick={onMenu} />
    </div>
  );
}
