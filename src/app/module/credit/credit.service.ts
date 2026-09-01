import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateCreditPackageDto,
  UpdateCreditPackageDto,
} from './dto/credit.dto';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  createPackage(payload: CreateCreditPackageDto) {
    return this.prisma.creditPackage.create({ data: payload });
  }

  getActivePackages() {
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { credits: 'asc' },
    });
  }

  async updatePackage(id: string, payload: UpdateCreditPackageDto) {
    await this.getPackage(id);
    return this.prisma.creditPackage.update({ where: { id }, data: payload });
  }

  async deactivatePackage(id: string) {
    await this.getPackage(id);
    return this.prisma.creditPackage.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getWallet(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async getPackage(id: string) {
    const creditPackage = await this.prisma.creditPackage.findUnique({
      where: { id },
    });
    if (!creditPackage) throw new NotFoundException('Credit package not found');
    return creditPackage;
  }
}
