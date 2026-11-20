import React, { useEffect, useRef, useState } from 'react';
import type { MountHandle } from '../mfe/contract';
import { loadRemoteModule } from '../mfe/runtime';
import './RemoteMount.css';

export interface RemoteMountProps<P> {
  /** e.g. 'app19/DashboardPage' */
  remote: string;
  props: P;
  /** Shown while the remote module is loading. */
  fallback?: React.ReactNode;
}

type Status = 'loading' | 'ready' | 'error';

/**
 * Host-side wrapper (contract §5), written in React 17.
 * The remote renders into its own root inside `<div data-remote>` with its own React.
 */
export function RemoteMount<P>({ remote, props, fallback }: RemoteMountProps<P>) {
  const elRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MountHandle<P> | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    loadRemoteModule<P>(remote).then(
      (mod) => {
        if (cancelled || !elRef.current) return;
        try {
          handleRef.current = mod.mount(elRef.current, propsRef.current);
          setStatus('ready');
        } catch (e) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setStatus('error');
        }
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus('error');
      },
    );

    return () => {
      cancelled = true;
      const handle = handleRef.current;
      handleRef.current = null;
      // Defer: never unmount a foreign root synchronously during our own commit.
      if (handle) setTimeout(() => handle.unmount(), 0);
    };
  }, [remote, attempt]);

  // Push every props change into the remote root.
  useEffect(() => {
    handleRef.current?.update(props);
  }, [props]);

  return (
    <div className="r17-remote" data-remote-host={remote}>
      {status === 'loading' &&
        (fallback ?? (
          <div className="r17-remote__loading" data-testid="remote-loading">
            Loading {remote}…
          </div>
        ))}
      {status === 'error' && (
        <div className="r17-remote__error" role="alert" data-testid="remote-error">
          <strong>Could not load {remote}.</strong>
          <span className="r17-remote__error-detail">{error?.message}</span>
          <button type="button" className="r17-btn" data-testid="remote-retry" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      <div ref={elRef} data-remote={remote} hidden={status === 'error'} />
    </div>
  );
}

export default RemoteMount;
