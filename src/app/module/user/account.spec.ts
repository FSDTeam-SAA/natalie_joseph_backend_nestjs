import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { fileUpload } from '../../helper/fileUploder';
import type { Request } from 'express';

describe('Self-service account data boundaries', () => {
  afterEach(() => jest.restoreAllMocks());
  function setup() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'owner' }),
        update: jest.fn().mockResolvedValue({ id: 'owner', name: 'Updated' }),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    return {
      prisma,
      service: new UserService(prisma as unknown as PrismaService),
    };
  }
  it('projects only safe self-profile fields', async () => {
    const { prisma, service } = setup();
    await service.myProfile('owner');
    const query = prisma.user.findUnique.mock.calls[0][0];
    expect(query.where).toEqual({ id: 'owner' });
    expect(query.select).toMatchObject({ id: true, email: true, name: true });
    for (const secret of [
      'password',
      'otp',
      'otpExpiry',
      'stripeAccountId',
      'billingSubscriptionId',
    ])
      expect(query.select[secret]).toBeUndefined();
  });
  it('updates a name without requiring a password and ignores privileged fields', async () => {
    const { prisma, service } = setup();
    await service.UpdateMyProfile('owner', {
      name: '  Updated  ',
      phoneNumber: ' +123 ',
      email: 'other@example.test',
      role: 'admin',
      password: 'replacement',
      creditBalance: 500,
    } as never);
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({
      name: 'Updated',
      phoneNumber: '+123',
    });
    expect(prisma.user.update.mock.calls[0][0].select.password).toBeUndefined();
  });
  it('rejects an unsupported avatar before upload or persistence', async () => {
    const { prisma, service } = setup();
    const upload = jest.spyOn(fileUpload, 'uploadToCloudinary');
    await expect(
      service.UpdateMyProfile('owner', {}, {
        buffer: Buffer.from('not an image'),
      } as Express.Multer.File),
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('cleans an uploaded avatar if the database write fails', async () => {
    const { prisma, service } = setup();
    jest
      .spyOn(fileUpload, 'uploadToCloudinary')
      .mockResolvedValue({
        url: 'https://cdn.test/avatar.jpg',
        public_id: 'avatar',
      });
    const remove = jest
      .spyOn(fileUpload, 'deleteFromCloudinary')
      .mockResolvedValue(undefined as never);
    prisma.user.update.mockRejectedValue(new Error('write failed'));
    await expect(
      service.UpdateMyProfile('owner', {}, {
        buffer: Buffer.from([255, 216, 255]),
      } as Express.Multer.File),
    ).rejects.toThrow('write failed');
    expect(remove).toHaveBeenCalledWith('avatar');
  });
  it('scopes both payment rows and totals to the authenticated user, without provider secrets', async () => {
    const { prisma, service } = setup();
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'payment',
        amount: '12.50',
        status: 'completed',
        subscription: null,
        creditPackage: { name: 'Extra credits', currency: 'eur' },
      },
    ] as never);
    prisma.payment.count.mockResolvedValue(21);
    const result = await service.myPayments('owner', 2);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner' },
        skip: 20,
        take: 20,
      }),
    );
    expect(prisma.payment.count).toHaveBeenCalledWith({
      where: { userId: 'owner' },
    });
    expect(
      prisma.payment.findMany.mock.calls[0][0].select.stripePaymentIntentId,
    ).toBeUndefined();
    expect(result.payments[0]).toMatchObject({
      description: 'Extra credits',
      currency: 'eur',
    });
    expect(result.total).toBe(21);
  });
  it('takes payment ownership from the session rather than a user-supplied ID', async () => {
    const service = { myPayments: jest.fn() };
    const controller = new UserController(service as unknown as UserService);
    await controller.myPayments(
      {
        user: { id: 'owner' },
        query: { userId: 'other' },
      } as unknown as Request,
      1,
    );
    expect(service.myPayments).toHaveBeenCalledWith('owner', 1);
    service.myPayments.mockClear();
    await expect(
      controller.myPayments({ user: { id: 'owner' } } as unknown as Request, 0),
    ).rejects.toThrow('Invalid page');
    expect(service.myPayments).not.toHaveBeenCalled();
  });
});
