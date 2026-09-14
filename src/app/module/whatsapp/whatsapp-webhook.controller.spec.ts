import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UtilsInterceptor } from '../../utils/utils.interceptor';
import { WhatsAppModule } from './whatsapp.module';
import { createHmac } from 'crypto';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppAiService } from './whatsapp-ai.service';
import { JwtModule } from '@nestjs/jwt';

describe('WhatsApp webhook HTTP responses', () => {
  let app: INestApplication;
  let token: string | undefined;
  const findFirst = jest.fn().mockResolvedValue({ id: 'elena' });
  const sendText = jest
    .fn()
    .mockResolvedValue({ messages: [{ id: 'outbound' }] });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ global: true }), WhatsAppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          ({
            WHATSAPP_VERIFY_TOKEN: token,
            WHATSAPP_APP_SECRET: 'test-secret',
            WHATSAPP_PHONE_NUMBER_ID: '123',
            WHATSAPP_AUTO_REPLY_ENABLED: 'true',
          })[key],
      })
      .overrideProvider(WhatsAppService)
      .useValue({ sendText })
      .overrideProvider(PrismaService)
      .useValue({ companions: { findFirst } })
      .overrideProvider(WhatsAppAiService)
      .useValue({
        reply: jest.fn(
          async (_companion: string, _to: string, text: string) =>
            `You said: ${text}`,
        ),
      })
      .compile();
    app = module.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new UtilsInterceptor());
    await app.init();
  });

  beforeEach(() => {
    token = 'test-verify-token';
    findFirst.mockReset().mockResolvedValue({ id: 'elena' });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['456', '789'])(
    'routes replies through companion phone ID %s',
    async (phoneNumberId) => {
      sendText.mockClear();
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: phoneNumberId },
                  messages: [
                    {
                      id: 'same-id-across-senders',
                      from: '8801712345678',
                      type: 'text',
                      text: { body: 'Hi' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const signature =
        'sha256=' +
        createHmac('sha256', 'test-secret')
          .update(JSON.stringify(payload))
          .digest('hex');
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .send(payload)
        .expect(200);
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          whatsappPhoneNumberId: phoneNumberId,
          whatsappEnabled: true,
          status: true,
        },
        select: { id: true },
      });
      expect(sendText).toHaveBeenCalledWith(
        phoneNumberId,
        '8801712345678',
        'You said: Hi',
      );
    },
  );

  it('ignores unknown or disabled companion senders', async () => {
    findFirst.mockResolvedValue(null);
    sendText.mockClear();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '999' },
                messages: [
                  {
                    id: 'unknown',
                    from: '8801712345678',
                    type: 'text',
                    text: { body: 'Hi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const signature =
      'sha256=' +
      createHmac('sha256', 'test-secret')
        .update(JSON.stringify(payload))
        .digest('hex');
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', signature)
      .send(payload)
      .expect(200);
    expect(sendText).not.toHaveBeenCalled();
  });

  it('returns the exact challenge without the global JSON envelope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': token,
        'hub.challenge': '00123456',
      })
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect('00123456');
  });

  it.each([
    {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong',
      'hub.challenge': '1',
    },
    {
      'hub.mode': 'invalid',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': '1',
    },
    { 'hub.mode': 'subscribe', 'hub.challenge': '1' },
    { 'hub.mode': 'subscribe', 'hub.verify_token': 'test-verify-token' },
  ])('rejects invalid verification %j', async (query) => {
    await request(app.getHttpServer())
      .get('/api/v1/webhooks/whatsapp')
      .query(query)
      .expect(403);
  });

  it('fails closed when the server token is not configured', async () => {
    token = undefined;
    await request(app.getHttpServer())
      .get('/api/v1/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.challenge': '1' })
      .expect(403);
  });

  it('logs incoming events and acknowledges with HTTP 200 plain text', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    try {
      const payload = { entry: [{ changes: [] }] };
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set(
          'x-hub-signature-256',
          'sha256=' +
            createHmac('sha256', 'test-secret')
              .update(JSON.stringify(payload))
              .digest('hex'),
        )
        .send(payload)
        .expect(200)
        .expect('EVENT_RECEIVED');
      expect(log).toHaveBeenCalledWith(
        'Verified WhatsApp webhook received',
      );
    } finally {
      log.mockRestore();
    }
  });

  it('rejects unsigned webhook events and unauthenticated outbound tests', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/whatsapp/test')
      .send({ to: '8801712345678' })
      .expect(401);
  });

  it('echoes signed text events once and ignores status events', async () => {
    sendText.mockClear();
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
                    id: 'incoming-1',
                    from: '8801712345678',
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
              },
            },
            { value: { statuses: [{ status: 'delivered' }] } },
          ],
        },
      ],
    };
    const signature =
      'sha256=' +
      createHmac('sha256', 'test-secret')
        .update(JSON.stringify(payload))
        .digest('hex');
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .send(payload)
        .expect(200)
        .expect('EVENT_RECEIVED');
    }
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith(
      '123',
      '8801712345678',
      'You said: Hello',
    );
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-hub-signature-256', signature)
      .send({ ...payload, object: 'tampered' })
      .expect(403);
  });
});
