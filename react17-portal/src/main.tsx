import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';
import { applyRuntimeRemoteConfig } from './mfe/runtime';
import './styles/widgets.css';
import './styles/shell.css';

window.__APP_REACT_VERSION__ = React.version;

// ADR 0002/0004: read /config.json (mode bundled|remote; remote → register remote URLs) before the first load.
// The resolved mode is exposed as <html data-feature-mode> for diagnostics / e2e.
// Legacy React 17 root API on purpose (no createRoot in this portal).
void applyRuntimeRemoteConfig()
  .then((mode) => {
    document.documentElement.dataset.featureMode = mode;
  })
  .finally(() => {
    ReactDOM.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
      document.getElementById('root'),
    );
  });
