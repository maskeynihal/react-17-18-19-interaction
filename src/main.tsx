import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';
import { applyRuntimeRemoteConfig } from './mfe/runtime';
import './styles/widgets.css';
import './styles/shell.css';

window.__APP_REACT_VERSION__ = React.version;

// ADR 0002: resolve remote URLs from /config.json before the first loadRemote.
// Legacy React 17 root API on purpose (no createRoot in this portal).
void applyRuntimeRemoteConfig().finally(() => {
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root'),
  );
});
