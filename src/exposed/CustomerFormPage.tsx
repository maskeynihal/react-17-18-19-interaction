import type { CustomerFormPageProps, MountFn } from '../mfe/contract';
import { CustomerForm } from '../features/customers/CustomerForm';
import { createMount } from './createMount';

export const mount: MountFn<CustomerFormPageProps> = createMount<CustomerFormPageProps>('CustomerFormPage', CustomerForm);
export default mount;
