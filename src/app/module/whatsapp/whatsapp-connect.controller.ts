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
import { WhatsAppAiService } from './whatsapp-ai.service';

@ApiTags('WhatsApp')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@Controller('whatsapp')
export class WhatsAppConnectController {
  constructor(private readonly ai: WhatsAppAiService) {}

  @Post('connect/:companionId')
  async connect(
    @Req() request: Request,
    @Param('companionId', ParseUUIDPipe) companionId: string,
  ) {
    return { data: await this.ai.connect(request.user!.id, companionId) };
  }
}
