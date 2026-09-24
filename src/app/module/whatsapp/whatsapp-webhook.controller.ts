import type { RawBodyRequest } from '@nestjs/common';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { WhatsAppInboundService } from './whatsapp-inbound.service';

@Controller('webhooks/whatsapp')
@SetMetadata('rawResponse', true)
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly inbound: WhatsAppInboundService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
    );
    if (
      mode !== 'subscribe' ||
      !expectedToken ||
      token !== expectedToken ||
      typeof challenge !== 'string' ||
      !challenge
    ) {
      throw new ForbiddenException('Invalid webhook verification');
    }

    return challenge;
  }

  @Post()
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  async receiveWebhook(
    @Body() body: Parameters<WhatsAppInboundService['receive']>[0],
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<string> {
    this.inbound.verifySignature(req.rawBody, signature);
    this.logger.log('Verified WhatsApp webhook received');
    await this.inbound.receive(body);
    return 'EVENT_RECEIVED';
  }
}
