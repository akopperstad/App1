import { useId, type CSSProperties } from 'react';
import { cuePlayer } from '../audio/cues';
import { DataSection } from '../features/DataSection';
import { SoundPackPicker } from '../features/SoundPackPicker';
import { deviceLang, LANG_NAMES, LANGS, useT } from '../i18n';
import { useNav } from '../nav';
import { updateSettings, useSettings, type Settings } from '../state/store';
import { Button, Icon, Row, Section, Segmented, Toggle, TopBar, type IconName } from '../components/ui';
import './Settings.css';

const PREP_VALUES = [0, 3, 5, 10, 15, 20, 30];

function Ico({ name }: { name: IconName }) {
  return <Icon name={name} size={18} />;
}

export function SettingsScreen() {
  const s = useSettings();
  const nav = useNav();
  const { t } = useT();
  const langId = useId();
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => updateSettings({ [k]: v } as Partial<Settings>);
  const vol = Math.round(s.volume * 100);
  const prepOptions = PREP_VALUES.map((v) => ({ value: v, label: v === 0 ? t('common.off') : `${v}s` }));

  return (
    <div className="ui-page settings">
      <div className="ui-page__inner">
        <TopBar title={t('settings.title')} />

        <Section title={t('settings.section.timer')}>
          <Row label={t('settings.prep')} hint={t('settings.prep.hint')} stacked icon={<Ico name="timer" />}>
            <Segmented label={t('settings.prep')} size="sm" value={s.prepSec} options={prepOptions} onChange={set('prepSec')} />
          </Row>
          <Row label={t('settings.countdownDisplay')} hint={t('settings.countdownDisplay.hint')} stacked icon={<Ico name="history" />}>
            <Segmented
              label={t('settings.countdownDisplay')}
              value={s.countDownDisplay ? 'remaining' : 'elapsed'}
              options={[
                { value: 'remaining', label: t('settings.countdownDisplay.remaining') },
                { value: 'elapsed', label: t('settings.countdownDisplay.elapsed') },
              ]}
              onChange={(v) => updateSettings({ countDownDisplay: v === 'remaining' })}
            />
          </Row>
          <Row label={t('settings.tenths')} hint={t('settings.tenths.hint')} icon={<Ico name="flag" />}>
            <Toggle label={t('settings.tenths')} checked={s.showTenths} onChange={set('showTenths')} />
          </Row>
        </Section>

        <Section title={t('settings.section.sound')}>
          <Row label={t('settings.sound')} icon={<Ico name="volume" />}>
            <Toggle label={t('settings.sound')} checked={s.sound} onChange={set('sound')} />
          </Row>
          <div className={`settings__volume${s.sound ? '' : ' is-off'}`}>
            <label htmlFor="volume" className="settings__volume-label">
              <span>{t('settings.volume')}</span>
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
          <div className={`settings__packs${s.sound ? '' : ' is-off'}`}>
            <div className="settings__packs-head">
              <span className="settings__packs-label">{t('settings.soundPack')}</span>
              <span className="settings__packs-hint">{t('settings.soundPack.hint')}</span>
            </div>
            <SoundPackPicker />
          </div>
          <Row label={t('settings.voice')} hint={t('settings.voice.hint')} icon={<Ico name="bolt" />}>
            <Toggle label={t('settings.voice')} checked={s.voice} disabled={!s.sound} onChange={set('voice')} />
          </Row>
          <Row label={t('settings.beeps')} hint={t('settings.beeps.hint')} icon={<Ico name="timer" />}>
            <Toggle label={t('settings.beeps')} checked={s.countdownBeeps} disabled={!s.sound} onChange={set('countdownBeeps')} />
          </Row>
          <Row label={t('settings.milestones')} hint={t('settings.milestones.hint')} icon={<Ico name="flag" />}>
            <Toggle label={t('settings.milestones')} checked={s.milestoneCues} disabled={!s.sound} onChange={set('milestoneCues')} />
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
              {t('settings.test')}
            </Button>
          </div>
        </Section>

        <Section title={t('settings.section.feedback')}>
          <Row label={t('settings.vibration')} hint={t('settings.vibration.hint')} icon={<Ico name="pulse" />}>
            <Toggle label={t('settings.vibration')} checked={s.vibration} onChange={set('vibration')} />
          </Row>
          <Row label={t('settings.flash')} hint={t('settings.flash.hint')} icon={<Ico name="bolt" />}>
            <Toggle label={t('settings.flash.label')} checked={s.flashOnChange} onChange={set('flashOnChange')} />
          </Row>
          <Row label={t('settings.awake')} hint={t('settings.awake.hint')} icon={<Ico name="star" />}>
            <Toggle label={t('settings.awake')} checked={s.keepAwake} onChange={set('keepAwake')} />
          </Row>
        </Section>

        <Section title={t('settings.section.appearance')}>
          <Row label={t('settings.theme')} stacked icon={<Ico name="settings" />}>
            <Segmented
              label={t('settings.theme')}
              value={s.theme}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'dark', label: t('settings.theme.dark') },
                { value: 'light', label: t('settings.theme.light') },
              ]}
              onChange={set('theme')}
            />
          </Row>
          <Row label={t('settings.language')} htmlFor={langId} icon={<GlobeIcon />}>
            <span className="settings__select-wrap">
              <select
                id={langId}
                className="settings__select"
                value={LANGS.includes(s.language as never) ? s.language : 'auto'}
                onChange={(e) => updateSettings({ language: e.target.value })}
              >
                <option value="auto">{t('settings.language.auto', { lang: LANG_NAMES[deviceLang()] })}</option>
                {LANGS.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {LANG_NAMES[l]}
                  </option>
                ))}
              </select>
            </span>
          </Row>
        </Section>

        <DataSection />

        <section className="settings__about" aria-label="Pulse">
          <span className="settings__logo" aria-hidden>
            <Icon name="pulse" size={26} strokeWidth={2.6} />
          </span>
          <strong>Pulse</strong>
          <span className="num">{t('settings.version', { v: '1.0.0' })}</span>
          <p>{t('settings.about')}</p>
          <Button variant="ghost" className="settings__intro" onClick={() => nav.go({ name: 'onboarding' })}>
            {t('settings.intro')}
          </Button>
        </section>
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z" />
    </svg>
  );
}
