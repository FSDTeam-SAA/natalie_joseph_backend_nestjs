import axios from 'axios';
import { AiApi, aiIdempotencyKey } from './aiapi';

describe('AI chat request format', () => {
  it('fetches private audio by ID using the user token only on the configured AI origin', async () => {
    const get = jest
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: new Uint8Array([1, 2]).buffer });
    try {
      const audio = await new AiApi().getAudio(
        {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'audio',
          url: 'https://untrusted.example/collect',
          mime_type: 'audio/mpeg',
          byte_size: 2,
        },
        'Bearer test',
      );
      expect(get.mock.calls[0][0]).toMatch(
        /\/api\/v1\/media\/11111111-1111-4111-8111-111111111111$/,
      );
      expect(get.mock.calls[0][0]).not.toContain('untrusted.example');
      expect(get.mock.calls[0][1]).toMatchObject({
        headers: { Authorization: 'Bearer test' },
        maxRedirects: 0,
      });
      expect(audio.filename).toBe('reply.mp3');
    } finally {
      get.mockRestore();
    }
  });
  it('uploads actual voice bytes as multipart audio and preserves the spoken reply', async () => {
    const reply = {
      message_id: 'm',
      conversation_id: 'c',
      companion_id: 'p',
      response: 'Hello',
      message_type: 'audio',
      transcript: 'Hi',
      media: {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'audio',
        url: 'https://example.com/reply.mp3',
        mime_type: 'audio/mpeg',
      },
    };
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: reply });
    try {
      const result = await new AiApi().sendMessage(
        'c',
        'p',
        '',
        'Bearer test',
        'voice-key',
        {
          bytes: new Uint8Array([1, 2, 3]),
          mimeType: 'audio/ogg',
          filename: 'voice.ogg',
        },
      );
      const form = post.mock.calls[0][1] as FormData;
      const file = form.get('audio') as File;
      expect(file.name).toBe('voice.ogg');
      expect(file.type).toBe('audio/ogg');
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(
        new Uint8Array([1, 2, 3]),
      );
      expect(form.get('message')).toBe('');
      expect(result).toEqual(reply);
    } finally {
      post.mockRestore();
    }
  });
  it('uses stable UUID keys for webhook retries and preserves existing UUIDs', () => {
    const key = aiIdempotencyKey('phone:wamid.test');
    expect(key).toMatch(
      /^[a-f\d]{8}-[a-f\d]{4}-5[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/,
    );
    expect(aiIdempotencyKey('phone:wamid.test')).toBe(key);
    expect(aiIdempotencyKey('phone:wamid.other')).not.toBe(key);
    expect(aiIdempotencyKey(key)).toBe(key);
  });
  it('rejects unsafe image URLs instead of forwarding them', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        message_id: 'm',
        conversation_id: 'c',
        companion_id: 'p',
        response: 'Image',
        message_type: 'image',
        media: { kind: 'image', url: 'file:///private' },
      },
    });
    try {
      await expect(
        new AiApi().sendMessage('c', 'p', 'Image', 'Bearer test', 'k'),
      ).rejects.toThrow('Invalid AI image response');
    } finally {
      post.mockRestore();
    }
  });
  it('sends multipart fields matching the working AI endpoint', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        message_id: 'm',
        conversation_id: 'c',
        companion_id: 'p',
        response: 'Hello',
      },
    });
    try {
      await new AiApi().sendMessage('c', 'p', 'Hi', 'Bearer test', 'key');
      const form = post.mock.calls[0][1] as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(Object.fromEntries(form.entries())).toEqual({
        conversation_id: 'c',
        companion_id: 'p',
        message: 'Hi',
        idempotency_key: aiIdempotencyKey('key'),
      });
    } finally {
      post.mockRestore();
    }
  });
});
