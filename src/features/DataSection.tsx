import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useT } from '../i18n';
import { useNav } from '../nav';
import { historyStore, presetsStore } from '../state/store';
import { Button, Section, Sheet } from '../components/ui';
import {
  applyBackup,
  backupFileName,
  buildBackup,
  csvFileName,
  historyToCsv,
  parseBackup,
  planMerge,
  saveTextFile,
  type Backup,
} from './backup';
import { openShared } from './shareActions';
import { toast } from './toast';
import './features.css';

const G = {
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14" />,
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />,
  chevron: <path d="M9 5l7 7-7 7" />,
};

function Glyph({ d, size = 18 }: { d: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {d}
    </svg>
  );
}

function ActionRow({ icon, label, hint, onClick }: { icon: ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="fx-action" onClick={onClick}>
      <span className="ui-row__icon fx-action__icon">
        <Glyph d={icon} />
      </span>
      <span className="fx-action__text">
        <span className="ui-row__label">{label}</span>
        <span className="ui-row__hint">{hint}</span>
      </span>
      <span className="fx-action__chev">
        <Glyph d={G.chevron} size={16} />
      </span>
    </button>
  );
}

/** Settings → Your data: backup, restore, CSV export, import a shared workout. */
export function DataSection() {
  const { t, tp, locale } = useT();
  const nav = useNav();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [withSettings, setWithSettings] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const codeId = useId();
  const errId = useId();
  const settingsId = useId();

  const backup = async () => {
    const r = await saveTextFile(backupFileName(), JSON.stringify(buildBackup(), null, 2), 'application/json');
    if (r === 'saved' || r === 'shared') toast(t('data.backupSaved'), { tone: 'success' });
    else if (r === 'failed') toast(t('data.saveFailed'), { tone: 'error' });
  };

  const exportCsv = async () => {
    const list = historyStore.get();
    if (!list.length) {
      toast(t('data.nothing'));
      return;
    }
    const r = await saveTextFile(csvFileName(), historyToCsv(list), 'text/csv');
    if (r === 'saved' || r === 'shared') toast(t('data.csvSaved'), { tone: 'success' });
    else if (r === 'failed') toast(t('data.saveFailed'), { tone: 'error' });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    let text = '';
    try {
      text = file.size > 20 * 1024 * 1024 ? '' : await file.text();
    } catch {
      text = '';
    }
    const b = parseBackup(text);
    if (!b) {
      toast(t('data.invalid'), { tone: 'error', ms: 4000 });
      return;
    }
    setWithSettings(true);
    setPending(b);
  };

  const plan = pending ? planMerge({ presets: presetsStore.get(), history: historyStore.get() }, pending) : null;

  const confirmRestore = () => {
    if (!pending) return;
    const res = applyBackup(pending, { settings: withSettings });
    setPending(null);
    const n = res.addedPresets + res.addedHistory;
    toast(n > 0 || withSettings ? tp('data.restored', n) : t('data.upToDate'), { tone: 'success' });
  };

  const submitCode = () => {
    if (openShared(nav.go, code)) {
      setImportOpen(false);
      setCode('');
      setCodeError(false);
    } else {
      setCodeError(true);
    }
  };

  return (
    <>
      <Section title={t('settings.section.data')}>
        <ActionRow icon={G.download} label={t('settings.backup')} hint={t('settings.backup.hint')} onClick={() => void backup()} />
        <ActionRow icon={G.upload} label={t('settings.restore')} hint={t('settings.restore.hint')} onClick={() => fileRef.current?.click()} />
        <ActionRow icon={G.table} label={t('settings.csv')} hint={t('settings.csv.hint')} onClick={() => void exportCsv()} />
        <ActionRow
          icon={G.link}
          label={t('settings.importCode')}
          hint={t('settings.importCode.hint')}
          onClick={() => {
            setCodeError(false);
            setImportOpen(true);
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void onFile(e)}
        />
      </Section>

      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title={t('data.restoreTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} data-autofocus>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" icon="check" onClick={confirmRestore}>
              {t('data.restore')}
            </Button>
          </>
        }
      >
        {pending && plan && (
          <div className="fx-restore">
            {pending.exportedAt > 0 && (
              <p className="fx-restore__from">
                {t('data.restoreFrom', {
                  date: new Date(pending.exportedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </p>
            )}
            <dl className="fx-restore__stats">
              <div>
                <dt>{t('data.restoreNew')}</dt>
                <dd className="num">+{plan.addedPresets}</dd>
              </div>
              <div>
                <dt>{t('data.restoreHistory')}</dt>
                <dd className="num">+{plan.addedHistory}</dd>
              </div>
            </dl>
            <p className="fx-restore__note">{t('data.restoreKept')}</p>
            <label className="fx-check" htmlFor={settingsId}>
              <input id={settingsId} type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.target.checked)} />
              <span>{t('data.restoreSettings')}</span>
            </label>
          </div>
        )}
      </Sheet>

      <Sheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('data.importTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={submitCode} disabled={!code.trim()}>
              {t('common.import')}
            </Button>
          </>
        }
      >
        <form
          className="fx-import"
          onSubmit={(e) => {
            e.preventDefault();
            submitCode();
          }}
        >
          <label htmlFor={codeId} className="fx-import__label">
            {t('data.importLabel')}
          </label>
          <input
            id={codeId}
            className="fx-input"
            data-autofocus
            value={code}
            placeholder={t('data.importPlaceholder')}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={codeError || undefined}
            aria-describedby={codeError ? errId : undefined}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError(false);
            }}
          />
          {codeError && (
            <p id={errId} className="fx-import__error" role="alert">
              {t('data.importInvalid')}
            </p>
          )}
        </form>
      </Sheet>
    </>
  );
}
