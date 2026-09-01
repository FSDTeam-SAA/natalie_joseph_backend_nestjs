import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { fileUpload } from 'src/app/helper/fileUploder';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { CreateGiftDto, SendGiftDto, UpdateGiftDto } from './dto/gift.dto';
import { GiftService } from './gift.service';

@ApiTags('Gifts')
@Controller('gifts')
export class GiftController {
  constructor(private readonly giftService: GiftService) {}

  @Post()
  @ApiOperation({ summary: 'Create a gift (admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(FileInterceptor('image', fileUpload.uploadConfig))
  async createGift(
    @Body() payload: CreateGiftDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.giftService.createGift(payload, file);
    return { message: 'Gift created successfully', data };
  }

  @Get()
  @ApiOperation({ summary: 'Get active gifts' })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @HttpCode(HttpStatus.OK)
  async getGifts(@Req() req: Request) {
    const filters = pick(req.query, ['searchTerm', 'name']);
    const options = pick(req.query, ['sortBy', 'sortOrder', 'limit', 'page']);
    const result = await this.giftService.getActiveGifts(filters, options);
    return {
      message: 'Gifts fetched successfully',
      meta: result.meta,
      data: result.data,
    };
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
