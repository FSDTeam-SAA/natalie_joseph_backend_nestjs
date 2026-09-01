import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { PaymentService } from '../payment/payment.service';
import { CreditService } from './credit.service';
import {
  CreateCreditPackageDto,
  PurchaseCreditPackageDto,
  UpdateCreditPackageDto,
} from './dto/credit.dto';

@ApiTags('Credits')
@Controller('credits')
export class CreditController {
  constructor(
    private readonly creditService: CreditService,
    private readonly paymentService: PaymentService,
  ) {}

  @Post('packages')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiOperation({ summary: 'Create a credit package (admin)' })
  async createPackage(@Body() payload: CreateCreditPackageDto) {
    const data = await this.creditService.createPackage(payload);
    return { message: 'Credit package created successfully', data };
  }

  @Get('packages')
  @ApiOperation({ summary: 'Get active credit packages' })
  async getPackages() {
    const data = await this.creditService.getActivePackages();
    return { message: 'Credit packages fetched successfully', data };
  }

  @Patch('packages/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiOperation({ summary: 'Update a credit package (admin)' })
  async updatePackage(
    @Param('id') id: string,
    @Body() payload: UpdateCreditPackageDto,
  ) {
    const data = await this.creditService.updatePackage(id, payload);
    return { message: 'Credit package updated successfully', data };
  }

  @Delete('packages/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiOperation({ summary: 'Deactivate a credit package (admin)' })
  async deactivatePackage(@Param('id') id: string) {
    const data = await this.creditService.deactivatePackage(id);
    return { message: 'Credit package deactivated successfully', data };
  }

  @Post('purchase')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  @ApiOperation({ summary: 'Purchase a credit package' })
  async purchase(
    @Req() request: Request,
    @Body() payload: PurchaseCreditPackageDto,
  ) {
    if (!request.user) throw new UnauthorizedException();
    const data = await this.paymentService.buyCredits(
      request.user.id,
      payload.packageId,
    );
    return { message: 'Credit payment initiated successfully', data };
  }

  @Get('wallet')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  @ApiOperation({ summary: 'Get wallet balance and recent transactions' })
  async getWallet(@Req() request: Request) {
    if (!request.user) throw new UnauthorizedException();
    const data = await this.creditService.getWallet(request.user.id);
    return { message: 'Wallet fetched successfully', data };
  }
}
