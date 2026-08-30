import {
  Controller,
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

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
}
