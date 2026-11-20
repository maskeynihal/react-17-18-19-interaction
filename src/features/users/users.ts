import type { User } from '../../mfe/contract';

export const USERS: User[] = [
  { id: 'u-1', name: 'Alice Johnson', email: 'alice@portal.test', role: 'admin' },
  { id: 'u-2', name: 'Bob Smith', email: 'bob@portal.test', role: 'editor' },
  { id: 'u-3', name: 'Carol Diaz', email: 'carol@portal.test', role: 'viewer' },
  { id: 'u-4', name: 'Dan Okafor', email: 'dan@portal.test', role: 'editor' },
  { id: 'u-5', name: 'Eve Martins', email: 'eve@portal.test', role: 'viewer' },
  { id: 'u-6', name: 'Frank Liu', email: 'frank@portal.test', role: 'admin' },
  { id: 'u-7', name: 'Grace Hopper', email: 'grace@portal.test', role: 'editor' },
  { id: 'u-8', name: 'Hiro Tanaka', email: 'hiro@portal.test', role: 'viewer' },
];

/** The signed-in portal user (mock). */
export const CURRENT_USER: User = USERS[0];
