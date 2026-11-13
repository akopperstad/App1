import type { CSSProperties } from 'react';
import { cuePlayer } from '../audio/cues';
import { updateSettings, useSettings, type Settings } from '../state/store';
import { Button, Icon, Row, Section, Segmented, Toggle, TopBar, type IconName } from '../components/ui';
import './Settings.css';

const PREP_OPTIONS = [0, 3, 5, 10, 15, 20, 30].map((v) => ({ value: v, label: v === 0 ? 'Off' : `${v}s` }));

function Ico({ name }: { name: IconName }) {
  return <Icon name={name} size={18} />;
}

export function SettingsScreen() {
  const s = useSettings();
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => updateSettings({ [k]: v } as Partial<Settings>);
  const vol = Math.round(s.volume * 100);

  return (
    <div className="ui-page settings">
      <div className="ui-page__inner">
        <TopBar title="Settings" />

        <Section title="Timer">
          <Row label="Get-ready countdown" hint="Lead-in before the first interval" stacked icon={<Ico name="timer" />}>
            <Segmented label="Get-ready countdown" size="sm" value={s.prepSec} options={PREP_OPTIONS} onChange={set('prepSec')} />
          </Row>
          <Row label="Countdown display" hint="For AMRAPs and countdowns" stacked icon={<Ico name="history" />}>
            <Segmented
              label="Countdown display"
              value={s.countDownDisplay ? 'remaining' : 'elapsed'}
              options={[
                { value: 'remaining', label: 'Time remaining' },
                { value: 'elapsed', label: 'Time elapsed' },
              ]}
              onChange={(v) => updateSettings({ countDownDisplay: v === 'remaining' })}
            />
          </Row>
          <Row label="Show tenths" hint="On count-up timers" icon={<Ico name="flag" />}>
            <Toggle label="Show tenths" checked={s.showTenths} onChange={set('showTenths')} />
          </Row>
        </Section>

        <Section title="Sound">
          <Row label="Sound" icon={<Ico name="volume" />}>
            <Toggle label="Sound" checked={s.sound} onChange={set('sound')} />
          </Row>
          <div className={`settings__volume${s.sound ? '' : ' is-off'}`}>
            <label htmlFor="volume" className="settings__volume-label">
              <span>Volume</span>
              <span className="num">{vol}%</span>
            </label>
            <input
              id="volume"
              type="range"
              className="ui-range"
              min={0}
              max={100}
              step={5}
              value={vol}
              disabled={!s.sound}
              style={{ '--pct': `${vol}%` } as CSSProperties}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
            />
          </div>
          <Row label="Voice announcements" hint="“Work”, “Rest”, “Halfway”, “10 seconds”" icon={<Ico name="bolt" />}>
            <Toggle label="Voice announcements" checked={s.voice} disabled={!s.sound} onChange={set('voice')} />
          </Row>
          <Row label="3-2-1 beeps" hint="Before every interval change" icon={<Ico name="timer" />}>
            <Toggle label="3-2-1 beeps" checked={s.countdownBeeps} disabled={!s.sound} onChange={set('countdownBeeps')} />
          </Row>
          <Row label="Milestone cues" hint="Halfway, 10 seconds, every minute" icon={<Ico name="flag" />}>
            <Toggle label="Milestone cues" checked={s.milestoneCues} disabled={!s.sound} onChange={set('milestoneCues')} />
          </Row>
          <div className="settings__test">
            <Button
              variant="secondary"
              icon="volume"
              block
              disabled={!s.sound}
              onClick={() => {
                cuePlayer.unlock();
                cuePlayer.test(s);
              }}
            >
              Test sound
            </Button>
          </div>
        </Section>

        <Section title="Feedback">
          <Row label="Vibration" hint="Haptic pulse on interval changes" icon={<Ico name="pulse" />}>
            <Toggle label="Vibration" checked={s.vibration} onChange={set('vibration')} />
          </Row>
          <Row label="Flash screen" hint="Full-screen colour flash on change" icon={<Ico name="bolt" />}>
            <Toggle label="Flash screen on change" checked={s.flashOnChange} onChange={set('flashOnChange')} />
          </Row>
          <Row label="Keep screen awake" hint="While a timer is running" icon={<Ico name="star" />}>
            <Toggle label="Keep screen awake" checked={s.keepAwake} onChange={set('keepAwake')} />
          </Row>
        </Section>

        <Section title="Appearance">
          <Row label="Theme" stacked icon={<Ico name="settings" />}>
            <Segmented
              label="Theme"
              value={s.theme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              onChange={set('theme')}
            />
          </Row>
        </Section>

        <section className="settings__about" aria-label="About">
          <span className="settings__logo" aria-hidden>
            <Icon name="pulse" size={26} strokeWidth={2.6} />
          </span>
          <strong>Pulse</strong>
          <span className="num">Version 1.0.0</span>
          <p>Works offline. Install to home screen for the best experience.</p>
        </section>
      </div>
    </div>
  );
}
