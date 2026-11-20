import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initRemotes } from './mfe/remotes';
import './styles/r19.css';
import './shell/shell.css';

// ADR 0002/0004: read /config.json at boot (mode bundled|remote; remote → registerRemotes); RemoteMount awaits it.
// The resolved mode is exposed as <html data-feature-mode> for diagnostics / e2e.
void initRemotes().then((mode) => {
  document.documentElement.dataset.featureMode = mode;
});

const el = document.getElementById('root');
if (!el) throw new Error('#root missing');
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
