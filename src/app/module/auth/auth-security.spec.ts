import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { redactCredentials } from '../../helper/public-user';
import { sessionVersion } from '../../helper/session-version';
jest.mock('../../helper/sendMailer', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('new-password-hash'),
  compare: jest.fn().mockResolvedValue(true),
}));
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function setup() {
  const user = {
    findUnique: jest.fn().mockResolvedValue({
      id: 'id',
      email: 'test@example.com',
      otp: hash('otp:123456'),
      otpExpiry: new Date(Date.now() + 60000),
    }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  return {
    user,
    service: new AuthService(
      { user } as unknown as PrismaService,
      {} as JwtService,
    ),
  };
}
describe('Authentication security', () => {
  it('strips nested credential fields without removing dates or reset tokens', () => {
    const date = new Date();
    expect(
      redactCredentials({
        data: [
          {
            password: 'hash',
            otp: '123',
            otpExpiry: date,
            verifiedForgot: true,
            name: 'A',
            createdAt: date,
          },
        ],
        resetToken: 'one-use',
      }),
    ).toEqual({
      data: [{ name: 'A', createdAt: date }],
      resetToken: 'one-use',
    });
  });
  it('returns a reset token and stores only its hash after atomically consuming OTP', async () => {
    const { service, user } = setup();
    const result = await service.verifyOtp('test@example.com', '123456');
    expect(result.resetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(user.updateMany.mock.calls[0][0]).toMatchObject({
      where: { otp: hash('otp:123456'), verifiedForgot: false },
      data: { otp: hash('reset:' + result.resetToken), verifiedForgot: true },
    });
  });
  it('rejects consumed OTP and concurrent verification', async () => {
    const { service, user } = setup();
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.verifyOtp('test@example.com', '123456'),
    ).rejects.toThrow('Invalid');
  });
  it('does not authorize a reset using email and a flag alone', async () => {
    const { service, user } = setup();
    await expect(
      service.resetPassword('test@example.com', 'new-pass', ''),
    ).rejects.toThrow();
    expect(user.updateMany).not.toHaveBeenCalled();
  });
  it('requires matching unexpired single-use proof and clears it', async () => {
    const { service, user } = setup();
    const token = 'a'.repeat(64);
    await service.resetPassword('test@example.com', 'new-pass', token);
    expect(user.updateMany.mock.calls[0][0]).toMatchObject({
      where: {
        email: 'test@example.com',
        otp: hash('reset:' + token),
        otpExpiry: { gt: expect.any(Date) },
      },
      data: { otp: null, otpExpiry: null, verifiedForgot: false },
    });
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.resetPassword('test@example.com', 'new-pass', token),
    ).rejects.toThrow('Invalid');
  });
  it('changes session version whenever the password hash changes', () => {
    expect(sessionVersion('old')).not.toBe(sessionVersion('new'));
  });
});
