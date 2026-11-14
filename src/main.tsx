import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initPlatform } from './native/bootstrap';
import { isNative } from './native/platform';
import './styles/tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initPlatform();

// PWA offline support. The native apps ship the bundle inside the binary, so
// they never register the service worker (it would only cache stale copies).
if (!isNative() && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
