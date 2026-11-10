import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import config from 'src/app/config';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import { fileUpload } from 'src/app/helper/fileUploder';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { storyMime } from '../publishing/media-story.service';

const selfProfileSelect = {
  id: true, name: true, email: true, phoneNumber: true, profileImage: true,
  role: true, status: true, adultEligible: true, isSubscribed: true,
  creditBalance: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: createUserDto.email,
      },
    });

    if (user)
      throw new HttpException('user alrady exists', HttpStatus.BAD_REQUEST);

    const hashPassword = await bcrypt.hash(
      createUserDto.password,
      Number(config.bcryptSaltRounds) || 10,
    );

    const result = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        password: hashPassword,
      },
    });

    return result;
  }

  async getAllUser(params: IFilterParams, options: IOptions) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper(options);
    const whenCondition = buildWhereConditions(params, [
      'name',
      'email',
      'phoneNumber',
    ]);

    const [result, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.user.count({
        where: whenCondition,
      }),
    ]);

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getAllUserOverview() {
    const totalUser = await this.prisma.user.count({
      where: {
        role: { not: 'admin' },
      },
    });

    const totalActiveUser = await this.prisma.user.count({
      where: {
        role: { not: 'admin' },
        status: 'approved',
      },
    });

    const totalPremiumUser = await this.prisma.user.count({
      where: {
        role: { not: 'admin' },
        isSubscribed: true,
      },
    });

    const totalFreeUser = await this.prisma.user.count({
      where: {
        role: { not: 'admin' },
        isSubscribed: false,
        isFreeTrialUsed: true,
      },
    });

    return {
      totalUser,
      totalActiveUser,
      totalPremiumUser,
      totalFreeUser,
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (file) {
      const { url } = await fileUpload.uploadToCloudinary(file);
      updateUserDto.profileImage = url;
    }

    const result = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
    return result;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }

  async myProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: selfProfileSelect,
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  async UpdateMyProfile(
    id: string,
    updateUserDto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    let asset: { url: string; public_id: string } | undefined;
    if (file) {
      if (!file.buffer?.length || file.buffer.length > 10 * 1024 * 1024 || !storyMime(file.buffer).startsWith('image/'))
        throw new HttpException('Choose a JPEG, PNG or WebP image up to 10 MB', 400);
      asset = await fileUpload.uploadToCloudinary(file);
    }
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(updateUserDto.name !== undefined ? { name: updateUserDto.name.trim() } : {}),
          ...(updateUserDto.phoneNumber !== undefined ? { phoneNumber: updateUserDto.phoneNumber.trim() } : {}),
          ...(asset ? { profileImage: asset.url } : {}),
        },
        select: selfProfileSelect,
      });
    } catch (error) {
      if (asset) await fileUpload.deleteFromCloudinary(asset.public_id).catch(() => {});
      throw error;
    }
  }

  async myPayments(userId: string, page: number) {
    const where = { userId };
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 20, take: 20,
        select: { id: true, amount: true, status: true, paymentType: true,
          creditAmount: true, createdAt: true,
          subscription: { select: { name: true } },
          creditPackage: { select: { name: true, currency: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { payments: payments.map(({ subscription, creditPackage, ...payment }) => ({
      ...payment, description: subscription?.name || creditPackage?.name || 'Payment',
      currency: creditPackage?.currency || 'USD',
    })), total, page, limit: 20 };
  }
}
