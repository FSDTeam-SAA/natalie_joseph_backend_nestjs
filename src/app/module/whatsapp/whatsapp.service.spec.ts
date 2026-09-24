import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsApp outbound', () => {
  const config = {
    WHATSAPP_ACCESS_TOKEN: 'private-token',
    WHATSAPP_PHONE_NUMBER_ID: '123',
    WHATSAPP_GRAPH_VERSION: 'v25.0',
  };
  const service = new WhatsAppService(new ConfigService(config));
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('sends the hello_world template and returns the provider message ID', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.test' }] }),
    });
    expect(await service.sendTestTemplate('123', '8801712345678')).toEqual({
      messages: [{ id: 'wamid.test' }],
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v25.0/123/messages');
    expect(JSON.parse(options.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '8801712345678',
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    });
  });

  it('sends text and reports provider rejection as failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 190, error_subcode: 463, message: 'private-token' },
      }),
    });
    await expect(
      service.sendText('456', '8801712345678', 'Hello'),
    ).rejects.toThrow(
      'WhatsApp API rejected the message (HTTP 401, Meta code 190, subcode 463)',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text.body).toBe('Hello');
  });

  it('does not expose network error details or tokens', async () => {
    fetchMock.mockRejectedValue(new Error('private-token'));
    await expect(
      service.sendText('456', '8801712345678', 'Hello'),
    ).rejects.toThrow('WhatsApp API request failed');
  });

  it('does not call Meta without configuration', async () => {
    const unconfigured = new WhatsAppService(new ConfigService({}));
    await expect(
      unconfigured.sendText('456', '8801712345678', 'Hello'),
    ).rejects.toThrow('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
