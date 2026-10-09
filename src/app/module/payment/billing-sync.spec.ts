import { BillingService } from './billing.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('Verified subscription synchronization', () => {
  function setup(status = 'active', invoiceStatus = 'paid') {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          billingSubscriptionId: 'sub',
          stripeAccountId: 'cus',
        }),
      },
    };
    const service = new BillingService(prisma as unknown as PrismaService);
    const remote = {
      id: 'sub',
      status,
      customer: 'cus',
      metadata: { userId: 'user' },
      latest_invoice: 'invoice',
    };
    const stripe = {
      subscriptions: { retrieve: jest.fn().mockResolvedValue(remote) },
      invoices: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'invoice',
          status: invoiceStatus,
          parent: { subscription_details: { subscription: 'sub' } },
        }),
      },
    };
    Object.defineProperty(service, 'stripe', { value: stripe });
    const paid = jest.spyOn(service, 'invoicePaid').mockResolvedValue();
    const changed = jest
      .spyOn(service, 'subscriptionChanged')
      .mockResolvedValue();
    jest.spyOn(service, 'status').mockResolvedValue({} as never);
    return { service, remote, stripe, paid, changed };
  }
  it('reconciles only a verified paid invoice for the authenticated owner', async () => {
    const { service, paid } = setup();
    await service.sync('user');
    expect(paid).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'invoice', status: 'paid' }),
    );
  });
  it('does not grant credits for an incomplete subscription', async () => {
    const { service, paid, stripe } = setup('incomplete');
    await service.sync('user');
    expect(paid).not.toHaveBeenCalled();
    expect(stripe.invoices.retrieve).not.toHaveBeenCalled();
  });
  it('does not grant credits for an unpaid invoice', async () => {
    const { service, paid } = setup('active', 'open');
    await service.sync('user');
    expect(paid).not.toHaveBeenCalled();
  });
  it('rejects a subscription belonging to another user', async () => {
    const { service, remote, paid, changed } = setup();
    remote.metadata.userId = 'another-user';
    await expect(service.sync('user')).rejects.toThrow('ownership mismatch');
    expect(paid).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });
});
