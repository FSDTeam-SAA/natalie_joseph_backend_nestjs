import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TelegramProfileService } from './telegram-profile.service';
import { MediaStoryService } from './media-story.service';
import {
  MediaStoryController,
  PublishingAdminController,
  PublishingConsoleController,
  StoryMediaController,
  TelegramStoryController,
} from './publishing.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [
    PublishingAdminController,
    PublishingConsoleController,
    MediaStoryController,
    StoryMediaController,
    TelegramStoryController,
  ],
  providers: [TelegramProfileService, MediaStoryService],
  exports: [TelegramProfileService, MediaStoryService],
})
export class PublishingModule {}
