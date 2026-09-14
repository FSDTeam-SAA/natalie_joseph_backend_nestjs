import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppAiService } from './whatsapp-ai.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsApp reply modes', () => {
  it.each(['echo', 'ai', 'image'])(
    'routes %s replies correctly without duplicate sends',
    async (mode) => {
      const sendText = jest.fn().mockResolvedValue({});
      const sendImage = jest.fn().mockResolvedValue({});
      const reply = jest
        .fn()
        .mockResolvedValue(
          mode === 'image'
            ? {
                response: 'An image',
                media: { url: 'https://example.com/image.jpg' },
              }
            : 'AI answer',
        );
      const service = new WhatsAppInboundService(
        new ConfigService({
          WHATSAPP_AUTO_REPLY_ENABLED: 'true',
          WHATSAPP_REPLY_MODE: mode === 'image' ? 'ai' : mode,
        }),
        { sendText, sendImage } as unknown as WhatsAppService,
        {
          companions: {
            findFirst: jest.fn().mockResolvedValue({ id: 'elena' }),
          },
        } as unknown as PrismaService,
        { reply } as unknown as WhatsAppAiService,
      );
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '123' },
                  messages: [
                    {
                      id: 'm',
                      from: '8801518643073',
                      type: 'text',
                      text: { body: 'how are you' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      await service.receive(payload);
      await service.receive(payload);
      if (mode === 'image') {
        expect(sendText).not.toHaveBeenCalled();
        expect(sendImage).toHaveBeenCalledTimes(1);
        expect(sendImage).toHaveBeenCalledWith(
          '123',
          '8801518643073',
          'https://example.com/image.jpg',
          'An image',
        );
        return;
      }
      expect(sendText).toHaveBeenCalledTimes(1);
      expect(sendText).toHaveBeenCalledWith(
        '123',
        '8801518643073',
        mode === 'echo' ? 'You said: how are you' : 'AI answer',
      );
      expect(reply).toHaveBeenCalledTimes(mode === 'echo' ? 0 : 1);
    },
  );
});
