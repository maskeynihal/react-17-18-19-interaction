import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MountHandle } from './contract';
import { loadRemoteModule } from './remotes';

export interface RemoteMountProps<P> {
  /** e.g. 'portal17/UsersPage' */
  remote: string;
  props: P;
  fallback?: ReactNode;
  className?: string;
}

type Status = 'loading' | 'ready' | 'error';

/**
 * Host-side wrapper (contract §5): loads a federated mount adapter and drives it from React 19.
 * The remote owns everything inside the `data-remote` element; React here never renders children into it.
 */
export function RemoteMount<P>({ remote, props, fallback, className }: RemoteMountProps<P>) {
  const elRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MountHandle<P> | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadRemoteModule<P>(remote, { retry: attempt > 0 })
      .then((mod) => {
        if (cancelled || !elRef.current) return;
        handleRef.current = mod.mount(elRef.current, propsRef.current);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn(`[RemoteMount] failed to load ${remote}`, err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
      const handle = handleRef.current;
      handleRef.current = null;
      // Defer: never unmount the other React's root synchronously during our commit.
      if (handle) setTimeout(() => handle.unmount(), 0);
    };
  }, [remote, attempt]);

  useEffect(() => {
    handleRef.current?.update(props);
  }, [props]);

  return (
    <div className={['r19-remote', className].filter(Boolean).join(' ')}>
      {status === 'loading' && (
        <div className="r19-remote-loading" data-testid="remote-loading" aria-busy="true">
          {fallback ?? 'Loading…'}
        </div>
      )}
      {status === 'error' && (
        <div className="r19-remote-error" role="alert" data-testid="remote-error">
          <strong>This section is unavailable.</strong>
          <span className="r19-remote-error-detail">Could not load {remote}.</span>
          <button type="button" className="r19-btn r19-btn-ghost" data-testid="remote-retry" onClick={() => setAttempt((a) => a + 1)} title={error}>
            Retry
          </button>
        </div>
      )}
      <div ref={elRef} data-remote={remote} hidden={status === 'error'} />
    </div>
  );
}
