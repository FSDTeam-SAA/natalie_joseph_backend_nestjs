import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../middlewares/auth.guard';
import { TelegramAiService } from './telegram-ai.service';

@ApiTags('Telegram')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@Controller('telegram')
export class TelegramConnectController {
  constructor(private readonly ai: TelegramAiService) {}

  @Get('status/:companionId')
  @ApiOperation({
    summary: 'Get Telegram linking/subscription status and return-to-bot URL',
    description:
      'Use after payment confirmation. Credit balance is available from the credit wallet API. This endpoint does not grant credits or activate subscriptions.',
  })
  @ApiParam({ name: 'companionId', format: 'uuid' })
  async status(
    @Req() request: Request,
    @Param('companionId', ParseUUIDPipe) companionId: string,
  ) {
    return { data: await this.ai.status(request.user!.id, companionId) };
  }

  @Post('connect/:companionId')
  @ApiOperation({
    summary: 'Create a 10-minute, single-use Telegram account link',
    description:
      'Requires an approved adult user and active subscription. Open data.telegramUrl and press START in Telegram.',
  })
  @ApiParam({ name: 'companionId', format: 'uuid' })
  @ApiResponse({
    status: 402,
    description:
      'Active subscription required. Subscribe on the website, then retry.',
  })
  async connect(
    @Req() request: Request,
    @Param('companionId', ParseUUIDPipe) companionId: string,
  ) {
    return { data: await this.ai.connect(request.user!.id, companionId) };
  }
}
