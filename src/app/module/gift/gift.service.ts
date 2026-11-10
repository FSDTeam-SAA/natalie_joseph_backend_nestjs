import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import { fileUpload } from 'src/app/helper/fileUploder';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { CreateGiftDto, UpdateGiftDto } from './dto/gift.dto';

@Injectable()
export class GiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {}

  async createGift(payload: CreateGiftDto, file?: Express.Multer.File) {
    if (file) {
      const { url } = await fileUpload.uploadToCloudinary(file);
      payload.image = url;
    }
    return this.prisma.gift.create({ data: payload });
  }

  async getActiveGifts(
    params: IFilterParams,
    options: IOptions,
    includeInactive = false,
  ) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const where = {
      ...buildWhereConditions(params, ['name']),
      ...(!includeInactive ? { isActive: true } : {}),
    };
    const [total, result] = await Promise.all([
      this.prisma.gift.count({ where }),
      this.prisma.gift.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip,
      }),
    ]);
    return { data: result, meta: { total, page, limit } };
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

  async history(userId: string, page: number) {
    const where = { userId };
    const [data, total] = await Promise.all([
      this.prisma.giftTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 20,
        take: 20,
        select: {
          id: true,
          creditCost: true,
          status: true,
          createdAt: true,
          gift: { select: { name: true, image: true } },
          companion: { select: { name: true } },
        },
      }),
      this.prisma.giftTransaction.count({ where }),
    ]);
    return { data, total, page, limit: 20 };
  }

  async sendGift(
    userId: string,
    companionId: string,
    giftId: string,
    requestId?: string,
    expectedCreditCost?: number,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      // Serialize retries for this wallet before checking or charging the gift.
      await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      if (requestId) {
        const previous = await transaction.giftTransaction.findUnique({
          where: { id: requestId },
        });
        if (previous) {
          if (
            previous.userId !== userId ||
            previous.companionId !== companionId ||
            previous.giftId !== giftId
          )
            throw new HttpException(
              'Gift request does not match the original purchase',
              HttpStatus.CONFLICT,
            );
          return { giftTransaction: previous, alreadySent: true };
        }
      }
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
      if (
        expectedCreditCost !== undefined &&
        gift.creditCost !== expectedCreditCost
      )
        throw new HttpException(
          'The gift price changed. Refresh gifts before confirming again.',
          HttpStatus.CONFLICT,
        );
      if (!companion) throw new NotFoundException('Companion not found');
      if (!subscription) {
        throw new HttpException(
          'An active subscription is required to send gifts',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const giftTransactionId = requestId || randomUUID();
      const charge = await this.creditService.consumeCredits(
        transaction,
        userId,
        gift.creditCost,
        { reason: 'gift', companionId, referenceId: giftTransactionId },
      );
      if (!charge) {
        throw new HttpException(
          'Not enough credits to send this gift',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const user = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { creditBalance: true },
      });

      const giftTransaction = await transaction.giftTransaction.create({
        data: {
          userId,
          companionId,
          id: giftTransactionId,
          giftId: gift.id,
          creditCost: gift.creditCost,
        },
      });

      const chatMessage = await transaction.chatMessage.create({
        data: {
          userId,
          companionId,
          giftId: gift.id,
          type: 'gift',
          message: `Sent ${gift.name}`,
          usedCredit: charge.fromPurchased > 0,
          creditCost: gift.creditCost,
        },
        include: { gift: true },
      });

      const conversation = await transaction.chatConversation.upsert({
        where: { userId_companionId: { userId, companionId } },
        create: { userId, companionId },
        update: { updatedAt: new Date() },
      });
      await transaction.chatMessage.update({
        where: { id: chatMessage.id },
        data: { conversationId: conversation.id },
      });

      await transaction.relationship.upsert({
        where: { userId_companionId: { userId, companionId } },
        create: {
          userId,
          companionId,
          interactions: 1,
          lastInteractionAt: now,
        },
        update: { interactions: { increment: 1 }, lastInteractionAt: now },
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
