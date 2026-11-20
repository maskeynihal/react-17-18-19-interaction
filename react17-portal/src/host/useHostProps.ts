import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HostProps } from '../mfe/contract';
import { useTheme } from './theme';

/**
 * Stable `navigate` for remotes: react-router's navigate identity changes on every
 * location change, which would otherwise push a needless update() into each remote.
 */
export function useStableNavigate(): (path: string) => void {
  const navigate = useNavigate();
  const ref = useRef(navigate);
  useEffect(() => {
    ref.current = navigate;
  }, [navigate]);
  return useCallback((path: string) => ref.current(path), []);
}

export function useHostProps(): HostProps {
  const navigate = useStableNavigate();
  const { theme } = useTheme();
  return { navigate, theme, host: 'portal17' };
}
