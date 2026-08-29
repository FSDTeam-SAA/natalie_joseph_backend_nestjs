import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create subscription' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    const result = await this.subscriptionService.createSubscription(
      createSubscriptionDto,
    );
    return {
      message: 'Subscription created successfully',
      data: result,
    };
  }
}
