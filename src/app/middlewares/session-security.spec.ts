import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { sessionVersion } from '../helper/session-version';

describe('Password-dependent sessions', () => {
  function setup(
    version = sessionVersion('current'),
    role = 'user',
    status = 'approved',
  ) {
    const jwt = {
      verify: jest.fn().mockReturnValue({
        id: 'u',
        email: 'test@example.com',
        role: 'admin',
        sessionVersion: version,
      }),
    };
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ password: 'current', role, status }),
      },
    };
    const Guard = AuthGuard('admin');
    const guard = new Guard(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
    const request = { headers: { authorization: 'Bearer test' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { guard, context };
  }
  it('rejects a stale token after password change', async () => {
    const { guard, context } = setup(sessionVersion('old'), 'admin');
    await expect(guard.canActivate(context)).rejects.toThrow('Session expired');
  });
  it('uses the database role instead of a stale admin claim', async () => {
    const { guard, context } = setup();
    await expect(guard.canActivate(context)).rejects.toThrow('Forbidden');
  });
  it('allows a current approved admin session', async () => {
    const { guard, context } = setup(sessionVersion('current'), 'admin');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
