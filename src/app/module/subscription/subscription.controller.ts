import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
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

  @Get()
  @ApiOperation({ summary: 'Get all subscription' })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
  })
  @ApiQuery({
    name: 'sortBy',
    type: 'string',
    required: false,
  })
  @ApiQuery({
    name: 'sortOrder',
    type: 'string',
    required: false,
  })
  @ApiQuery({
    name: 'name',
    type: 'string',
    required: false,
  })
  @ApiQuery({
    name: 'features',
    type: 'string',
    required: false,
  })
  @ApiQuery({
    name: 'isPopular',
    type: 'boolean',
    required: false,
  })
  @ApiQuery({
    name: 'isActive',
    type: 'boolean',
    required: false,
  })
  @ApiQuery({
    name: 'searchTerm',
    type: 'string',
    required: false,
  })
  @HttpCode(HttpStatus.OK)
  async getAllSubscription(@Req() req: Request) {
    const filters = pick(req.query, [
      'searchTerm',
      'name',
      'features',
      'isPopular',
      'isActive',
    ]);
    const params = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.subscriptionService.getAllSubscription(
      filters,
      params,
    );
    return {
      message: 'Subscription fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by id' })
  @HttpCode(HttpStatus.OK)
  async getSubscriptionById(@Param('id') id: string) {
    const result = await this.subscriptionService.getSubscriptionById(id);
    return {
      message: 'Subscription fetched successfully',
      data: result,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    const result = await this.subscriptionService.updateSubscription(
      id,
      updateSubscriptionDto,
    );
    return {
      message: 'Subscription updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  async deleteSubscription(@Param('id') id: string) {
    const result = await this.subscriptionService.deleteSubscription(id);
    return {
      message: 'Subscription deleted successfully',
      data: result,
    };
  }
}
