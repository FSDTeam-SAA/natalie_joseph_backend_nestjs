import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async getActiveGifts(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const where = buildWhereConditions(params, ['name']);
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

      const charge = await this.creditService.consumeCredits(
        transaction,
        userId,
        gift.creditCost,
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
      const balanceBefore = user.creditBalance + charge.fromPurchased;

      const giftTransaction = await transaction.giftTransaction.create({
        data: {
          userId,
          companionId,
          giftId: gift.id,
          creditCost: gift.creditCost,
        },
      });

      if (charge.fromPurchased > 0)
        await transaction.creditTransaction.create({
          data: {
            userId,
            companionId,
            direction: 'debit',
            reason: 'gift',
            amount: charge.fromPurchased,
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
