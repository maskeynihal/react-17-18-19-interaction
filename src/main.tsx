import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initRemotes } from './mfe/remotes';
import './styles/r19.css';
import './shell/shell.css';

// ADR 0002: kick off /config.json → registerRemotes at boot; RemoteMount awaits it before any loadRemote.
void initRemotes();

const el = document.getElementById('root');
if (!el) throw new Error('#root missing');
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
