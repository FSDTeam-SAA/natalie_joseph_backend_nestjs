import { createHash } from 'node:crypto';
export const sessionVersion = (passwordHash: string) =>
  createHash('sha256').update(passwordHash).digest('hex');
