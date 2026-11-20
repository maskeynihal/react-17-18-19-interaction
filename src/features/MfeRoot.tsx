import { version, type ReactNode } from 'react';
import '../styles/r19.css';

/** Root element every exposed module renders (contract rule 3). */
export function MfeRoot(props: { name: string; theme: 'light' | 'dark'; host: string; children: ReactNode }) {
  return (
    <div
      className="r19-root"
      data-mfe={props.name}
      data-react-version={version}
      data-theme={props.theme}
      data-host={props.host}
    >
      {props.children}
    </div>
  );
}
