import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubscription(createSubscriptionDto: CreateSubscriptionDto) {
    const subscribe = await this.prisma.subscription.findFirst({
      where: { name: createSubscriptionDto.name },
    });
    if (subscribe) {
      throw new HttpException(
        'Subscription already exists',
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.prisma.subscription.create({
      data: createSubscriptionDto,
    });
    return result;
  }

  async getAllSubscription(params: IFilterParams, options: IOptions) {
    const { page, skip, limit, sortBy, sortOrder } = paginationHelper(options);
    const { features, ...filterParams } = params;
    const whereConditions = buildWhereConditions(
      filterParams,
      ['name'],
      features ? { features: { has: features } } : {},
    );

    const [total, result] = await Promise.all([
      this.prisma.subscription.count({ where: whereConditions }),
      this.prisma.subscription.findMany({
        where: whereConditions,
        skip: skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);
    return { data: result, meta: { total, page, limit } };
  }

  async getSubscriptionById(id: string) {
    const subscribe = await this.prisma.subscription.findUnique({
      where: { id },
    });
    if (!subscribe) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }
    return subscribe;
  }

  async updateSubscription(id: string, payload: UpdateSubscriptionDto) {
    const subscribe = await this.prisma.subscription.findUnique({
      where: { id },
    });
    if (!subscribe) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }
    const result = await this.prisma.subscription.update({
      where: { id },
      data: payload,
    });
    return result;
  }

  async deleteSubscription(id: string) {
    const subscribe = await this.prisma.subscription.findUnique({
      where: { id },
    });
    if (!subscribe) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }
    const result = await this.prisma.subscription.delete({
      where: { id },
    });
    return result;
  }
}
