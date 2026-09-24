import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  SetMetadata,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('webhooks/telegram')
@SetMetadata('rawResponse', true)
export class TelegramWebhookController {
  constructor(private readonly telegram: TelegramService) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    this.telegram.verifySecret(secret);
    await this.telegram.receive(body);
    return { ok: true };
  }
}
