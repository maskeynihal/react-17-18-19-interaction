import React from 'react';
import ReactDOM from 'react-dom';
import type { MountFn, UsersPageProps } from '../mfe/contract';
import { UsersPage } from '../features/users/UsersPage';

function Root(props: UsersPageProps) {
  return (
    <div className="r17-mfe-root" data-mfe="UsersPage" data-react-version={React.version} data-theme={props.theme}>
      <UsersPage onSelectUser={props.onSelectUser} selectedUserId={props.selectedUserId} />
    </div>
  );
}

/** React 17 mount adapter: legacy ReactDOM.render root inside the host-provided element. */
export const mount: MountFn<UsersPageProps> = (el, props) => {
  ReactDOM.render(<Root {...props} />, el);
  return {
    update(next) {
      ReactDOM.render(<Root {...next} />, el);
    },
    unmount() {
      ReactDOM.unmountComponentAtNode(el);
    },
  };
};

export default mount;
