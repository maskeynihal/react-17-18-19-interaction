import React from 'react';
import type { User } from '../../mfe/contract';
import '../../styles/widgets.css';
import './profile.css';

interface ProfileFormProps {
  initial: User;
  onSave: (user: User) => void;
}

interface Errors {
  name?: string;
  email?: string;
  role?: string;
}

interface State {
  name: string;
  email: string;
  role: User['role'] | '';
  errors: Errors;
  touched: boolean;
  saved: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfile(values: Pick<State, 'name' | 'email' | 'role'>): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = 'Name is required';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!values.email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Enter a valid email address';
  if (!values.role) errors.role = 'Select a role';
  return errors;
}

/** Legacy controlled form, deliberately a React 17 class component. Portal-only (not exposed). */
export class ProfileForm extends React.Component<ProfileFormProps, State> {
  state: State = {
    name: this.props.initial.name,
    email: this.props.initial.email,
    role: this.props.initial.role,
    errors: {},
    touched: false,
    saved: false,
  };

  private handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    this.setState((prev) => {
      const next = { ...prev, [name]: value, saved: false } as State;
      return prev.touched ? { ...next, errors: validateProfile(next) } : next;
    });
  };

  private handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateProfile(this.state);
    if (Object.keys(errors).length > 0 || !this.state.role) {
      this.setState({ errors, touched: true, saved: false });
      return;
    }
    this.props.onSave({
      id: this.props.initial.id,
      name: this.state.name.trim(),
      email: this.state.email.trim(),
      role: this.state.role,
    });
    this.setState({ errors: {}, touched: false, saved: true });
  };

  render() {
    const { name, email, role, errors, saved } = this.state;
    return (
      <form className="r17-form" noValidate onSubmit={this.handleSubmit} data-testid="profile-form">
        <div className="r17-form__row">
          <label htmlFor="r17-profile-name">Full name</label>
          <input
            id="r17-profile-name"
            name="name"
            className="r17-input"
            value={name}
            onChange={this.handleChange}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'r17-profile-name-error' : undefined}
          />
          {errors.name && (
            <span id="r17-profile-name-error" className="r17-form__error" data-testid="error-name">
              {errors.name}
            </span>
          )}
        </div>
        <div className="r17-form__row">
          <label htmlFor="r17-profile-email">Email</label>
          <input
            id="r17-profile-email"
            name="email"
            type="email"
            className="r17-input"
            value={email}
            onChange={this.handleChange}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'r17-profile-email-error' : undefined}
          />
          {errors.email && (
            <span id="r17-profile-email-error" className="r17-form__error" data-testid="error-email">
              {errors.email}
            </span>
          )}
        </div>
        <div className="r17-form__row">
          <label htmlFor="r17-profile-role">Role</label>
          <select
            id="r17-profile-role"
            name="role"
            className="r17-input"
            value={role}
            onChange={this.handleChange}
            aria-invalid={!!errors.role}
          >
            <option value="">— select —</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          {errors.role && (
            <span className="r17-form__error" data-testid="error-role">
              {errors.role}
            </span>
          )}
        </div>
        <div className="r17-form__actions">
          <button type="submit" className="r17-btn r17-btn--primary" data-testid="profile-save">
            Save profile
          </button>
          {saved && (
            <span className="r17-form__saved" role="status" data-testid="profile-saved">
              Profile saved.
            </span>
          )}
        </div>
      </form>
    );
  }
}
