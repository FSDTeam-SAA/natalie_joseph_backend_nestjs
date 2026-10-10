import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Param,
  ParseUUIDPipe,
  SetMetadata,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramQueueService } from './telegram-queue.service';

@Controller('webhooks/telegram')
@SetMetadata('rawResponse', true)
export class TelegramWebhookController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly queue: TelegramQueueService,
  ) {}

  @Post(':companionId')
  @HttpCode(200)
  async receiveForCompanion(
    @Param('companionId', ParseUUIDPipe) companionId: string,
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    const key = this.telegram.botKey(companionId);
    this.telegram.verifySecret(secret, key);
    await this.queue.receive(body, key);
    return { ok: true };
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    this.telegram.verifySecret(secret);
    await this.queue.receive(body);
    return { ok: true };
  }
}
