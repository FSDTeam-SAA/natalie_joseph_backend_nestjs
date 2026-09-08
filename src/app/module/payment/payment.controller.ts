import { BillingService } from './billing.service';
import {
  Controller,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { PaymentService } from './payment.service';
import { BuyCreditsDto } from './dto/buy-credits.dto';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly billing: BillingService,
  ) {}

  @Get('subscription/status')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user', 'admin'))
  status(@Req() request: Request) {
    return this.billing.status(request.user!.id);
  }

  @Post('billing-portal')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user', 'admin'))
  portal(@Req() request: Request) {
    return this.billing.portal(request.user!.id);
  }

  @Post('subscription/cancel')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user', 'admin'))
  cancel(@Req() request: Request) {
    return this.billing.cancel(request.user!.id);
  }

  @Post('subscription/:subscriptionId/upgrade')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user', 'admin'))
  upgrade(@Req() request: Request, @Param('subscriptionId') id: string) {
    return this.billing.upgrade(request.user!.id, id);
  }

  @Post('subscription/:subscriptionId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a subscription payment' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'user'))
  async paySubscriber(
    @Req() request: Request,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const result = await this.paymentService.paySubscriber(
      request.user.id,
      subscriptionId,
    );

    return {
      message: 'Payment initiated successfully',
      data: result,
    };
  }

  @Post('credits')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buy a credit package by package ID' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  async buyCredits(@Req() request: Request, @Body() payload: BuyCreditsDto) {
    if (!request.user) throw new UnauthorizedException();
    const result = await this.paymentService.buyCredits(
      request.user.id,
      payload.packageId,
    );
    return { message: 'Credit payment initiated successfully', data: result };
  }
}
