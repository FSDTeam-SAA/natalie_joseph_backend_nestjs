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
import { CreateGiftDto, SendGiftDto, UpdateGiftDto } from './dto/gift.dto';
import { GiftService } from './gift.service';

@ApiTags('Gifts')
@Controller('gifts')
export class GiftController {
  constructor(private readonly giftService: GiftService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiOperation({ summary: 'Create a gift (admin)' })
  async createGift(@Body() payload: CreateGiftDto) {
    const data = await this.giftService.createGift(payload);
    return { message: 'Gift created successfully', data };
  }

  @Get()
  @ApiOperation({ summary: 'Get active gifts' })
  async getGifts() {
    const data = await this.giftService.getActiveGifts();
    return { message: 'Gifts fetched successfully', data };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiOperation({ summary: 'Update a gift (admin)' })
  async updateGift(@Param('id') id: string, @Body() payload: UpdateGiftDto) {
    const data = await this.giftService.updateGift(id, payload);
    return { message: 'Gift updated successfully', data };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiOperation({ summary: 'Deactivate a gift (admin)' })
  async deactivateGift(@Param('id') id: string) {
    const data = await this.giftService.deactivateGift(id);
    return { message: 'Gift deactivated successfully', data };
  }

  @Post(':giftId/send')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  @ApiOperation({ summary: 'Send a gift to a companion using credits' })
  async sendGift(
    @Req() request: Request,
    @Param('giftId') giftId: string,
    @Body() payload: SendGiftDto,
  ) {
    if (!request.user) throw new UnauthorizedException();
    const data = await this.giftService.sendGift(
      request.user.id,
      payload.companionId,
      giftId,
    );
    return { message: 'Gift sent successfully', data };
  }
}
