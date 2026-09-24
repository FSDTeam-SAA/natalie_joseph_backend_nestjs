import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../middlewares/auth.guard';
import { TelegramAiService } from './telegram-ai.service';

@ApiTags('Telegram')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@Controller('telegram')
export class TelegramConnectController {
  constructor(private readonly ai: TelegramAiService) {}

  @Post('connect/:companionId')
  async connect(
    @Req() request: Request,
    @Param('companionId', ParseUUIDPipe) companionId: string,
  ) {
    return { data: await this.ai.connect(request.user!.id, companionId) };
  }
}
