import {
  INestApplication,
  HttpException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import axios from 'axios';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramConnectController } from './telegram-connect.controller';
import { TelegramService } from './telegram.service';
import { TelegramAiService } from './telegram-ai.service';
import { webhookSecret } from './telegram-config';
import { UtilsInterceptor } from '../../utils/utils.interceptor';

jest.mock('axios');
// Axios is replaced by Jest; this reference is a mock, not an unbound method.
// eslint-disable-next-line @typescript-eslint/unbound-method
const post = axios.post as jest.Mock;

describe('Telegram HTTP and Swagger contracts', () => {
  let app: INestApplication;
  const id = '11111111-1111-4111-8111-111111111111';
  const config = new ConfigService({
    TELEGRAM_ELENA_COMPANION_ID: id,
    TELEGRAM_ELENA_BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    TELEGRAM_AUTO_REPLY_ENABLED: 'true',
    TELEGRAM_REPLY_MODE: 'echo',
  });
  const ai = { connect: jest.fn(), status: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TelegramWebhookController, TelegramConnectController],
      providers: [
        TelegramService,
        { provide: TelegramAiService, useValue: ai },
        { provide: ConfigService, useValue: config },
        {
          provide: JwtService,
          useValue: {
            verify: (token: string) => ({
              id: 'user-1',
              role: token === 'admin' ? 'admin' : 'user',
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalInterceptors(new UtilsInterceptor());
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    post.mockResolvedValue({ data: { ok: true } });
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects missing auth and wrong role for account linking', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/telegram/connect/${id}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/telegram/connect/${id}`)
      .set('Authorization', 'Bearer admin')
      .expect(403);
    expect(ai.connect).not.toHaveBeenCalled();
  });
  it('validates UUID and preserves the frontend response envelope', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telegram/connect/not-a-uuid')
      .set('Authorization', 'Bearer user')
      .expect(400);
    ai.connect.mockResolvedValue({
      telegramUrl: 'https://t.me/TestBot?start=token',
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/telegram/connect/${id}`)
      .set('Authorization', 'Bearer user')
      .expect(201);
    expect(res.body.data.telegramUrl).toBe('https://t.me/TestBot?start=token');
    expect(ai.connect).toHaveBeenCalledWith('user-1', id);
  });
  it('returns subscription denial over HTTP', async () => {
    ai.connect.mockRejectedValueOnce(
      new HttpException('An active subscription is required', 402),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/telegram/connect/${id}`)
      .set('Authorization', 'Bearer user')
      .expect(402);
  });
  it('exposes payment return status only for the authenticated user', async () => {
    ai.status.mockResolvedValue({
      linked: true,
      hasActiveSubscription: true,
      telegramUrl: 'https://t.me/TestBot',
    });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/telegram/status/${id}`)
      .set('Authorization', 'Bearer user')
      .expect(200);
    expect(res.body.data.linked).toBe(true);
    expect(ai.status).toHaveBeenCalledWith('user-1', id);
  });
  it('authenticates per-companion webhook and returns raw Telegram acknowledgement', async () => {
    const body = {
      update_id: 20,
      message: { text: 'hi', chat: { id: 12, type: 'private' } },
    };
    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${id}`)
      .send(body)
      .expect(403);
    expect(post).not.toHaveBeenCalled();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${id}`)
      .set('x-telegram-bot-api-secret-token', webhookSecret(config, 'ELENA'))
      .send(body)
      .expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('publishes new endpoints and bearer auth in Swagger', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token')
        .build(),
    );
    expect(
      doc.paths['/api/v1/telegram/connect/{companionId}'].post?.security,
    ).toEqual([{ 'access-token': [] }]);
    expect(
      doc.paths['/api/v1/telegram/status/{companionId}'].get,
    ).toBeDefined();
    expect(
      doc.paths['/api/v1/webhooks/telegram/{companionId}'].post,
    ).toBeDefined();
  });
});
