import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  SetMetadata,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AuthGuard } from '../../middlewares/auth.guard';
import { TelegramProfileService } from './telegram-profile.service';
import { MediaStoryService } from './media-story.service';
import {
  PublishMediaStoryDto,
  StorySessionDto,
  TelegramProfileDto,
} from './publishing.dto';
import { storyViewer } from './story-viewer';
import { publishingConsole } from './publishing-console';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Admin companion publishing')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@Controller('admin/companions/:companionId')
export class PublishingAdminController {
  constructor(
    private readonly profiles: TelegramProfileService,
    private readonly stories: MediaStoryService,
  ) {}
  @Get('telegram-profile')
  async status(@Param('companionId', ParseUUIDPipe) id: string) {
    await this.stories.companion(id);
    return { data: await this.profiles.status(id) };
  }
  @Put('telegram-profile')
  async profile(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() dto: TelegramProfileDto,
  ) {
    await this.stories.companion(id);
    return { data: await this.profiles.save(id, dto) };
  }
  @Post('telegram-profile/retry')
  async retry(@Param('companionId', ParseUUIDPipe) id: string) {
    return { data: await this.profiles.retry(id) };
  }
  @Get('media-stories')
  async list(@Param('companionId', ParseUUIDPipe) id: string) {
    return { data: await this.stories.adminList(id) };
  }
  @Post('media-stories')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['media'],
      properties: {
        caption: { type: 'string', maxLength: 2048 },
        media: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('media', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async publish(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() dto: PublishMediaStoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return { data: await this.stories.publish(id, dto.caption || '', file) };
  }
  @Delete('media-stories/:storyId')
  async remove(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Param('storyId', ParseUUIDPipe) storyId: string,
  ) {
    return { data: await this.stories.remove(id, storyId) };
  }
}

@ApiTags('24-hour companion stories')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@Controller('media-stories')
export class MediaStoryController {
  constructor(private readonly stories: MediaStoryService) {}
  @Get('summary')
  @Header('Cache-Control', 'no-store')
  async summary(@Req() req: Request) {
    return { data: await this.stories.summary(req.user!.id) };
  }
  @Get('companions/:companionId')
  @Header('Cache-Control', 'no-store')
  async feed(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return { data: await this.stories.list(id, req.user!.id) };
  }
}

// Media access is authorized by a short-lived, user/story-scoped HMAC ticket.
@Controller('media-stories')
export class StoryMediaController {
  constructor(private readonly stories: MediaStoryService) {}
  @Get(':storyId/media')
  @SetMetadata('rawResponse', true)
  async media(
    @Param('storyId', ParseUUIDPipe) id: string,
    @Query('ticket') ticket: string | string[] | undefined,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    if (ticket !== undefined && typeof ticket !== 'string')
      throw new ForbiddenException('Invalid media link');
    const safeTicket = ticket ?? '';
    const row = await this.stories.media(id, safeTicket);
    const bytes = Buffer.from(row.media);
    const length = bytes.length;
    res.set({
      'Content-Type': row.mimeType,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    });
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return res.status(416).set('Content-Range', `bytes */${length}`).end();
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, length - Number(match[2]));
      const end = match[1]
        ? match[2]
          ? Math.min(Number(match[2]), length - 1)
          : length - 1
        : length - 1;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= length
      )
        return res.status(416).set('Content-Range', `bytes */${length}`).end();
      return res
        .status(206)
        .set({
          'Content-Range': `bytes ${start}-${end}/${length}`,
          'Content-Length': String(end - start + 1),
        })
        .send(bytes.subarray(start, end + 1));
    }
    return res.set('Content-Length', String(length)).send(bytes);
  }
}

@ApiTags('Telegram Story Viewer')
@Controller('telegram/stories')
export class TelegramStoryController {
  constructor(private readonly stories: MediaStoryService) {}
  @Get()
  @SetMetadata('rawResponse', true)
  page(@Res() res: Response) {
    const nonce = randomBytes(18).toString('base64');
    return res
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://telegram.org; style-src 'nonce-${nonce}'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org`,
      })
      .type('html')
      .send(storyViewer.replaceAll('__NONCE__', nonce));
  }
  @Post(':companionId/feed')
  @Header('Cache-Control', 'no-store')
  async feed(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() dto: StorySessionDto,
  ) {
    return {
      data: await this.stories.list(
        id,
        await this.stories.telegramUser(id, dto.initData),
      ),
    };
  }
}

@Controller('publishing')
export class PublishingConsoleController {
  constructor(private readonly config: ConfigService) {}
  @Get('admin')
  @SetMetadata('rawResponse', true)
  page(@Res() res: Response) {
    if (this.config.get('PUBLISHING_ADMIN_CONSOLE_ENABLED') !== 'true')
      throw new NotFoundException();
    const nonce = randomBytes(18).toString('base64');
    return res
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' blob:; media-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
      })
      .type('html')
      .send(publishingConsole.replaceAll('__NONCE__', nonce));
  }
}
