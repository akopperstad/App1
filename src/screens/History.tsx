import { useMemo, useState, type CSSProperties } from 'react';
import { describe, modeInfo } from '../engine/modes';
import { formatClockString } from '../lib/format';
import { useNav } from '../nav';
import { clearHistory, deleteHistory, useHistory, type HistoryEntry } from '../state/store';
import { Button, Icon, Sheet, TopBar } from '../components/ui';
import { startWorkout } from './configure/start';
import './History.css';

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

function dayLabel(dayStart: number, today: number): string {
  if (dayStart === today) return 'Today';
  // Use calendar arithmetic so DST shifts don't break "Yesterday".
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (dayStart === y.getTime()) return 'Yesterday';
  const d = new Date(dayStart);
  const sameYear = d.getFullYear() === new Date(today).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function computeStats(list: HistoryEntry[], now: number) {
  const weekStart = startOfWeek(now);
  const week = list.filter((h) => h.startedAt >= weekStart);
  const weekMs = week.reduce((a, h) => a + h.durationMs, 0);

  const days = new Set(list.map((h) => startOfDay(h.startedAt)));
  let streak = 0;
  const cursor = new Date(startOfDay(now));
  // A streak stays alive if you trained today or yesterday.
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { weekCount: week.length, weekMs, streak };
}

/** "43m", "1h 12m", "45s" — compact enough for a stat tile. */
function compactTime(ms: number): string {
  const sec = Math.round(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function splits(times: number[]): { at: number; split: number }[] {
  return times.map((t, i) => ({ at: t, split: t - (i > 0 ? times[i - 1] : 0) }));
}

export function History() {
  const nav = useNav();
  const history = useHistory();
  const [open, setOpen] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const now = Date.now();
  const today = startOfDay(now);
  const stats = computeStats(history, now);

  const groups = useMemo(() => {
    const out: { day: number; items: HistoryEntry[] }[] = [];
    const sorted = [...history].sort((a, b) => b.startedAt - a.startedAt);
    for (const h of sorted) {
      const d = startOfDay(h.startedAt);
      const last = out[out.length - 1];
      if (last && last.day === d) last.items.push(h);
      else out.push({ day: d, items: [h] });
    }
    return out;
  }, [history]);

  return (
    <div className="ui-page hist">
      <div className="ui-page__inner">
        <TopBar
          title="History"
          right={
            history.length > 0 ? (
              <Button variant="ghost" className="hist__clear" onClick={() => setConfirmClear(true)}>
                Clear all
              </Button>
            ) : undefined
          }
        />

        <div className="hist-stats" role="group" aria-label="This week">
          <Stat icon="bolt" value={String(stats.weekCount)} label={stats.weekCount === 1 ? 'Workout this week' : 'Workouts this week'} tone="work" />
          <Stat icon="timer" value={stats.weekMs > 0 ? compactTime(stats.weekMs) : '0m'} label="Time this week" tone="rest" />
          <Stat icon="flame" value={String(stats.streak)} label="Day streak" tone="prep" />
        </div>

        {history.length === 0 ? (
          <div className="hist-empty">
            <div className="hist-empty__art" aria-hidden>
              <Icon name="pulse" size={36} strokeWidth={2.4} />
            </div>
            <h2>No workouts yet</h2>
            <p>Finish or stop a timer and it will show up here with your time, rounds and splits.</p>
            <Button variant="primary" icon="play" onClick={() => nav.back()}>
              Pick a timer
            </Button>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.day} className="hist-group">
              <h2 className="hist-group__title">{dayLabel(g.day, today)}</h2>
              <div className="ui-card">
                {g.items.map((h) => (
                  <EntryRow
                    key={h.id}
                    entry={h}
                    open={open === h.id}
                    onToggle={() => setOpen((o) => (o === h.id ? null : h.id))}
                    onRepeat={() => startWorkout(nav, h.config)}
                    onDelete={() => {
                      deleteHistory(h.id);
                      setOpen(null);
                    }}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all history?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)} data-autofocus>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                clearHistory();
                setConfirmClear(false);
              }}
            >
              Clear all
            </Button>
          </>
        }
      >
        <p className="hist__confirm">
          This permanently deletes {history.length} {history.length === 1 ? 'workout' : 'workouts'} from this device.
          Saved workouts are kept.
        </p>
      </Sheet>
    </div>
  );
}

function Stat({ icon, value, label, tone }: { icon: 'bolt' | 'timer' | 'flame'; value: string; label: string; tone: 'work' | 'rest' | 'prep' }) {
  return (
    <div className={`hist-stat is-${tone}`}>
      <span className="hist-stat__icon" aria-hidden>
        <Icon name={icon} size={16} />
      </span>
      <span className="hist-stat__value num">{value}</span>
      <span className="hist-stat__label">{label}</span>
    </div>
  );
}

function EntryRow({
  entry: h,
  open,
  onToggle,
  onRepeat,
  onDelete,
}: {
  entry: HistoryEntry;
  open: boolean;
  onToggle: () => void;
  onRepeat: () => void;
  onDelete: () => void;
}) {
  const info = modeInfo(h.mode);
  const time = new Date(h.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const rounds = splits(h.roundTimesMs ?? []);
  const laps = h.laps ?? [];
  const detailsId = `hist-${h.id}`;

  return (
    <div className={`hist-row${open ? ' is-open' : ''}`} style={{ '--accent': info.accent } as CSSProperties}>
      <button type="button" className="hist-row__main" aria-expanded={open} aria-controls={detailsId} onClick={onToggle}>
        <span className="hist-row__bar" aria-hidden />
        <span className="hist-row__text">
          <span className="hist-row__name">{h.name || info.title}</span>
          <span className="hist-row__meta">
            {h.name && h.name !== info.title ? `${info.title} · ` : ''}
            {describe(h.config)} · {time}
          </span>
        </span>
        <span className="hist-row__right">
          <span className="hist-row__time num">{formatClockString(h.durationMs)}</span>
          <span className="hist-row__badges">
            {h.rounds > 0 && (
              <span className="hist-badge num">
                {h.rounds} {h.rounds === 1 ? 'rd' : 'rds'}
              </span>
            )}
            <span className={`hist-badge ${h.completed ? 'is-done' : 'is-stopped'}`}>{h.completed ? 'Done' : 'Stopped'}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="hist-row__details" id={detailsId}>
          {rounds.length > 0 && (
            <SplitTable title="Rounds" rows={rounds.map((r, i) => ({ label: `Round ${i + 1}`, at: r.at, split: r.split }))} />
          )}
          {laps.length > 0 && (
            <SplitTable
              title="Laps"
              rows={laps.map((l, i) => ({
                label: `Lap ${i + 1}`,
                at: l.atMs,
                split: l.splitMs ?? l.atMs - (i > 0 ? laps[i - 1].atMs : 0),
              }))}
            />
          )}
          {rounds.length === 0 && laps.length === 0 && <p className="hist-row__none">No rounds or laps recorded.</p>}
          {h.note && <p className="hist-row__note">{h.note}</p>}
          <div className="hist-row__actions">
            <Button variant="primary" icon="repeat" onClick={onRepeat}>
              Repeat
            </Button>
            <Button variant="danger" icon="trash" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SplitTable({ title, rows }: { title: string; rows: { label: string; at: number; split: number }[] }) {
  const best = Math.min(...rows.map((r) => r.split));
  return (
    <table className="hist-splits">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Split</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={rows.length > 1 && r.split === best ? 'is-best' : undefined}>
            <th scope="row">{r.label}</th>
            <td className="num">{formatClockString(r.split, { tenths: true })}</td>
            <td className="num">{formatClockString(r.at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
