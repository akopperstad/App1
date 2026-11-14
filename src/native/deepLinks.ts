/**
 * Deep-link URLs the native apps receive, normalised into the "#w=<code>" form
 * that openShared() / parseShared() (src/features/share.ts) accept.
 *
 * Accepted (case-insensitive scheme/host):
 *   pulsetimer://import#w=CODE        "Open in Pulse" on site/w/ (older form)
 *   pulsetimer://import?w=CODE        current form — some launchers / in-app
 *   pulsetimer://import/?w=CODE         browsers drop URL fragments
 *   pulsetimer:import?w=CODE
 *   https://<host>/w/#w=CODE          Universal Links / App Links (opt-in), or
 *   https://<host>/?w=CODE            any share URL a user opened with the app
 *
 * Everything else (other schemes, other pulsetimer:// hosts, no code) → null,
 * so unrelated URLs are ignored.
 */

/** Custom URL scheme registered in ios/App/App/Info.plist and AndroidManifest.xml. */
export const APP_SCHEME = 'pulsetimer';
/** pulsetimer://<host> used for importing a shared workout. */
export const IMPORT_HOST = 'import';

/** Build the app-scheme link for a share code (query form: survives launchers that drop "#"). */
export function appLink(code: string): string {
  return `${APP_SCHEME}://${IMPORT_HOST}?w=${encodeURIComponent(code)}`;
}

const CODE_CHARS = /^[A-Za-z0-9._~-]+$/;

export function normalizeDeepLink(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const s = url.trim();
  const m = /^([a-z][a-z0-9+.-]*):(.*)$/is.exec(s);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  const rest = m[2];

  if (scheme === APP_SCHEME) {
    const host = rest.replace(/^\/\//, '').split(/[/?#]/, 1)[0].toLowerCase();
    if (host !== IMPORT_HOST) return null;
  } else if (scheme !== 'https' && scheme !== 'http') {
    return null;
  }

  // The code may sit in the fragment or the query; prefer the fragment.
  const hashAt = rest.indexOf('#');
  const fragment = hashAt >= 0 ? rest.slice(hashAt + 1) : '';
  const beforeHash = hashAt >= 0 ? rest.slice(0, hashAt) : rest;
  const queryAt = beforeHash.indexOf('?');
  const query = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '';

  const code = param(fragment) ?? param(query);
  return code ? `#w=${code}` : null;
}

function param(part: string): string | null {
  for (const kv of part.split('&')) {
    const eq = kv.indexOf('=');
    if (eq < 0 || kv.slice(0, eq) !== 'w') continue;
    let v = kv.slice(eq + 1);
    // Launchers may percent-encode once or twice ("1%2E…", "1%252E…").
    for (let i = 0; i < 2 && v.includes('%'); i++) {
      try {
        v = decodeURIComponent(v);
      } catch {
        return null;
      }
    }
    v = v.trim();
    return v && CODE_CHARS.test(v) ? v : null;
  }
  return null;
}
