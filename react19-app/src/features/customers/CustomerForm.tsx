import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import { emit, type Customer, type CustomerFormPageProps, type Plan } from '../../mfe/contract';
import { PLANS, PLAN_LABELS, newId } from '../../domain';
import '../../styles/r19.css';

type Field = 'name' | 'email' | 'plan';

interface FormState {
  status: 'idle' | 'error' | 'success';
  values: Record<Field, string>;
  errors: Partial<Record<Field, string>>;
  created?: Customer;
  submitError?: string;
}

const EMPTY: FormState = { status: 'idle', values: { name: '', email: '', plan: '' }, errors: {} };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlan(value: string): value is Plan {
  return (PLANS as string[]).includes(value);
}

export function validate(values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (values.name.trim().length < 2) errors.name = 'Name is required (at least 2 characters).';
  if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!isPlan(values.plan)) errors.plan = 'Choose a plan.';
  return errors;
}

function SubmitButton() {
  // useFormStatus must be rendered inside the <form> it reports on.
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="r19-btn" disabled={pending} data-testid="customer-submit">
      {pending ? 'Saving…' : 'Create customer'}
    </button>
  );
}

export function CustomerForm({ onSubmit, onCancel }: CustomerFormPageProps) {
  const uid = useId();
  const [state, formAction] = useActionState(async (_prev: FormState, data: FormData): Promise<FormState> => {
    const values = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      plan: String(data.get('plan') ?? ''),
    };
    const errors = validate(values);
    if (Object.keys(errors).length > 0 || !isPlan(values.plan)) return { status: 'error', values, errors };

    const customer: Customer = {
      id: newId('c'),
      name: values.name.trim(),
      email: values.email.trim(),
      plan: values.plan,
      createdAt: new Date().toISOString(),
    };
    try {
      // Contract rule 4: callback for the host first, then the event for anyone listening.
      await onSubmit(customer);
    } catch (err) {
      return { status: 'error', values, errors: {}, submitError: err instanceof Error ? err.message : 'Submit failed.' };
    }
    emit('mfe:customer-created', customer);
    return { ...EMPTY, status: 'success', created: customer };
  }, EMPTY);

  const fieldProps = (field: Field) => ({
    id: `${uid}-${field}`,
    name: field,
    className: 'r19-input',
    'aria-invalid': state.errors[field] ? true : undefined,
    'aria-describedby': state.errors[field] ? `${uid}-${field}-error` : undefined,
    'data-testid': `customer-${field}`,
  });

  const fieldError = (field: Field) =>
    state.errors[field] ? (
      <span id={`${uid}-${field}-error`} className="r19-field-error" data-testid={`customer-${field}-error`}>
        {state.errors[field]}
      </span>
    ) : null;

  return (
    <section className="r19-page" data-testid="customer-form-page">
      <div className="r19-page-head">
        <div>
          <h1 className="r19-page-title">New customer</h1>
          <p className="r19-page-sub">Built with React 19 form actions.</p>
        </div>
      </div>

      <div className="r19-card">
        {state.status === 'success' && state.created && (
          <p className="r19-success" role="status" data-testid="customer-success">
            Customer “{state.created.name}” created.
          </p>
        )}
        {state.submitError && (
          <p className="r19-field-error" role="alert" data-testid="customer-submit-error">
            {state.submitError}
          </p>
        )}
        {/* key resets uncontrolled inputs to the action's returned values after every submit */}
        <form action={formAction} className="r19-form" noValidate data-testid="customer-form" key={JSON.stringify(state.values) + state.status}>
          <div className="r19-field">
            <label className="r19-label" htmlFor={`${uid}-name`}>Name</label>
            <input {...fieldProps('name')} type="text" defaultValue={state.values.name} autoComplete="organization" />
            {fieldError('name')}
          </div>
          <div className="r19-field">
            <label className="r19-label" htmlFor={`${uid}-email`}>Email</label>
            <input {...fieldProps('email')} type="email" defaultValue={state.values.email} autoComplete="email" />
            {fieldError('email')}
          </div>
          <div className="r19-field">
            <label className="r19-label" htmlFor={`${uid}-plan`}>Plan</label>
            <select {...fieldProps('plan')} defaultValue={state.values.plan}>
              <option value="">Select a plan…</option>
              {PLANS.map((p) => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
            {fieldError('plan')}
          </div>
          <div className="r19-form-actions">
            <SubmitButton />
            {onCancel && (
              <button type="button" className="r19-btn r19-btn-ghost" onClick={onCancel} data-testid="customer-cancel">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
