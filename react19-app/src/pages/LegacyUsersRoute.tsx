import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { RemoteMount } from '../mfe/RemoteMount';
import { on, type HostProps, type User, type UsersPageProps } from '../mfe/contract';

export function LegacyUsersRoute({ theme }: { theme: HostProps['theme'] }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<User | null>(null);
  const [selectedVia, setSelectedVia] = useState<'callback' | 'event' | null>(null);
  // Counts clicks that bubble out of the remote's DOM into this host element (ADR 0001 consequence).
  const [panelClicks, setPanelClicks] = useState(0);

  useEffect(
    () =>
      on('mfe:user-selected', (user) => {
        setSelected(user);
        setSelectedVia((v) => v ?? 'event');
      }),
    [],
  );

  const usersProps = useMemo<UsersPageProps>(
    () => ({
      onSelectUser: (user) => {
        setSelected(user);
        setSelectedVia('callback');
      },
      selectedUserId: selected?.id,
      navigate: (p) => void navigate(p),
      theme,
      host: 'app19',
    }),
    [navigate, theme, selected?.id],
  );

  return (
    <section className="r19-page">
      <div className="r19-page-head">
        <div>
          <h1 className="r19-page-title">Legacy users</h1>
          <p className="r19-page-sub">The React 17 portal's UsersPage, embedded via Module Federation.</p>
        </div>
      </div>

      {selected ? (
        <div className="r19-banner" data-testid="selected-user" data-user-id={selected.id} data-via={selectedVia ?? undefined}>
          Selected user: <strong>{selected.name}</strong> ({selected.email}) · {selected.role}
        </div>
      ) : (
        <div className="r19-banner" data-testid="no-selected-user">No user selected yet.</div>
      )}

      <div className="r19-legacy-frame" data-testid="legacy-host-panel" onClick={() => setPanelClicks((c) => c + 1)}>
        <div className="r19-legacy-meta">
          Clicks inside this panel: <span data-testid="legacy-panel-clicks">{panelClicks}</span>
        </div>
        <RemoteMount<UsersPageProps> remote="portal17/UsersPage" props={usersProps} />
      </div>
    </section>
  );
}
