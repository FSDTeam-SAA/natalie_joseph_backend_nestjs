import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TelegramAiService } from './telegram-ai.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { MediaStoryService } from '../publishing/media-story.service';
import { LifestyleService } from '../lifestyle/lifestyle.service';
import { botKeys } from './telegram-config';
import { HttpException } from '@nestjs/common';

describe('All five Telegram companion photo flows', () => {
  function setup() {
    const prisma = {
      telegramConnection: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user' }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'user',
            email: 'test@example.test',
            role: 'user',
            status: 'approved',
            adultEligible: true,
            isSubscribed: true,
          }),
      },
      userSubscription: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 's', entitlementPolicy: { kind: 'paid' } }),
      },
    };
    const media = {
      id: 'photo',
      kind: 'image',
      url: 'https://res.cloudinary.com/test/photo.jpg',
    };
    const chat = {
      sendMessage: jest
        .fn()
        .mockResolvedValue({
          message_type: 'image',
          media,
          response: 'A photo',
        }),
    };
    const config = new ConfigService({
      ...Object.fromEntries(
        botKeys.map((key) => [
          `TELEGRAM_${key}_COMPANION_ID`,
          `companion-${key}`,
        ]),
      ),
      ACCESS_TOKEN_SECRET: 'test-only',
      TELEGRAM_PUBLIC_BASE_URL: 'https://test.example',
      TELEGRAM_CREDITS_URL: 'https://test.example/credits',
      TELEGRAM_SUBSCRIPTION_URL: 'https://test.example/subscriptions',
    });
    const service = new TelegramAiService(
      prisma as unknown as PrismaService,
      chat as unknown as ChatService,
      {
        sign: jest.fn().mockReturnValue('signed-token'),
      } as unknown as JwtService,
      {} as MediaStoryService,
      config,
      {} as LifestyleService,
    );
    return { service, chat, prisma, media };
  }
  it.each(botKeys)(
    '%s routes /photo through the same library/fallback and billing path',
    async (key) => {
      const { service, chat, media } = setup();
      const result = await service.reply(
        '123',
        '/photo gym',
        'stable-request',
        key,
      );
      expect(result).toEqual({ response: 'A photo', media });
      expect(chat.sendMessage).toHaveBeenCalledWith(
        'user',
        `companion-${key}`,
        '/photo gym',
        'Bearer signed-token',
        'text',
        'stable-request',
      );
    },
  );
  it('returns connect instructions before chat for an unlinked Telegram account', async () => {
    const { service, chat, prisma } = setup();
    prisma.telegramConnection.findUnique.mockResolvedValue(null as never);
    expect(await service.reply('123', '/photo gym', 'request')).toMatchObject({
      buttons: [expect.objectContaining({ text: 'Log In / Connect Account' })],
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });
  it('offers credit purchase instead of silently failing on insufficient credits', async () => {
    const { service, chat } = setup();
    chat.sendMessage.mockRejectedValue(
      new HttpException('Not enough credits', 402),
    );
    expect(await service.reply('123', '/photo gym', 'request')).toMatchObject({
      buttons: [expect.objectContaining({ text: 'Buy Credits' })],
    });
  });
  it('rejects an ineligible account before any AI or library call', async () => {
    const { service, chat, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ adultEligible: false } as never);
    expect(await service.reply('123', '/photo gym', 'request')).toContain(
      'approved adult',
    );
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });
});
