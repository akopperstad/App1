import { useMemo, useState, type CSSProperties } from 'react';
import { describe, entryTitle, modeInfo } from '../engine/modes';
import type { Mode } from '../engine/types';
import { computeRecords, startOfDay, startOfWeek, weeklyMinutes, type PersonalRecord } from '../features/records';
import { WeeklyChart } from '../features/WeeklyChart';
import { useT, type Translator } from '../i18n';
import { formatClockString, formatCompact } from '../lib/format';
import { useNav } from '../nav';
import { clearHistory, deleteHistory, useHistory, type HistoryEntry } from '../state/store';
import { Button, Icon, Sheet, TopBar } from '../components/ui';
import { useWide } from '../lib/useMediaQuery';
import { startWorkout } from './configure/start';
import './History.css';

function dayLabel(dayStart: number, today: number, { t, locale }: Translator): string {
  if (dayStart === today) return t('hist.today');
  // Use calendar arithmetic so DST shifts don't break "Yesterday".
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (dayStart === y.getTime()) return t('hist.yesterday');
  const d = new Date(dayStart);
  const sameYear = d.getFullYear() === new Date(today).getFullYear();
  return d.toLocaleDateString(locale, {
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

function splits(times: number[]): { at: number; split: number }[] {
  return times.map((t, i) => ({ at: t, split: t - (i > 0 ? times[i - 1] : 0) }));
}

type Filter = 'all' | Mode;

export function History() {
  const nav = useNav();
  const history = useHistory();
  const tr = useT();
  const { t, tp } = tr;
  const [open, setOpen] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  // Tablets: stats, chart and records in a side column next to the list.
  const wide = useWide();

  const now = Date.now();
  const today = startOfDay(now);
  const stats = computeStats(history, now);
  const { records, prIds } = useMemo(() => computeRecords(history), [history]);
  const weeks = useMemo(() => weeklyMinutes(history, today, 8), [history, today]);

  // Filter chips: modes present in history, in the app's mode order.
  const modes = useMemo(() => {
    const present = new Set(history.map((h) => h.mode));
    return (['amrap', 'emom', 'fortime', 'tabata', 'interval', 'deathby', 'custom', 'countdown', 'stopwatch'] as Mode[]).filter(
      (m) => present.has(m),
    );
  }, [history]);
  const activeFilter: Filter = filter !== 'all' && !modes.includes(filter) ? 'all' : filter;

  const groups = useMemo(() => {
    const out: { day: number; items: HistoryEntry[] }[] = [];
    const sorted = [...history]
      .filter((h) => activeFilter === 'all' || h.mode === activeFilter)
      .sort((a, b) => b.startedAt - a.startedAt);
    for (const h of sorted) {
      const d = startOfDay(h.startedAt);
      const last = out[out.length - 1];
      if (last && last.day === d) last.items.push(h);
      else out.push({ day: d, items: [h] });
    }
    return out;
  }, [history, activeFilter]);

  const shownRecords = records.filter((r) => activeFilter === 'all' || r.mode === activeFilter).slice(0, 6);

  const statsBlock = (
    <div className="hist-stats" role="group" aria-label={t('hist.thisWeek')}>
      <Stat icon="bolt" value={String(stats.weekCount)} label={tp('hist.workoutsWeek', stats.weekCount)} tone="work" />
      <Stat icon="timer" value={formatCompact(stats.weekMs, tr)} label={t('hist.timeWeek')} tone="rest" />
      <Stat icon="flame" value={String(stats.streak)} label={t('hist.streak')} tone="prep" />
    </div>
  );

  const filterBlock = modes.length > 1 && (
    <div className="hist-filter" role="group" aria-label={t('hist.filter')}>
      {(['all', ...modes] as Filter[]).map((m) => (
        <button
          key={m}
          type="button"
          className={`hist-chip${activeFilter === m ? ' is-active' : ''}`}
          aria-pressed={activeFilter === m}
          style={m === 'all' ? undefined : ({ '--accent': modeInfo(m).accent } as CSSProperties)}
          onClick={() => setFilter(m)}
        >
          {m !== 'all' && <span className="hist-chip__dot" aria-hidden />}
          {m === 'all' ? t('hist.filterAll') : t(`mode.${m}`)}
        </button>
      ))}
    </div>
  );

  const listBlock = (
    <>
      {groups.map((g) => (
        <section key={g.day} className="hist-group">
          <h2 className="hist-group__title">{dayLabel(g.day, today, tr)}</h2>
          <div className="ui-card">
            {g.items.map((h) => (
              <EntryRow
                key={h.id}
                entry={h}
                pr={prIds.has(h.id)}
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
      ))}
      {groups.length === 0 && activeFilter !== 'all' && (
        <p className="hist-filter__empty">{t('hist.filterEmpty', { mode: t(`mode.${activeFilter}`) })}</p>
      )}
    </>
  );

  return (
    <div className="ui-page hist">
      <div className="ui-page__inner">
        <TopBar
          title={t('hist.title')}
          right={
            history.length > 0 ? (
              <Button variant="ghost" className="hist__clear" onClick={() => setConfirmClear(true)}>
                {t('hist.clear')}
              </Button>
            ) : undefined
          }
        />

        {wide && history.length > 0 ? (
          <div className="hist__layout">
            <aside className="hist__side">
              {statsBlock}
              <WeeklyChart weeks={weeks} />
              {shownRecords.length > 0 && <Records records={shownRecords} />}
            </aside>
            <div className="hist__main">
              {filterBlock}
              {listBlock}
            </div>
          </div>
        ) : (
          <>
            {statsBlock}

            {history.length === 0 ? (
              <div className="hist-empty">
                <div className="hist-empty__art" aria-hidden>
                  <Icon name="pulse" size={36} strokeWidth={2.4} />
                </div>
                <h2>{t('hist.emptyTitle')}</h2>
                <p>{t('hist.emptyBody')}</p>
                <Button variant="primary" icon="play" onClick={() => nav.back()}>
                  {t('hist.emptyCta')}
                </Button>
              </div>
            ) : (
              <>
                <WeeklyChart weeks={weeks} />
                {filterBlock}
                {shownRecords.length > 0 && <Records records={shownRecords} />}
                {listBlock}
              </>
            )}
          </>
        )}
      </div>

      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('hist.confirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)} data-autofocus>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                clearHistory();
                setConfirmClear(false);
              }}
            >
              {t('hist.clear')}
            </Button>
          </>
        }
      >
        <p className="hist__confirm">{tp('hist.confirmBody', history.length)}</p>
      </Sheet>
    </div>
  );
}

function Records({ records }: { records: PersonalRecord[] }) {
  const tr = useT();
  const { t, tp } = tr;
  return (
    <section className="hist-records" aria-labelledby="hist-records-title">
      <h2 id="hist-records-title" className="hist-group__title">
        {t('hist.records')}
      </h2>
      <ul className="hist-records__list">
        {records.map((r) => (
          <li key={r.key} className="hist-record" style={{ '--accent': modeInfo(r.mode).accent } as CSSProperties}>
            <span className="hist-record__icon" aria-hidden>
              <Icon name="trophy" size={16} />
            </span>
            <span className="hist-record__name">{entryTitle(r.name, r.mode, tr)}</span>
            <span className="hist-record__value num">
              {r.kind === 'time' ? formatClockString(r.value) : tp('hist.rounds', r.value)}
            </span>
            <span className="hist-record__meta">
              {r.kind === 'time' ? t('hist.bestTime') : t('hist.mostRounds')} · {tp('hist.attempts', r.attempts)}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
  pr,
  open,
  onToggle,
  onRepeat,
  onDelete,
}: {
  entry: HistoryEntry;
  pr: boolean;
  open: boolean;
  onToggle: () => void;
  onRepeat: () => void;
  onDelete: () => void;
}) {
  const tr = useT();
  const { t, tp, locale } = tr;
  const info = modeInfo(h.mode);
  const title = t(`mode.${h.mode}`);
  const name = entryTitle(h.name, h.mode, tr);
  const time = new Date(h.startedAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const rounds = splits(h.roundTimesMs ?? []);
  const laps = h.laps ?? [];
  const detailsId = `hist-${h.id}`;

  return (
    <div className={`hist-row${open ? ' is-open' : ''}${pr ? ' is-pr' : ''}`} style={{ '--accent': info.accent } as CSSProperties}>
      <button type="button" className="hist-row__main" aria-expanded={open} aria-controls={detailsId} onClick={onToggle}>
        <span className="hist-row__bar" aria-hidden />
        <span className="hist-row__text">
          <span className="hist-row__name">{name}</span>
          <span className="hist-row__meta">
            {name !== title ? `${title} · ` : ''}
            {describe(h.config, tr)} · {time}
          </span>
        </span>
        <span className="hist-row__right">
          <span className="hist-row__time num">{formatClockString(h.durationMs)}</span>
          <span className="hist-row__badges">
            {pr && (
              <span className="hist-badge is-pr" title={t('hist.prLabel')}>
                <span aria-hidden>{t('hist.pr')}</span>
                <span className="visually-hidden">{t('hist.prLabel')}</span>
              </span>
            )}
            {h.rounds > 0 && <span className="hist-badge num">{tp('hist.rounds', h.rounds)}</span>}
            <span className={`hist-badge ${h.completed ? 'is-done' : 'is-stopped'}`}>{h.completed ? t('hist.done') : t('hist.stopped')}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="hist-row__details" id={detailsId}>
          {rounds.length > 0 && (
            <SplitTable
              title={t('hist.roundsTitle')}
              rows={rounds.map((r, i) => ({ label: t('hist.round', { n: i + 1 }), at: r.at, split: r.split }))}
            />
          )}
          {laps.length > 0 && (
            <SplitTable
              title={t('hist.lapsTitle')}
              rows={laps.map((l, i) => ({
                label: t('hist.lap', { n: i + 1 }),
                at: l.atMs,
                split: l.splitMs ?? l.atMs - (i > 0 ? laps[i - 1].atMs : 0),
              }))}
            />
          )}
          {rounds.length === 0 && laps.length === 0 && <p className="hist-row__none">{t('hist.none')}</p>}
          {h.note && <p className="hist-row__note">{h.note}</p>}
          <div className="hist-row__actions">
            <Button variant="primary" icon="repeat" onClick={onRepeat}>
              {t('hist.repeat')}
            </Button>
            <Button variant="danger" icon="trash" onClick={onDelete}>
              {t('hist.delete')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SplitTable({ title, rows }: { title: string; rows: { label: string; at: number; split: number }[] }) {
  const { t } = useT();
  // Guarded: Math.min() of an empty list is Infinity; ties at display precision aren't "best".
  const tenthsOf = (ms: number) => Math.floor(ms / 100);
  const best = rows.length ? Math.min(...rows.map((r) => tenthsOf(r.split))) : -1;
  const allSame = rows.every((r) => tenthsOf(r.split) === best);
  return (
    <table className="hist-splits">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">{t('hist.split')}</th>
          <th scope="col">{t('hist.total')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={rows.length > 1 && !allSame && tenthsOf(r.split) === best ? 'is-best' : undefined}>
            <th scope="row">{r.label}</th>
            <td className="num">{formatClockString(r.split, { tenths: true })}</td>
            <td className="num">{formatClockString(r.at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
