import React from 'react';
import ReactDOM from 'react-dom';
import type { MountFn, ProfileCardProps } from '../mfe/contract';
import { ProfileCard } from '../features/profile/ProfileCard';

function Root(props: ProfileCardProps) {
  return (
    <div className="r17-mfe-root" data-mfe="ProfileCard" data-react-version={React.version} data-theme={props.theme}>
      <ProfileCard user={props.user} />
    </div>
  );
}

/** React 17 mount adapter: legacy ReactDOM.render root inside the host-provided element. */
export const mount: MountFn<ProfileCardProps> = (el, props) => {
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
