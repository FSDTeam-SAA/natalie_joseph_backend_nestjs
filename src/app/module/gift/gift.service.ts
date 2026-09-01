import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGiftDto, UpdateGiftDto } from './dto/gift.dto';

@Injectable()
export class GiftService {
  constructor(private readonly prisma: PrismaService) {}

  createGift(payload: CreateGiftDto) {
    return this.prisma.gift.create({ data: payload });
  }

  getActiveGifts() {
    return this.prisma.gift.findMany({
      where: { isActive: true },
      orderBy: { creditCost: 'asc' },
    });
  }

  async updateGift(id: string, payload: UpdateGiftDto) {
    await this.getGift(id);
    return this.prisma.gift.update({ where: { id }, data: payload });
  }

  async deactivateGift(id: string) {
    await this.getGift(id);
    return this.prisma.gift.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async sendGift(userId: string, companionId: string, giftId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const now = new Date();
      const [gift, companion, subscription] = await Promise.all([
        transaction.gift.findFirst({ where: { id: giftId, isActive: true } }),
        transaction.companions.findFirst({
          where: { id: companionId, status: true },
          select: { id: true },
        }),
        transaction.userSubscription.findFirst({
          where: {
            userId,
            isActive: true,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
          select: { id: true },
        }),
      ]);

      if (!gift) throw new NotFoundException('Gift not found');
      if (!companion) throw new NotFoundException('Companion not found');
      if (!subscription) {
        throw new HttpException(
          'An active subscription is required to send gifts',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const debited = await transaction.user.updateMany({
        where: { id: userId, creditBalance: { gte: gift.creditCost } },
        data: { creditBalance: { decrement: gift.creditCost } },
      });
      if (debited.count === 0) {
        throw new HttpException(
          'Not enough credits to send this gift',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const user = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { creditBalance: true },
      });
      const balanceBefore = user.creditBalance + gift.creditCost;

      const giftTransaction = await transaction.giftTransaction.create({
        data: {
          userId,
          companionId,
          giftId: gift.id,
          creditCost: gift.creditCost,
        },
      });

      await transaction.creditTransaction.create({
        data: {
          userId,
          companionId,
          direction: 'debit',
          reason: 'gift',
          amount: gift.creditCost,
          balanceBefore,
          balanceAfter: user.creditBalance,
          referenceId: giftTransaction.id,
        },
      });

      const chatMessage = await transaction.chatMessage.create({
        data: {
          userId,
          companionId,
          giftId: gift.id,
          type: 'gift',
          message: `Sent ${gift.name}`,
          usedCredit: true,
          creditCost: gift.creditCost,
        },
        include: { gift: true },
      });

      return {
        giftTransaction,
        chatMessage,
        creditBalance: user.creditBalance,
      };
    });
  }

  private async getGift(id: string) {
    const gift = await this.prisma.gift.findUnique({ where: { id } });
    if (!gift) throw new NotFoundException('Gift not found');
    return gift;
  }
}
