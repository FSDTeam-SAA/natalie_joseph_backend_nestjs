import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  SetMetadata,
} from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { TelegramMiniAppService } from './telegram-mini-app.service';
import { telegramLoginPage } from './telegram-login-page';

class TelegramSessionDto {
  @IsString() @MinLength(1) @MaxLength(8192) initData!: string;
}
class TelegramLoginDto extends TelegramSessionDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}

@ApiTags('Telegram Mini App')
@Controller('telegram/app')
export class TelegramMiniAppController {
  constructor(private readonly app: TelegramMiniAppService) {}

  @Get()
  @SetMetadata('rawResponse', true)
  page(@Res() response: Response) {
    const nonce = randomBytes(18).toString('base64');
    response
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://telegram.org; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org`,
      })
      .type('html')
      .send(telegramLoginPage.replaceAll('__NONCE__', nonce));
  }

  @Get('settings/:companionId')
  @Header('Cache-Control', 'no-store')
  async settings(@Param('companionId', ParseUUIDPipe) companionId: string) {
    return { data: await this.app.settings(companionId) };
  }

  @Post('login/:companionId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() body: TelegramLoginDto,
  ) {
    return {
      data: await this.app.login(id, body.initData, body.email, body.password),
    };
  }

  @Post('status/:companionId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async status(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() body: TelegramSessionDto,
  ) {
    return { data: await this.app.status(id, body.initData) };
  }
}
