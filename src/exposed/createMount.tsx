import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import type { HostProps, MountFn } from '../mfe/contract';
import { MfeRoot } from '../features/MfeRoot';

/** React 19 mount adapter (ADR 0001): createRoot once, re-render on update, root.unmount on unmount. */
export function createMount<P extends HostProps>(name: string, Component: ComponentType<P>): MountFn<P> {
  return (el, initialProps) => {
    const root = createRoot(el, { identifierPrefix: `app19-${name}-` });
    const render = (props: P) =>
      root.render(
        <StrictMode>
          <MfeRoot name={name} theme={props.theme} host={props.host}>
            <Component {...props} />
          </MfeRoot>
        </StrictMode>,
      );
    render(initialProps);
    let mounted = true;
    return {
      update(next) {
        if (mounted) render(next);
      },
      unmount() {
        if (!mounted) return;
        mounted = false;
        root.unmount();
      },
    };
  };
}
