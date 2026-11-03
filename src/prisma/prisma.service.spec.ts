import { databasePoolMax } from './prisma.service';

describe('databasePoolMax', () => {
  it('uses a conservative default for shared session poolers', () => {
    expect(databasePoolMax({})).toBe(3);
  });

  it('accepts an explicit positive integer', () => {
    expect(databasePoolMax({ DATABASE_POOL_MAX: '4' })).toBe(4);
  });

  it.each(['0', '-1', '1.5', 'invalid'])('rejects %s', (value) => {
    expect(() => databasePoolMax({ DATABASE_POOL_MAX: value })).toThrow(
      'DATABASE_POOL_MAX must be a positive integer',
    );
  });
});
