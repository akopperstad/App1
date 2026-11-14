import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getT } from './i18n';

/**
 * Last line of defence: a render error anywhere shows a small recovery screen
 * instead of a blank page (in the native app, a blank web view).
 * Stored data lives in localStorage and is not touched.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Pulse crashed', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const { t } = getT();
    const reload = () => {
      try {
        // Start over on the home screen (the screen stack lives in history.state).
        history.replaceState(null, '', location.pathname + location.search);
      } catch {
        /* ignore */
      }
      location.reload();
    };
    return (
      <div className="ui-page" role="alert" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{t('crash.title')}</h1>
          <p style={{ margin: '0 0 20px', opacity: 0.75 }}>{t('crash.body')}</p>
          <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={reload}>
            {t('crash.reload')}
          </button>
        </div>
      </div>
    );
  }
}
