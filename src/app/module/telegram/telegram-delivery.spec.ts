import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramAiService } from './telegram-ai.service';

describe('Telegram photo delivery', () => {
  const service = new TelegramService(
    new ConfigService({ TELEGRAM_CHLOE_BOT_TOKEN: 'test-token' }),
    {} as TelegramAiService,
  );
  afterEach(() => jest.restoreAllMocks());
  const rejected = {
    isAxiosError: true,
    response: {
      status: 400,
      data: { description: 'Bad Request: failed to get HTTP URL content' },
    },
  };

  it('uploads the saved photo when Telegram rejects fetching its URL', async () => {
    const post = jest
      .spyOn(axios, 'post')
      .mockRejectedValueOnce(rejected)
      .mockResolvedValueOnce({ data: { ok: true } });
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: new Uint8Array([1, 2]).buffer,
      headers: { 'content-type': 'image/jpeg' },
    });
    await service['sendRequest'](
      'sendPhoto',
      { chat_id: 1, photo: 'https://res.cloudinary.com/demo/image.jpg' },
      'CHLOE',
    );
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toBeInstanceOf(FormData);
  });

  it('never retries ambiguous delivery timeouts in the same request', async () => {
    const post = jest
      .spyOn(axios, 'post')
      .mockRejectedValue({ isAxiosError: true, code: 'ECONNABORTED' });
    const get = jest.spyOn(axios, 'get');
    await expect(
      service['sendRequest'](
        'sendPhoto',
        { chat_id: 1, photo: 'https://res.cloudinary.com/demo/image.jpg' },
        'CHLOE',
      ),
    ).rejects.toThrow('delivery may be retried');
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });

  it('does not download images from arbitrary hosts', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(rejected);
    const get = jest.spyOn(axios, 'get');
    await expect(
      service['sendRequest'](
        'sendPhoto',
        { chat_id: 1, photo: 'https://127.0.0.1/private' },
        'CHLOE',
      ),
    ).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
});
